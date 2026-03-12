## ADDED Requirements

### Requirement: Custom pack application through the starter-pack workflow
The MCP server MUST allow `apply_starter_pack` to provision registered custom pack manifests with the same dry-run/apply contract used for built-in packs.

#### Scenario: Dry-run custom pack application
- **WHEN** the client calls `apply_starter_pack` for a registered custom pack with `dryRun=true`
- **THEN** the server returns the note types, card type definitions, deck roots, and tag templates that would be created or updated
- **AND** no Anki model, custom card type definition, ownership record, or learning note is mutated

#### Scenario: Apply custom pack without creating notes
- **WHEN** the client calls `apply_starter_pack` for a registered custom pack with `dryRun=false`
- **THEN** the server provisions note types, custom card type definitions, deck roots, and ownership metadata only
- **AND** the operation does not create drafts or committed learning notes

### Requirement: Pack-owned resource safety
The MCP server MUST track which resources were provisioned by a custom pack and MUST reject unsafe takeover attempts.

#### Scenario: Reapply same pack to owned resources
- **WHEN** the same pack is reapplied to note types and custom card type definitions it already owns
- **THEN** the server may update those resources within the existing additive-safe note-type policy
- **AND** the response marks each resource as `unchanged` or `update`

#### Scenario: Reject resource takeover from another owner
- **WHEN** a custom pack apply would mutate a note type or custom card type definition that is owned by another pack or is unmanaged and incompatible
- **THEN** the server returns `CONFLICT`
- **AND** the response identifies the conflicting resource before any partial write

### Requirement: Ownership metadata is explicit
The MCP server MUST persist pack ownership metadata for provisioned resources so reapply and conflict detection remain deterministic.

#### Scenario: Record ownership on successful apply
- **WHEN** a custom pack apply succeeds
- **THEN** the server records ownership entries for each managed note type and custom card type definition under `(profileId, packId, resourceType, resourceId)`
- **AND** later dry-runs use the same ownership data to classify safe updates versus conflicts
