## ADDED Requirements

### Requirement: Profile-Scoped Custom CardType Registry
The MCP server MUST support custom card type definitions stored per profile.

#### Scenario: Upsert custom card type definition
- **WHEN** the client calls `upsert_card_type_definition` with valid schema and `profileId`
- **THEN** the definition is stored under `(profileId, cardTypeId)`
- **AND** subsequent reads return the updated definition

#### Scenario: Reject cross-profile mutation
- **WHEN** a write targets a different profile scope than request context
- **THEN** the server returns `PROFILE_SCOPE_MISMATCH`

### Requirement: Merged Catalog Resolution
Catalog tools MUST resolve definitions from merged sources: custom registry and builtin catalog.

#### Scenario: Custom definition appears in list
- **WHEN** `list_card_types` is called for a profile with custom definitions
- **THEN** the response includes both builtin and custom entries
- **AND** each entry includes a `source` marker (`builtin` or `custom`)

#### Scenario: ID collision is blocked
- **WHEN** a custom definition uses an existing builtin `cardTypeId`
- **THEN** the server rejects the upsert with `CONFLICT`
- **AND** does not shadow builtin behavior silently

### Requirement: Staged Creation Compatibility With Custom Types
Existing staged-card lifecycle MUST work with custom card type definitions.

#### Scenario: Create staged card from custom type
- **WHEN** the client calls `create_staged_card` with a custom `cardTypeId`
- **THEN** validation and field normalization use the custom schema
- **AND** the created note uses the mapped note type and default deck from that definition

#### Scenario: Existing builtin flows remain stable
- **WHEN** the client uses a builtin `cardTypeId`
- **THEN** behavior remains backward-compatible with v1 contracts
- **AND** no additional required input fields are introduced
