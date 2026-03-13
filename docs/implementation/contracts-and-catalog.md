# Contracts and Tool Surface

The public contract is published at `anki://contracts/v1/tools`.

## Read-only tools

- `get_runtime_status`
- `list_decks`
- `list_note_types`
- `get_note_type_schema`
- `search_notes`
- `get_notes`
- `open_note_preview`

These tools must not mutate Anki state.

## Write tools

- `ensure_deck`
- `upsert_note_type`
- `add_note`
- `add_notes_batch`
- `update_note`
- `delete_note`
- `delete_notes_batch`
- `set_note_cards_suspended`
- `import_media_asset`

Every write tool requires explicit `profileId`.

## Shared response shapes

- `RuntimeStatus`
- `DeckSummary`
- `NoteSummary`
- `NoteRecord`
- `NoteTypeSummary`
- `NoteTypeSchema`
- `BatchSummary`
- `MediaAsset`

## Validation model

- note field names are validated against the live note type schema
- note type dry-runs return `result.status="invalid"` when `validation.canApply=false`
- unknown note types return `NOT_FOUND`
- unknown fields return `INVALID_ARGUMENT`
- stale `expectedModTimestamp` returns `CONFLICT`
- missing `profileId` on writes returns `PROFILE_REQUIRED`

## Removed public surfaces

These are intentionally no longer part of the public contract:

- `pack`
- `starter pack`
- `pack manifest`
- `card type definition`
- `draft`
