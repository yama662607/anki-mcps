## 1. Contracts and Persistence

- [x] 1.1 Add contract types and JSON Schemas for `list_pack_manifests`, `get_pack_manifest`, `upsert_pack_manifest`, and `deprecate_pack_manifest`
- [x] 1.2 Generalize starter-pack option schemas so `apply_starter_pack` validates manifest-defined option keys instead of a fixed options object
- [x] 1.3 Extend the SQLite store with custom pack manifest records and pack-owned resource bindings
- [x] 1.4 Add persistence tests for manifest storage, deprecation, and ownership binding lookups

## 2. Registry Services and MCP Tools

- [x] 2.1 Implement a pack manifest registry service with validation, builtin-pack collision checks, and profile scoping
- [x] 2.2 Register MCP handlers for `list_pack_manifests`, `get_pack_manifest`, `upsert_pack_manifest`, and `deprecate_pack_manifest`
- [x] 2.3 Extend `list_starter_packs` and the starter-pack catalog resource to merge built-in packs with active custom manifests
- [x] 2.4 Update the contract resource payload so the new tools and shared types are discoverable by agents

## 3. Pack Application Safety

- [x] 3.1 Refactor pack resolution so `apply_starter_pack` can load either a built-in manifest or a stored custom manifest
- [x] 3.2 Implement dynamic option validation against manifest-declared `supportedOptions`, including required/default handling
- [x] 3.3 Add ownership-aware dry-run/apply planning so custom packs can safely update only resources they already own
- [x] 3.4 Reject conflicting takeovers of unmanaged or differently-owned note types and card type definitions with structured `CONFLICT` errors

## 4. Tests and Operational Coverage

- [x] 4.1 Add service tests for registry operations, dynamic options, and ownership conflict detection
- [x] 4.2 Add MCP tests for the new registry tools and merged starter-pack discovery/apply contracts
- [x] 4.3 Extend the real-Anki smoke workflow to cover one minimal registered custom pack through `apply -> create_draft -> open_draft_preview -> discard_draft`

## 5. Documentation and Validation

- [x] 5.1 Add docs showing how an agent can invent a new reusable domain pack without editing MCP source code
- [x] 5.2 Document the ownership/conflict rules and rollback playbook for custom pack manifests
- [x] 5.3 Validate with `openspec validate add-pack-manifest-authoring --strict`, `npm run typecheck`, `npm test`, and `npm run build`
