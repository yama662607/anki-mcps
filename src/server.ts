import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnkiConnectGateway } from './gateway/ankiConnectGateway.js';
import { MemoryGateway } from './gateway/memoryGateway.js';
import { DraftStore } from './persistence/draftStore.js';
import { CatalogService } from './services/catalogService.js';
import { DraftService } from './services/draftService.js';
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
  const catalogService = new CatalogService();
  const draftService = new DraftService(store, catalogService, gateway, {
    activeProfileId,
    stagedMarkerTag,
  });

  const server = new McpServer({
    name: 'anki-mcps',
    version: '0.1.0',
  });

  registerMcpHandlers(server, { catalogService, draftService });

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
