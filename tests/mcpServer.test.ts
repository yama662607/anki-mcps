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
  delete process.env.DRAFT_DB_PATH;
  delete process.env.ANKI_ACTIVE_PROFILE;
  try {
    rmSync(dbPath, { force: true });
  } catch {
    // ignore
  }
});

async function createConnectedContext(): Promise<RuntimeContext> {
  process.env.ANKI_GATEWAY_MODE = 'memory';
  process.env.DRAFT_DB_PATH = dbPath;
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
  it('exposes tool annotations for read/write boundaries', async () => {
    const context = await createConnectedContext();

    try {
      const listed = await context.client.listTools();
      const byName = new Map(listed.tools.map((tool) => [tool.name, tool]));

      expect(byName.get('list_note_types')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('upsert_note_type')?.annotations?.readOnlyHint).toBe(false);
      expect(byName.get('discard_draft')?.annotations?.destructiveHint).toBe(true);
      expect(byName.get('get_draft')?.annotations?.readOnlyHint).toBe(true);
      expect(byName.get('create_drafts_batch')?.annotations?.readOnlyHint).toBe(false);
    } finally {
      await closeContext(context);
    }
  });

  it('serves contracts and card-type catalog resources', async () => {
    const context = await createConnectedContext();

    try {
      const resources = await context.client.listResources();
      const uris = resources.resources.map((resource) => resource.uri);
      expect(uris).toContain('anki://contracts/v1/tools');
      expect(uris).toContain('anki://catalog/card-types');

      const contracts = await context.client.readResource({ uri: 'anki://contracts/v1/tools' });
      const payload = JSON.parse((contracts.contents[0] as { text: string }).text) as { tools?: Record<string, unknown> };
      expect(payload).toHaveProperty('contractVersion', '1.0.0');
      expect(payload.tools).toHaveProperty('upsert_note_type');
      expect(payload.tools).toHaveProperty('upsert_card_type_definition');
      expect(payload.tools).toHaveProperty('commit_draft');
      expect(payload.tools).toHaveProperty('get_draft');
      expect(payload.tools).toHaveProperty('create_drafts_batch');
      expect(payload.tools).toHaveProperty('list_card_type_definitions');
    } finally {
      await closeContext(context);
    }
  });

  it('executes note-type authoring and draft creation through MCP tools', async () => {
    const context = await createConnectedContext();

    try {
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

      const upsertCardType = parseToolResult(await context.client.callTool({
        name: 'upsert_card_type_definition',
        arguments: {
          profileId: 'default',
          definition: {
            cardTypeId: 'programming.v1.ts-concept',
            label: 'TypeScript Concept',
            modelName: 'ts.v1.concept',
            defaultDeck: 'Programming::TypeScript::Concept',
            requiredFields: ['Prompt', 'Answer'],
            optionalFields: ['DetailedExplanation'],
            renderIntent: 'production',
            allowedHtmlPolicy: 'safe_inline_html',
            fields: [
              { name: 'Prompt', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
              { name: 'Answer', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
              { name: 'DetailedExplanation', required: false, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html', multiline: true },
            ],
          },
        },
      }));

      expect(upsertCardType.cardType.cardTypeId).toBe('programming.v1.ts-concept');

      const draft = parseToolResult(await context.client.callTool({
        name: 'create_draft',
        arguments: {
          profileId: 'default',
          clientRequestId: 'mcp-server-test-1',
          cardTypeId: 'programming.v1.ts-concept',
          fields: {
            Prompt: 'any と unknown の違いは？',
            Answer: 'unknown は絞り込みが必要。',
            DetailedExplanation: '追加説明',
          },
        },
      }));

      expect(draft.draft.cardTypeId).toBe('programming.v1.ts-concept');
      expect(draft.draft.deckName).toBe('Programming::TypeScript::Concept');

      const preview = parseToolResult(await context.client.callTool({
        name: 'open_draft_preview',
        arguments: {
          profileId: 'default',
          draftId: draft.draft.draftId,
        },
      }));

      expect(preview.preview.opened).toBe(true);
      expect(preview.preview.selectedNoteId).toBe(draft.draft.noteId);
    } finally {
      await closeContext(context);
    }
  });

  it('returns structured MCP errors for invalid arguments and profile mismatches', async () => {
    const context = await createConnectedContext();

    try {
      const invalid = parseToolResult(await context.client.callTool({
        name: 'create_draft',
        arguments: {
          profileId: 'default',
          clientRequestId: 'mcp-server-test-invalid',
          cardTypeId: 'language.v1.basic-bilingual',
          fields: { Front: 'missing-back' },
        },
      }));

      expect(invalid.code).toBe('INVALID_ARGUMENT');
      expect(invalid.retryable).toBe(false);

      const draft = parseToolResult(await context.client.callTool({
        name: 'create_draft',
        arguments: {
          profileId: 'profile-a',
          clientRequestId: 'mcp-server-test-profile',
          cardTypeId: 'language.v1.basic-bilingual',
          fields: { Front: 'x', Back: 'y' },
        },
      }));

      const mismatch = parseToolResult(await context.client.callTool({
        name: 'commit_draft',
        arguments: {
          profileId: 'profile-b',
          draftId: draft.draft.draftId,
          reviewDecision: {
            targetIdentityMatched: true,
            questionConfirmed: true,
            answerConfirmed: true,
            reviewedAt: new Date().toISOString(),
            reviewer: 'user',
          },
        },
      }));

      expect(mismatch.code).toBe('PROFILE_SCOPE_MISMATCH');
      expect(mismatch.retryable).toBe(false);
    } finally {
      await closeContext(context);
    }
  });

  it('executes card-type lifecycle, draft inspection, and batch flows through MCP tools', async () => {
    const context = await createConnectedContext();

    try {
      const custom = parseToolResult(await context.client.callTool({
        name: 'upsert_card_type_definition',
        arguments: {
          profileId: 'default',
          definition: {
            cardTypeId: 'programming.v1.ts-output',
            label: 'TypeScript Output',
            modelName: 'Basic',
            defaultDeck: 'Programming::TypeScript::Output',
            requiredFields: ['Front', 'Back'],
            optionalFields: [],
            renderIntent: 'production',
            allowedHtmlPolicy: 'safe_inline_html',
            fields: [
              { name: 'Front', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
              { name: 'Back', required: true, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html' },
            ],
          },
        },
      }));

      expect(custom.cardType.cardTypeId).toBe('programming.v1.ts-output');

      const batchCreate = parseToolResult(await context.client.callTool({
        name: 'create_drafts_batch',
        arguments: {
          profileId: 'default',
          items: [
            {
              itemId: 'ok-1',
              clientRequestId: 'mcp-batch-1',
              cardTypeId: 'programming.v1.ts-output',
              fields: { Front: 'Q', Back: 'A' },
            },
            {
              itemId: 'bad-1',
              clientRequestId: 'mcp-batch-2',
              cardTypeId: 'programming.v1.ts-output',
              fields: { Front: 'Q only' },
            },
          ],
        },
      }));

      expect(batchCreate.summary).toEqual({ succeeded: 1, failed: 1 });
      expect(batchCreate.results[0]?.ok).toBe(true);
      expect(batchCreate.results[1]?.error?.code).toBe('INVALID_ARGUMENT');

      const stagedDraftId = batchCreate.results[0]?.draft?.draftId as string;

      const detail = parseToolResult(await context.client.callTool({
        name: 'get_draft',
        arguments: {
          profileId: 'default',
          draftId: stagedDraftId,
        },
      }));

      expect(detail.draft.draftId).toBe(stagedDraftId);
      expect(detail.cardType.cardTypeId).toBe('programming.v1.ts-output');

      const listedBefore = parseToolResult(await context.client.callTool({
        name: 'list_card_type_definitions',
        arguments: { profileId: 'default' },
      }));
      expect(listedBefore.items).toHaveLength(1);

      const deprecated = parseToolResult(await context.client.callTool({
        name: 'deprecate_card_type_definition',
        arguments: {
          profileId: 'default',
          cardTypeId: 'programming.v1.ts-output',
        },
      }));
      expect(deprecated.cardType.status).toBe('deprecated');

      const listedActive = parseToolResult(await context.client.callTool({
        name: 'list_card_type_definitions',
        arguments: { profileId: 'default' },
      }));
      expect(listedActive.items).toHaveLength(0);

      const listedAll = parseToolResult(await context.client.callTool({
        name: 'list_card_type_definitions',
        arguments: { profileId: 'default', includeDeprecated: true },
      }));
      expect(listedAll.items).toHaveLength(1);

      const rejected = parseToolResult(await context.client.callTool({
        name: 'create_draft',
        arguments: {
          profileId: 'default',
          clientRequestId: 'mcp-deprecated-1',
          cardTypeId: 'programming.v1.ts-output',
          fields: { Front: 'Q', Back: 'A' },
        },
      }));
      expect(rejected.code).toBe('CONFLICT');
    } finally {
      await closeContext(context);
    }
  });
});
