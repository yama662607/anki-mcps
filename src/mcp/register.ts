import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  addNoteInputSchema,
  addNotesBatchInputSchema,
  deleteNoteInputSchema,
  deleteNotesBatchInputSchema,
  ensureDeckInputSchema,
  getNotesInputSchema,
  getNoteTypeSchemaInputSchema,
  getRuntimeStatusInputSchema,
  importMediaAssetInputSchema,
  listDecksInputSchema,
  listNoteTypesInputSchema,
  openNotePreviewInputSchema,
  searchNotesInputSchema,
  setNoteCardsSuspendedInputSchema,
  updateNoteInputSchema,
  upsertNoteTypeInputSchema,
} from "../contracts/schemas.js";
import type { MediaService } from "../services/mediaService.js";
import type { NoteAuthoringService } from "../services/noteAuthoringService.js";
import type { NoteTypeService } from "../services/noteTypeService.js";
import type { RuntimeStatusService } from "../services/runtimeStatusService.js";
import { getContractsResourcePayload } from "./contractsResource.js";
import { errorResult, parseOrThrow, successResult } from "./result.js";

export function registerMcpHandlers(
  server: McpServer,
  services: {
    noteTypeService: NoteTypeService;
    noteAuthoringService: NoteAuthoringService;
    mediaService: MediaService;
    runtimeStatusService: RuntimeStatusService;
  }
) {
  server.registerResource(
    "tool_contracts_v1",
    "anki://contracts/v1/tools",
    {
      title: "Anki MCP v1 Tool Contracts",
      description: "Frozen tool schemas and shared type registry for the note-centric public API.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(getContractsResourcePayload(), null, 2),
        },
      ],
    })
  );

  server.registerTool(
    "get_runtime_status",
    {
      title: "Get Runtime Status",
      description:
        "Report whether AnkiConnect is reachable and whether preview can use the optional extension path.",
      inputSchema: getRuntimeStatusInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.runtimeStatusService.getRuntimeStatus(
            parseOrThrow(getRuntimeStatusInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_decks",
    {
      title: "List Decks",
      description: "List available Anki decks using official hierarchical deck names.",
      inputSchema: listDecksInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.listDecks(parseOrThrow(listDecksInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "list_note_types",
    {
      title: "List Note Types",
      description: "Return available Anki note types with field and template summaries.",
      inputSchema: listNoteTypesInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteTypeService.listNoteTypes(
            parseOrThrow(listNoteTypesInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_note_type_schema",
    {
      title: "Get Note Type Schema",
      description: "Inspect fields, templates, CSS, and field bindings for one note type.",
      inputSchema: getNoteTypeSchemaInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteTypeService.getNoteTypeSchema(
            parseOrThrow(getNoteTypeSchemaInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search Notes",
      description: "Search existing notes by Anki query, note type, deck, or tag filters.",
      inputSchema: searchNotesInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.searchNotes(
            parseOrThrow(searchNotesInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_notes",
    {
      title: "Get Notes",
      description: "Read concrete note fields and metadata by note ID.",
      inputSchema: getNotesInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.getNotes(parseOrThrow(getNotesInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "ensure_deck",
    {
      title: "Ensure Deck",
      description: "Create a deck if missing. Safe and idempotent.",
      inputSchema: ensureDeckInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.ensureDeck(parseOrThrow(ensureDeckInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "upsert_note_type",
    {
      title: "Upsert Note Type",
      description:
        "Dry-run by default. Create or update a note type with additive-safe constraints.",
      inputSchema: upsertNoteTypeInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteTypeService.upsertNoteType(
            parseOrThrow(upsertNoteTypeInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "add_note",
    {
      title: "Add Note",
      description: "Create a review-pending note directly from deck, note type, fields, and tags.",
      inputSchema: addNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.addNote(parseOrThrow(addNoteInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "add_notes_batch",
    {
      title: "Add Notes Batch",
      description: "Create multiple review-pending notes with stable per-item outcomes.",
      inputSchema: addNotesBatchInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.addNotesBatch(
            parseOrThrow(addNotesBatchInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "update_note",
    {
      title: "Update Note",
      description: "Update note fields or tags with optimistic mod-timestamp conflict detection.",
      inputSchema: updateNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.updateNote(parseOrThrow(updateNoteInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete Note",
      description: "Delete a note directly by note ID. Idempotent when already missing.",
      inputSchema: deleteNoteInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.deleteNote(parseOrThrow(deleteNoteInputSchema, input))
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "delete_notes_batch",
    {
      title: "Delete Notes Batch",
      description: "Delete multiple notes with stable per-item outcomes.",
      inputSchema: deleteNotesBatchInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.deleteNotesBatch(
            parseOrThrow(deleteNotesBatchInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "open_note_preview",
    {
      title: "Open Note Preview",
      description: "Open the existing note in Anki Browser preview for human review.",
      inputSchema: openNotePreviewInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.openNotePreview(
            parseOrThrow(openNotePreviewInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "set_note_cards_suspended",
    {
      title: "Set Note Cards Suspended",
      description: "Suspend or unsuspend all cards generated from one note.",
      inputSchema: setNoteCardsSuspendedInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.noteAuthoringService.setNoteCardsSuspended(
            parseOrThrow(setNoteCardsSuspendedInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "import_media_asset",
    {
      title: "Import Media Asset",
      description:
        "Import a local audio or image file into Anki media and return an Anki-ready field value.",
      inputSchema: importMediaAssetInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        return successResult(
          await services.mediaService.importMediaAsset(
            parseOrThrow(importMediaAssetInputSchema, input)
          )
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
