# 5-Minute Quick Start

This is the shortest path from zero to a working `anki-mcps` setup.

## 1. Install the package

```bash
npm install -g anki-mcps
```

## 2. Start Anki

Requirements:

- Anki is running
- AnkiConnect is installed and enabled
- optional: `anki-connect-extension` is installed if you want a read-only native preview instead of edit-dialog fallback

By default, `anki-mcps` talks to:

```text
http://127.0.0.1:8765
```

## 3. Add the MCP server to your client

### Codex

Recommended:

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

If your client uses `mcpServers` JSON, use:

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

## 4. Verify that the connection works

Ask your agent to call:

- `get_runtime_status`

This tells you whether:

- AnkiConnect is reachable
- the optional extension preview path is available as a read-only native previewer
- the server is accidentally running in memory mode

## 5. Follow the normal authoring flow

The intended flow is:

1. Inspect existing structure with `list_decks`, `list_note_types`, `get_note_type_schema`, `search_notes`, and `get_notes`
2. Create missing decks with `ensure_deck`
3. Create or revise note types with `upsert_note_type(dryRun=true)`
4. Add notes with `add_note` or `add_notes_batch`
5. Open the real Anki preview with `open_note_preview`
6. Revise with `update_note`, delete with `delete_note`, or release cards with `set_note_cards_suspended(false)`

## 6. Minimal first task

A good first request to your agent is:

```text
List my existing decks and note types, then explain which note type is best suited for adding a simple concept card.
```

That forces the agent to inspect the current collection before writing anything.

## Troubleshooting

- `Failed to fetch`: Anki or AnkiConnect is not reachable at `ANKI_CONNECT_URL`
- preview opens the edit dialog instead: install `anki-connect-extension` if you want the safer read-only native preview path
- write tools reject with `PROFILE_SCOPE_MISMATCH`: pass the correct `profileId`

## Next docs

- [Operating model](implementation/anki-operating-model.md)
- [Contracts and tool surface](implementation/contracts-and-catalog.md)
- [Note type authoring](implementation/note-type-authoring.md)
