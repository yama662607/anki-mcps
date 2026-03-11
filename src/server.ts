import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnkiConnectGateway } from './gateway/ankiConnectGateway.js';
import { MemoryGateway } from './gateway/memoryGateway.js';
import { DraftStore } from './persistence/draftStore.js';
import { CatalogService } from './services/catalogService.js';
import { DraftService } from './services/draftService.js';
import { NoteTypeService } from './services/noteTypeService.js';
import { registerMcpHandlers } from './mcp/register.js';

export type AppRuntime = {
  server: McpServer;
  store: DraftStore;
};

export function createRuntime(): AppRuntime {
  const activeProfileId = process.env.ANKI_ACTIVE_PROFILE;
  const dataDir = resolve(process.cwd(), '.data');
  mkdirSync(dataDir, { recursive: true });

  const dbPath = process.env.DRAFT_DB_PATH ?? resolve(dataDir, 'drafts.sqlite');
  const stagedMarkerTag = process.env.STAGED_MARKER_TAG ?? '__mcp_staged';

  const gatewayMode = process.env.ANKI_GATEWAY_MODE ?? 'anki-connect';
  const gateway = gatewayMode === 'memory' ? new MemoryGateway() : new AnkiConnectGateway();

  const store = new DraftStore(dbPath);
  const catalogService = new CatalogService(store);
  const draftService = new DraftService(store, catalogService, gateway, {
    activeProfileId,
    stagedMarkerTag,
  });
  const noteTypeService = new NoteTypeService(gateway, { activeProfileId });

  const server = new McpServer(
    {
      name: 'anki-mcps',
      version: '0.1.0',
    },
    {
      instructions: [
        'Use this flow for card creation: list_card_types -> get_card_type_schema -> create_draft -> open_draft_preview -> commit_draft or discard_draft.',
        'Use note-type authoring as: list_note_types -> get_note_type_schema -> upsert_note_type(dryRun=true) -> upsert_note_type(dryRun=false) -> upsert_card_type_definition.',
        'Use authoring management as: list_card_type_definitions -> deprecate_card_type_definition, and draft inspection as get_draft.',
        'For multiple notes, prefer create_drafts_batch and batch finalize tools with explicit per-item review decisions.',
        'Never commit without explicit user approval in natural language.',
        'Write tools require explicit profileId and create_draft requires clientRequestId.',
      ].join(' '),
    },
  );

  registerMcpHandlers(server, { catalogService, draftService, noteTypeService });

  return { server, store };
}

export async function runStdioServer(): Promise<void> {
  const runtime = createRuntime();
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    try {
      await runtime.server.close();
    } finally {
      runtime.store.close();
    }
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  await runtime.server.connect(transport);
}
