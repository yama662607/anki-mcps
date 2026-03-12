# pack-manifest-registry Specification

## Purpose
TBD - created by archiving change add-pack-manifest-authoring. Update Purpose after archive.
## Requirements
### Requirement: Profile-scoped pack manifest registry
The MCP server MUST support profile-scoped custom pack manifests so an agent can register reusable domain bootstraps without modifying MCP source code.

#### Scenario: Upsert custom pack manifest
- **WHEN** the client calls `upsert_pack_manifest` with `profileId`, `packId`, `version`, note types, card types, deck roots, tag templates, and supported options
- **THEN** the manifest is stored under `(profileId, packId)`
- **AND** a subsequent `get_pack_manifest` returns the stored manifest and metadata

#### Scenario: List active manifests
- **WHEN** the client calls `list_pack_manifests` for a profile without `includeDeprecated=true`
- **THEN** the server returns active custom pack manifests only
- **AND** each item includes `packId`, `label`, `version`, `domains`, `supportedOptions`, `source=custom`, `status`, and `updatedAt`

#### Scenario: Read one manifest
- **WHEN** the client calls `get_pack_manifest` with an existing `packId`
- **THEN** the server returns the full manifest payload for that profile
- **AND** the response includes deprecation metadata when applicable

### Requirement: Pack manifest validation and collision safety
The MCP server MUST reject invalid or unsafe custom pack manifests before storing them.

#### Scenario: Reject builtin pack id collision
- **WHEN** the client attempts to upsert a custom manifest whose `packId` matches a built-in pack
- **THEN** the server returns `CONFLICT`
- **AND** no custom manifest is stored

#### Scenario: Reject invalid manifest structure
- **WHEN** the client submits a manifest with duplicate note type names, duplicate card type identifiers, unsupported field metadata, or inconsistent required field references
- **THEN** the server returns `INVALID_ARGUMENT`
- **AND** the response identifies the invalid section without partial persistence

### Requirement: Pack manifest lifecycle is non-destructive
The MCP server MUST preserve auditability for custom pack manifests by deprecating them instead of deleting them.

#### Scenario: Deprecate manifest
- **WHEN** the client calls `deprecate_pack_manifest` for an existing custom pack
- **THEN** the manifest is marked `deprecated`
- **AND** it no longer appears in `list_starter_packs`
- **AND** it remains inspectable through `get_pack_manifest` and `list_pack_manifests(includeDeprecated=true)`

