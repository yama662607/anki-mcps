# Test Coverage

The note-centric workflow is covered at three layers.

## Service tests

- [noteAuthoringService.test.ts](../../tests/noteAuthoringService.test.ts)
- [noteTypeService.test.ts](../../tests/noteTypeService.test.ts)

Service-level note-centric assertions cover:

- deck discovery and explicit deck creation
- direct note creation and idempotent retry
- note inspection via search and get
- optimistic conflict detection for updates
- idempotent single and batch deletion

## MCP tests

- [mcpServer.test.ts](../../tests/mcpServer.test.ts)

MCP-level assertions cover:

- public tool visibility and read/write annotations
- removal of public `pack`, `card type definition`, and `draft` tools
- contract resource contents
- end-to-end `ensure_deck -> upsert_note_type -> add_note -> open_note_preview -> update/get/search/delete or unsuspend`, with extension-backed preview verified against later updates
- batch add/delete semantics

## Live smoke

- [scripts/e2e-real-anki.mjs](../../scripts/e2e-real-anki.mjs)

The live smoke script is intentionally small. It validates the real workflow against a running Anki profile without introducing its own rendering model.
