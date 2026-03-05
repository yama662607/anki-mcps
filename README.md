# anki-mcps

TypeScript MCP server for staged, review-first Anki card creation.

## Features

- card type catalog + schema introspection
- strict field validation and HTML policy sanitization
- staged lifecycle (`create -> preview -> commit/discard`)
- deterministic conflict detection via fingerprints
- SQLite draft persistence with profile scoping
- frozen v1 contract resource (`anki://contracts/v1/tools`)

## Quick start

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Environment

- `ANKI_CONNECT_URL` (default `http://127.0.0.1:8765`)
- `ANKI_ACTIVE_PROFILE` (optional fallback for read tools)
- `DRAFT_DB_PATH` (default `.data/drafts.sqlite`)
- `STAGED_MARKER_TAG` (default `__mcp_staged`)
- `ANKI_GATEWAY_MODE=memory` for local deterministic testing without Anki

## Notes

- write tools require explicit `profileId`
- staged cards are suspended until committed
