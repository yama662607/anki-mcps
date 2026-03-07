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
      expect(byName.get('discard_staged_card')?.annotations?.destructiveHint).toBe(true);
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
      expect(payload.tools).toHaveProperty('upsert_note_type');
      expect(payload.tools).toHaveProperty('upsert_card_type_definition');
    } finally {
      await closeContext(context);
    }
  });

  it('executes note-type authoring and staged creation through MCP tools', async () => {
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

      const staged = parseToolResult(await context.client.callTool({
        name: 'create_staged_card',
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

      expect(staged.draft.cardTypeId).toBe('programming.v1.ts-concept');
      expect(staged.draft.deckName).toBe('Programming::TypeScript::Concept');

      const preview = parseToolResult(await context.client.callTool({
        name: 'open_staged_card_preview',
        arguments: {
          profileId: 'default',
          draftId: staged.draft.draftId,
        },
      }));

      expect(preview.preview.opened).toBe(true);
      expect(preview.preview.selectedNoteId).toBe(staged.draft.noteId);
    } finally {
      await closeContext(context);
    }
  });
});
