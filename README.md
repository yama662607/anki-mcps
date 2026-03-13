# anki-mcps

[![npm version](https://img.shields.io/npm/v/anki-mcps)](https://www.npmjs.com/package/anki-mcps)
[![CI](https://github.com/yama662607/anki-mcps/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yama662607/anki-mcps/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

MCP server for safe, review-first Anki authoring built on official Anki concepts: `profile`, `deck`, `note type`, `note`, `card`, `tag`, and `media`.

It is designed for agents that need to inspect existing Anki structure, create or revise note types, add notes, preview the real Anki rendering, and only then release cards into study.

## Why this exists

- avoid custom abstractions on top of Anki's own data model
- keep note creation review-first by suspending new cards until they are accepted
- let agents learn from existing decks and note types before writing new content
- keep note type changes additive-safe and validate them before apply

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

## Requirements

- Node.js 22+
- Anki with AnkiConnect enabled
- optional: the `anki-connect-extension` add-on for read-only native preview instead of edit-dialog fallback

## Quick start

1. Install `anki-mcps` from npm.
2. Start Anki with AnkiConnect enabled.
3. Add the MCP server to your client.
4. Ask the agent to run `get_runtime_status` first.
5. Use the review-first flow: `add_note` -> `open_note_preview` -> `update_note` or `set_note_cards_suspended(false)`.

For a first-time setup guide, see [5-minute quick start](docs/quickstart.md).

## Dependency model

- `AnkiConnect` is required for real Anki usage
- `anki-connect-extension` is optional and provides a read-only native preview path
- without the extension, `open_note_preview` falls back to opening the edit dialog
- in `ANKI_GATEWAY_MODE=memory`, neither dependency is required because the server is running in test mode

## Installation

### From npm

```bash
npm install -g anki-mcps
```

### From source

```bash
npm install
npm run build
```

## Running

### As a local command

```bash
anki-mcps
```

### From source

```bash
npm run dev
```

## MCP client setup

### Codex

Official Codex setup is `codex mcp add` or `~/.codex/config.toml`.

Add the server with the CLI:

```bash
codex mcp add anki-mcps \
  --env ANKI_CONNECT_URL=http://127.0.0.1:8765 \
  --env ANKI_ACTIVE_PROFILE=default \
  -- anki-mcps
```

Equivalent `~/.codex/config.toml` entry:

```toml
[mcp_servers.anki-mcps]
command = "anki-mcps"

[mcp_servers.anki-mcps.env]
ANKI_ACTIVE_PROFILE = "default"
ANKI_CONNECT_URL = "http://127.0.0.1:8765"
```

### Claude-style clients

Some MCP clients use `mcpServers` JSON instead.

```json
{
  "mcpServers": {
    "anki-mcps": {
      "command": "anki-mcps",
      "env": {
        "ANKI_CONNECT_URL": "http://127.0.0.1:8765",
        "ANKI_ACTIVE_PROFILE": "default"
      }
    }
  }
}
```

## Environment

- `ANKI_CONNECT_URL` default: `http://127.0.0.1:8765`
- `ANKI_ACTIVE_PROFILE` optional fallback for read tools
- `ANKI_MCPS_DB_PATH` default: `.data/anki-mcps.sqlite`
- `ANKI_GATEWAY_MODE=memory` for deterministic local tests without Anki

`ANKI_MCPS_DB_PATH` is the internal SQLite path used for idempotency and operational metadata. `DRAFT_DB_PATH` is still accepted as a backward-compatible fallback.

## Core workflow

1. Verify setup with `get_runtime_status`.
2. Discover existing structure with `list_decks`, `list_note_types`, `get_note_type_schema`, `search_notes`, and `get_notes`.
3. Create missing decks with `ensure_deck`.
4. Create or revise note types with `upsert_note_type(dryRun=true)` and inspect `result.validation`.
5. Add review-pending content with `add_note` or `add_notes_batch`.
6. Inspect the real Anki rendering with `open_note_preview` (the extension path uses a read-only native previewer, not a live editor dialog).
7. After user feedback, call `update_note`, `delete_note`, or `set_note_cards_suspended(suspended=false)`.

## Media workflow

1. `import_media_asset`
2. Insert returned `asset.fieldValue` into the target note field
3. `add_note` or `update_note`
4. `open_note_preview`

## Main docs

- [5-minute quick start](docs/quickstart.md)
- [Operating model](docs/implementation/anki-operating-model.md)
- [Contracts and tool surface](docs/implementation/contracts-and-catalog.md)
- [Note type authoring](docs/implementation/note-type-authoring.md)
- [Real Anki E2E](docs/implementation/e2e-real-anki.md)
- [Migration from pack/card-type APIs](docs/implementation/migration-note-centric.md)
- [Public release checklist](docs/implementation/public-release-checklist.md)

## License

MIT
