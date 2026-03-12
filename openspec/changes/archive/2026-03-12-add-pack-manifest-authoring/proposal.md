## Why

The current MCP can create new note types, card type definitions, and draft cards without source changes, but it cannot persist a newly invented domain as a reusable pack. New starter packs are still hard-coded in `src/contracts/starterPacks.ts`, which means an agent can prototype new material but cannot register it for later reuse without editing the MCP codebase.

## What Changes

- Add profile-scoped pack manifest authoring tools so an agent can register, inspect, list, and deprecate reusable custom packs without modifying MCP source code.
- Extend pack application so the existing pack workflow can apply both built-in packs and registered custom manifests through one contract.
- Define a stable manifest schema for custom packs that can provision note types, card type definitions, deck roots, and tag templates.
- Add validation, safety rules, docs, and regression coverage for custom pack authoring and application.

## Capabilities

### New Capabilities
- `pack-manifest-registry`: Store and manage profile-scoped reusable pack manifests through MCP tools.
- `pack-manifest-application`: Apply registered pack manifests with the same dry-run/apply safety model used for built-in packs.
- `pack-manifest-quality-gates`: Add tests and documentation that lock the registry, validation, and application workflow.

### Modified Capabilities
- `starter-pack-provisioning`: Expand discovery and apply behavior so built-in and custom packs share a unified catalog and application contract.
- `mcp-safety-and-contract`: Extend frozen tool/resource contracts for the new pack authoring tools and error cases.

## Impact

- Affected code: `src/services/starterPackService.ts`, `src/contracts/starterPacks.ts`, `src/contracts/schemas.ts`, `src/contracts/toolContracts.ts`, `src/mcp/register.ts`, persistence layer, docs, and tests.
- New MCP tools/resources will be added for pack authoring and inspection.
- Draft-based card creation, preview, commit, and discard workflows remain unchanged and must be reused by custom packs.
