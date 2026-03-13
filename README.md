# anki-mcps

TypeScript MCP server for review-first Anki authoring built on official Anki concepts: `profile`, `deck`, `note type`, `note`, `card`, `tag`, and `media`.

## Features

- deck and note discovery for example-driven authoring
- additive-safe note type authoring with `dryRun=true` by default
- lightweight note type linting with structured `errors` and `warnings` before apply
- direct note creation with `modelName`, `deckName`, `fields`, and `tags`
- review-first isolation by suspending new cards until the user keeps them
- optimistic conflict detection for `update_note`
- batch add/delete note operations with stable per-item outcomes
- local media import for audio and image fields
- frozen v1 contract resource at `anki://contracts/v1/tools`

## Quick start

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Environment

- `ANKI_CONNECT_URL` default: `http://127.0.0.1:8765`
- `ANKI_ACTIVE_PROFILE` optional fallback for read tools
- `ANKI_MCPS_DB_PATH` default: `.data/anki-mcps.sqlite`
- `ANKI_GATEWAY_MODE=memory` for deterministic local tests without Anki

`ANKI_MCPS_DB_PATH` is the internal SQLite path used for idempotency and operational metadata. `DRAFT_DB_PATH` is still accepted as a backward-compatible fallback.

## Core workflow

1. Discover existing structure with `list_decks`, `list_note_types`, `get_note_type_schema`, `search_notes`, and `get_notes`.
2. Create missing decks with `ensure_deck`.
3. Create or revise note types with `upsert_note_type(dryRun=true)` and inspect `result.validation`.
4. Add review-pending content with `add_note` or `add_notes_batch`.
5. Inspect the real Anki rendering with `open_note_preview`.
6. After user feedback, call `update_note`, `delete_note`, or `set_note_cards_suspended(suspended=false)`.

## Media workflow

1. `import_media_asset`
2. Insert returned `asset.fieldValue` into the target note field
3. `add_note` or `update_note`
4. `open_note_preview`

## Main docs

- [Operating model](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/anki-operating-model.md)
- [Contracts and tool surface](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/contracts-and-catalog.md)
- [Note type authoring](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/note-type-authoring.md)
- [Real Anki E2E](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/e2e-real-anki.md)
- [Migration from pack/card-type APIs](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/migration-note-centric.md)
