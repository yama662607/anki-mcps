## ADDED Requirements

### Requirement: Note Type Discovery Tools
The MCP server MUST provide read tools to discover note types and inspect schema details required for safe authoring.

#### Scenario: List note types
- **WHEN** the client calls `list_note_types`
- **THEN** the server returns note type summaries including `modelName`, `fieldNames`, and template names
- **AND** the operation does not mutate Anki state

#### Scenario: Inspect a note type
- **WHEN** the client calls `get_note_type_schema` with an existing `modelName`
- **THEN** the server returns fields, templates (`front`/`back`), CSS, and fields-on-templates mapping
- **AND** the response includes `contractVersion` and `profileId`

### Requirement: Safe Upsert for Note Types
The MCP server MUST provide an upsert tool for note type authoring with safe defaults.

#### Scenario: Dry-run by default
- **WHEN** the client calls `upsert_note_type` without `dryRun` explicitly set
- **THEN** the server performs validation and returns planned operations only
- **AND** no Anki note type mutation occurs

#### Scenario: Apply upsert explicitly
- **WHEN** the client calls `upsert_note_type` with `dryRun=false` and valid payload
- **THEN** the server creates or updates the target note type via AnkiConnect model actions
- **AND** returns applied operations and resulting schema summary

#### Scenario: Reject destructive change in Phase2
- **WHEN** payload requires removing or renaming existing fields/templates
- **THEN** the server rejects the request with `FORBIDDEN_OPERATION`
- **AND** includes hint to use a future explicit migration flow

### Requirement: Authoring Error Contract
Note type authoring failures MUST use the structured error envelope and deterministic codes.

#### Scenario: Unknown model reference
- **WHEN** the client requests schema for a non-existent model
- **THEN** the server returns `NOT_FOUND`

#### Scenario: Incompatible authoring payload
- **WHEN** the upsert payload violates field/template constraints
- **THEN** the server returns `INVALID_ARGUMENT` with field-level context

#### Scenario: Dependency failure
- **WHEN** AnkiConnect is unreachable or action invocation fails
- **THEN** the server returns `DEPENDENCY_UNAVAILABLE` and retry guidance
