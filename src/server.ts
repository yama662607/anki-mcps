import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AnkiConnectGateway } from "./gateway/ankiConnectGateway.js";
import { MemoryGateway } from "./gateway/memoryGateway.js";
import { registerMcpHandlers } from "./mcp/register.js";
import { AuthoringStore } from "./persistence/authoringStore.js";
import { MediaService } from "./services/mediaService.js";
import { NoteAuthoringService } from "./services/noteAuthoringService.js";
import { NoteTypeService } from "./services/noteTypeService.js";
import { RuntimeStatusService } from "./services/runtimeStatusService.js";

const packageJsonUrl = [
  new URL("../package.json", import.meta.url),
  new URL("../../package.json", import.meta.url),
].find((candidate) => existsSync(candidate));

if (!packageJsonUrl) {
  throw new Error("Unable to locate package.json for MCP runtime version metadata.");
}

const appVersion = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version: string };

export type AppRuntime = {
  server: McpServer;
  store: AuthoringStore;
};

export function createRuntime(): AppRuntime {
  const activeProfileId = process.env.ANKI_ACTIVE_PROFILE;
  const dataDir = resolve(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });

  const dbPath =
    process.env.ANKI_MCP_DB_PATH ??
    process.env.ANKI_MCPS_DB_PATH ??
    process.env.DRAFT_DB_PATH ??
    resolve(dataDir, "anki-mcp.sqlite");

  const gatewayMode = process.env.ANKI_GATEWAY_MODE ?? "anki-connect";
  const gateway = gatewayMode === "memory" ? new MemoryGateway() : new AnkiConnectGateway();

  const store = new AuthoringStore(dbPath);
  const noteTypeService = new NoteTypeService(gateway, { activeProfileId });
  const noteAuthoringService = new NoteAuthoringService(store, gateway, { activeProfileId });
  const mediaService = new MediaService(gateway, { activeProfileId });
  const runtimeStatusService = new RuntimeStatusService(gateway, { activeProfileId });

  const server = new McpServer(
    {
      name: "anki-mcp",
      version: appVersion.version,
    },
    {
      instructions: [
        "Use official Anki concepts only: profile, deck, note type, note, card, tag, and media.",
        "When setup is uncertain, call get_runtime_status first to confirm AnkiConnect reachability and preview mode.",
        "Discover structure with list_decks, list_note_types, get_note_type_schema, search_notes, and get_notes.",
        "Prepare deck targets with ensure_deck and author note types with upsert_note_type when needed.",
        "Create review-pending notes with add_note or add_notes_batch, then inspect with open_note_preview.",
        "After review, either update_note, delete_note, or release cards with set_note_cards_suspended(suspended=false).",
        "Use import_media_asset before add_note when a field should contain an Anki media token.",
        "Write tools require explicit profileId.",
      ].join(" "),
    }
  );

  registerMcpHandlers(server, {
    noteTypeService,
    noteAuthoringService,
    mediaService,
    runtimeStatusService,
  });

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

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  await runtime.server.connect(transport);
}
