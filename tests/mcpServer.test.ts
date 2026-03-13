import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime } from '../src/server.js';

const dbPath = resolve(process.cwd(), '.data/test-mcp-server.sqlite');

type RuntimeContext = {
  client: Client;
  runtime: ReturnType<typeof createRuntime>;
};

afterEach(() => {
  delete process.env.ANKI_GATEWAY_MODE;
  delete process.env.ANKI_MCPS_DB_PATH;
  delete process.env.DRAFT_DB_PATH;
  delete process.env.ANKI_ACTIVE_PROFILE;
  rmSync(dbPath, { force: true });
});

async function createConnectedContext(): Promise<RuntimeContext> {
  process.env.ANKI_GATEWAY_MODE = 'memory';
  process.env.ANKI_MCPS_DB_PATH = dbPath;
  process.env.ANKI_ACTIVE_PROFILE = 'default';

  const runtime = createRuntime();
  const client = new Client({ name: 'mcp-server-test', version: '0.1.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await runtime.server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, runtime };
}

function parseToolResult(result: unknown) {
  const content = typeof result === 'object' && result !== null && 'content' in result
    ? (result as { content?: Array<{ type: string; text?: string }> }).content
    : undefined;
  const textChunk = content?.find((item) => item.type === 'text');
  return textChunk?.text ? JSON.parse(textChunk.text) : null;
}

async function closeContext(context: RuntimeContext) {
  await context.client.close();
  await context.runtime.server.close();
  context.runtime.store.close();
}

describe('MCP server', () => {
  it('exposes note-centric tools with correct read/write annotations', async () => {
    const context = await createConnectedContext();

    try {
      const listed = await context.client.listTools();
      const byName = new Map(listed.tools.map((tool) => [tool.name, tool]));

      expect(byName.get('list_decks')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('search_notes')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('get_notes')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('open_note_preview')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('ensure_deck')?.annotations?.readOnlyHint).toBe(false);
      expect(byName.get('add_note')?.annotations?.readOnlyHint).toBe(false);
      expect(byName.get('update_note')?.annotations?.readOnlyHint).toBe(false);
      expect(byName.get('set_note_cards_suspended')?.annotations?.readOnlyHint).toBe(false);
      expect(byName.get('delete_note')?.annotations?.destructiveHint).toBe(true);
      expect(byName.get('delete_notes_batch')?.annotations?.destructiveHint).toBe(true);

      expect(byName.has('create_draft')).toBe(false);
      expect(byName.has('list_starter_packs')).toBe(false);
      expect(byName.has('upsert_card_type_definition')).toBe(false);
      expect(byName.has('list_pack_manifests')).toBe(false);
    } finally {
      await closeContext(context);
    }
  });

  it('serves only the note-centric contracts resource', async () => {
    const context = await createConnectedContext();

    try {
      const resources = await context.client.listResources();
      const uris = resources.resources.map((resource) => resource.uri);

      expect(uris).toContain('anki://contracts/v1/tools');
      expect(uris).not.toContain('anki://catalog/card-types');
      expect(uris).not.toContain('anki://starter-packs/catalog');

      const contracts = await context.client.readResource({ uri: 'anki://contracts/v1/tools' });
      const payload = JSON.parse((contracts.contents[0] as { text: string }).text) as {
        tools?: Record<string, unknown>;
        sharedTypes?: Record<string, unknown>;
      };

      expect(payload).toHaveProperty('contractVersion', '1.0.0');
      expect(payload.tools).toHaveProperty('list_decks');
      expect(payload.tools).toHaveProperty('search_notes');
      expect(payload.tools).toHaveProperty('add_note');
      expect(payload.tools).toHaveProperty('update_note');
      expect(payload.tools).toHaveProperty('delete_note');
      expect(payload.tools).toHaveProperty('set_note_cards_suspended');
      expect(payload.tools).not.toHaveProperty('create_draft');
      expect(payload.tools).not.toHaveProperty('apply_starter_pack');
      expect(payload.tools).not.toHaveProperty('upsert_card_type_definition');
      expect(payload.sharedTypes).toHaveProperty('NoteRecord');
      expect(payload.sharedTypes).toHaveProperty('DeckSummary');
      expect(payload.sharedTypes).toHaveProperty('NoteTypeValidation');
    } finally {
      await closeContext(context);
    }
  });

  it('executes the note-centric review workflow through MCP tools', async () => {
    const context = await createConnectedContext();

    try {
      const ensured = parseToolResult(await context.client.callTool({
        name: 'ensure_deck',
        arguments: {
          profileId: 'default',
          deckName: 'Programming::TypeScript::Concept',
        },
      }));
      expect(ensured.created).toBe(true);

      const upsertNoteType = parseToolResult(await context.client.callTool({
        name: 'upsert_note_type',
        arguments: {
          profileId: 'default',
          modelName: 'ts.v1.concept',
          dryRun: false,
          fields: [
            { name: 'Prompt' },
            { name: 'Answer' },
            { name: 'DetailedExplanation' },
          ],
          templates: [
            {
              name: 'Card 1',
              front: '<div>{{Prompt}}</div>',
              back: '{{FrontSide}}<hr id="answer"><div>{{Answer}}</div>{{#DetailedExplanation}}<div>{{DetailedExplanation}}</div>{{/DetailedExplanation}}',
            },
          ],
          css: '.card { color: white; background: black; }',
        },
      }));
      expect(upsertNoteType.result.status).toBe('created');
      expect(upsertNoteType.result.validation.canApply).toBe(true);
      expect(upsertNoteType.result.validation.errors).toEqual([]);

      const added = parseToolResult(await context.client.callTool({
        name: 'add_note',
        arguments: {
          profileId: 'default',
          clientRequestId: 'mcp-server-test-1',
          deckName: 'Programming::TypeScript::Concept',
          modelName: 'ts.v1.concept',
          fields: {
            Prompt: 'any と unknown の違いは？',
            Answer: 'unknown は絞り込みが必要です。',
            DetailedExplanation: '安全に使うには型を狭めます。',
          },
          tags: ['language::typescript', 'card::concept'],
        },
      }));

      expect(added.reviewPending).toBe(true);
      expect(added.note.deckName).toBe('Programming::TypeScript::Concept');
      expect(added.note.tags).toEqual(['card::concept', 'language::typescript']);

      const preview = parseToolResult(await context.client.callTool({
        name: 'open_note_preview',
        arguments: {
          profileId: 'default',
          noteId: added.note.noteId,
        },
      }));
      expect(preview.preview.opened).toBe(true);

      const inspected = parseToolResult(await context.client.callTool({
        name: 'get_notes',
        arguments: {
          profileId: 'default',
          noteIds: [added.note.noteId],
        },
      }));
      expect(inspected.results[0].ok).toBe(true);
      expect(inspected.results[0].note.fields.Prompt).toContain('any');

      const searched = parseToolResult(await context.client.callTool({
        name: 'search_notes',
        arguments: {
          profileId: 'default',
          deckNames: ['Programming::TypeScript::Concept'],
          modelNames: ['ts.v1.concept'],
        },
      }));
      expect(searched.notes.map((note: { noteId: number }) => note.noteId)).toContain(added.note.noteId);

      const updated = parseToolResult(await context.client.callTool({
        name: 'update_note',
        arguments: {
          profileId: 'default',
          noteId: added.note.noteId,
          expectedModTimestamp: added.note.modTimestamp,
          fields: {
            DetailedExplanation: 'unknown はそのまま使えず、型チェック後に利用します。',
          },
          tags: ['language::typescript', 'reviewed'],
        },
      }));
      expect(updated.note.fields.DetailedExplanation).toContain('型チェック');
      expect(updated.note.tags).toEqual(['language::typescript', 'reviewed']);

      const released = parseToolResult(await context.client.callTool({
        name: 'set_note_cards_suspended',
        arguments: {
          profileId: 'default',
          noteId: added.note.noteId,
          suspended: false,
        },
      }));
      expect(released.suspended).toBe(false);
      expect(released.cardIds).toEqual(added.note.cardIds);

      const deleted = parseToolResult(await context.client.callTool({
        name: 'delete_note',
        arguments: {
          profileId: 'default',
          noteId: added.note.noteId,
        },
      }));
      expect(deleted.status).toBe('deleted');

      const deletedAgain = parseToolResult(await context.client.callTool({
        name: 'delete_note',
        arguments: {
          profileId: 'default',
          noteId: added.note.noteId,
        },
      }));
      expect(deletedAgain.status).toBe('already_deleted');
    } finally {
      await closeContext(context);
    }
  });

  it('supports batch add/delete with mixed outcomes', async () => {
    const context = await createConnectedContext();

    try {
      await context.client.callTool({
        name: 'ensure_deck',
        arguments: {
          profileId: 'default',
          deckName: 'Programming::TypeScript::Output',
        },
      });

      await context.client.callTool({
        name: 'upsert_note_type',
        arguments: {
          profileId: 'default',
          modelName: 'ts.v1.output',
          dryRun: false,
          fields: [{ name: 'Code' }, { name: 'Expected' }],
          templates: [{
            name: 'Card 1',
            front: '<pre>{{Code}}</pre>',
            back: '{{FrontSide}}<hr id="answer"><div>{{Expected}}</div>',
          }],
        },
      });

      const added = parseToolResult(await context.client.callTool({
        name: 'add_notes_batch',
        arguments: {
          profileId: 'default',
          items: [
            {
              itemId: 'ok-1',
              clientRequestId: 'batch-1',
              deckName: 'Programming::TypeScript::Output',
              modelName: 'ts.v1.output',
              fields: {
                Code: 'console.log(1 + 1)',
                Expected: '2',
              },
            },
            {
              itemId: 'bad-1',
              clientRequestId: 'batch-2',
              deckName: 'Programming::TypeScript::Output',
              modelName: 'ts.v1.output',
              fields: {
                WrongField: 'x',
              },
            },
          ],
        },
      }));

      expect(added.summary).toEqual({ succeeded: 1, failed: 1 });
      expect(added.results.find((item: { itemId: string }) => item.itemId === 'ok-1')?.ok).toBe(true);
      expect(added.results.find((item: { itemId: string }) => item.itemId === 'bad-1')?.ok).toBe(false);

      const createdNoteId = added.results.find((item: { itemId: string }) => item.itemId === 'ok-1')?.note.noteId;
      const deleted = parseToolResult(await context.client.callTool({
        name: 'delete_notes_batch',
        arguments: {
          profileId: 'default',
          items: [
            { itemId: 'delete-created', noteId: createdNoteId },
            { itemId: 'delete-missing', noteId: 999999 },
          ],
        },
      }));

      expect(deleted.summary).toEqual({ succeeded: 2, failed: 0 });
      expect(deleted.results.find((item: { itemId: string }) => item.itemId === 'delete-created')?.status).toBe('deleted');
      expect(deleted.results.find((item: { itemId: string }) => item.itemId === 'delete-missing')?.status).toBe('already_deleted');
    } finally {
      await closeContext(context);
    }
  });

  it('returns PROFILE_SCOPE_MISMATCH when a write tool targets a non-active profile', async () => {
    const context = await createConnectedContext();

    try {
      const result = parseToolResult(await context.client.callTool({
        name: 'ensure_deck',
        arguments: {
          profileId: 'other-profile',
          deckName: 'Programming::TypeScript::Concept',
        },
      }));

      expect(result).toMatchObject({
        code: 'PROFILE_SCOPE_MISMATCH',
      });
    } finally {
      await closeContext(context);
    }
  });

  it('exposes note-type lint validation through MCP on dry-run', async () => {
    const context = await createConnectedContext();

    try {
      const result = parseToolResult(await context.client.callTool({
        name: 'upsert_note_type',
        arguments: {
          profileId: 'default',
          modelName: 'ts.v1.lint',
          fields: [{ name: 'Prompt' }],
          templates: [{
            name: 'Card 1',
            front: '{{#Hint}}<div>{{Prompt}}</div>',
            back: '{{FrontSide}}',
          }],
          css: '.card { color: white;',
        },
      }));

      expect(result.dryRun).toBe(true);
      expect(result.result.validation.canApply).toBe(false);
      expect(result.result.validation.errors.map((issue: { code: string }) => issue.code)).toContain('UNKNOWN_FIELD_REF');
      expect(result.result.validation.errors.map((issue: { code: string }) => issue.code)).toContain('INVALID_CSS_SYNTAX');
    } finally {
      await closeContext(context);
    }
  });
});
