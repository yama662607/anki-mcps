## MODIFIED Requirements

### Requirement: Safety-Oriented Tool Segmentation
The MCP server MUST segment tools by risk so read-only and write operations are clearly distinguishable and independently controllable.

#### Scenario: Read-only tools do not mutate state
- **WHEN** the client calls discovery, inspection, or catalog tools such as `list_card_types`, `get_card_type_schema`, `list_starter_packs`, `list_pack_manifests`, `get_pack_manifest`, `get_draft`, or `list_drafts`
- **THEN** the server performs no Anki write action and returns deterministic responses

#### Scenario: Write operations require explicit tool call
- **WHEN** pack manifests, note types, card type definitions, or card data are being prepared
- **THEN** no persistent write beyond the explicit target operation occurs until a mutating tool such as `upsert_pack_manifest`, `deprecate_pack_manifest`, `apply_starter_pack`, `create_draft`, `commit_draft`, or `discard_draft` is invoked

#### Scenario: Write operations require explicit profile
- **WHEN** a mutating tool such as `upsert_pack_manifest`, `deprecate_pack_manifest`, `upsert_note_type`, `upsert_card_type_definition`, `apply_starter_pack`, `create_draft`, `commit_draft`, `discard_draft`, or `cleanup_drafts` is called without `profileId`
- **THEN** the server returns `PROFILE_REQUIRED`
- **AND** performs no mutation

### Requirement: Frozen v1 Tool Schema Registry
The MCP server MUST publish frozen v1 JSON Schemas for each tool and a shared-type registry so all clients implement identical contracts.

#### Scenario: Tool schemas are discoverable
- **WHEN** a client reads the contract resource URI
- **THEN** it receives request/response JSON Schemas for `list_card_types`, `get_card_type_schema`, `list_starter_packs`, `list_pack_manifests`, `get_pack_manifest`, `upsert_pack_manifest`, `deprecate_pack_manifest`, `apply_starter_pack`, `create_draft`, `open_draft_preview`, `commit_draft`, `discard_draft`, `list_drafts`, and `cleanup_drafts`

#### Scenario: Contract URI is stable
- **WHEN** a client discovers resources for tool contracts
- **THEN** it can read `anki://contracts/v1/tools` for v1 schemas and use that URI as a stable cache key

#### Scenario: Shared types are versioned with tool schemas
- **WHEN** a client reads the same contract resource
- **THEN** shared schemas include `CardTypeSummary`, `FieldSchema`, `DraftRecord`, `DraftListItem`, `StarterPackSummary`, `StarterPackManifest`, and pack-manifest registry result shapes under the same `contractVersion`

#### Scenario: Contract updates are explicit
- **WHEN** any required field, enum meaning, or dynamic-option contract changes incompatibly
- **THEN** the server increments major contract version and keeps prior major version available during migration window
