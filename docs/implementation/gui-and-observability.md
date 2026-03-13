# GUI and Observability

## GUI preview

- Setup check tool: `get_runtime_status`
- Preview tool: `open_note_preview`
- Primary path: `guiPreviewNote` from the optional `anki-connect-extension`, implemented as a read-only native previewer
- Fallback path: `guiBrowse -> guiSelectCard -> guiEditNote`

The MCP server does not render HTML itself. Preview is delegated to the running Anki app so rendering stays faithful to the real note type and collection state. When the extension path is available, preview is read-only and does not depend on AnkiConnect's live editor dialog lifecycle.

## Human review loop

1. `get_runtime_status`
2. `add_note` or `add_notes_batch`
3. `open_note_preview`
4. user sends natural-language feedback
5. agent calls `update_note`, `delete_note`, or `set_note_cards_suspended`

There is no separate public commit checklist object anymore.

## Structured errors

- `INVALID_ARGUMENT`
- `NOT_FOUND`
- `CONFLICT`
- `DEPENDENCY_UNAVAILABLE`
- `PROFILE_REQUIRED`
- `PROFILE_SCOPE_MISMATCH`
- `FORBIDDEN_OPERATION`

Source: [errors.ts](../../src/contracts/errors.ts)

## Audit logging

Review-state transitions are emitted as structured JSON to stderr.

Current event families:

- `note_created`
- `note_updated`
- `note_deleted`
- `note_suspended`
- `note_unsuspended`

Field contents are intentionally excluded from logs by default.

## Internal persistence

- DB default: `.data/anki-mcps.sqlite`
- Env override: `ANKI_MCPS_DB_PATH`
- Backward-compatible fallback: `DRAFT_DB_PATH`

This storage is internal metadata only. Public clients should not depend on table names or internal rows.
