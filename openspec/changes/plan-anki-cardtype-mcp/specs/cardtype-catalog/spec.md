## ADDED Requirements

### Requirement: Card Type Catalog Discovery
The MCP server MUST expose a stable catalog of supported card types so an agent can discover valid creation options without guessing model names or field names.

#### Scenario: List all available card types
- **WHEN** the client calls `list_card_types`
- **THEN** the server returns a deterministic list including `cardTypeId`, `label`, `modelName`, `defaultDeck`, and `requiredFields`

#### Scenario: Catalog response is version-aware
- **WHEN** the client calls `list_card_types`
- **THEN** the response includes a catalog version identifier that changes only when catalog definitions change

### Requirement: Card Type Schema Introspection
The MCP server MUST provide a per-card-type schema endpoint that defines required fields, optional fields, field data types, formatting hints, and examples.

#### Scenario: Retrieve schema for a valid card type
- **WHEN** the client calls `get_card_type_schema` with an existing `cardTypeId`
- **THEN** the server returns schema details including required and optional fields with validation metadata

#### Scenario: Reject unknown card type id
- **WHEN** the client calls `get_card_type_schema` with a non-existent `cardTypeId`
- **THEN** the server returns a structured `NOT_FOUND` error without mutating Anki state

### Requirement: Card Type Definition Minimum Metadata
The MCP server MUST enforce a minimum metadata contract for each card type so agents can choose templates safely without hidden assumptions.

#### Scenario: Catalog entries contain required metadata
- **WHEN** the client calls `list_card_types`
- **THEN** each entry includes `cardTypeId`, `label`, `modelName`, `defaultDeck`, `requiredFields`, `renderIntent`, and `allowedHtmlPolicy`

#### Scenario: Render intent is machine-selectable
- **WHEN** a client filters card types by usage purpose
- **THEN** `renderIntent` is one of `recognition`, `production`, `cloze`, or `mixed`

#### Scenario: HTML policy is explicit
- **WHEN** a client inspects schema or catalog metadata
- **THEN** `allowedHtmlPolicy` is one of `plain_text_only`, `safe_inline_html`, or `trusted_html` and is treated as a validation constraint

### Requirement: Allowed HTML Policy Enforcement
The MCP server MUST define deterministic sanitization behavior for each `allowedHtmlPolicy` mode.

#### Scenario: plain_text_only escapes markup
- **WHEN** a field uses `allowedHtmlPolicy=plain_text_only`
- **THEN** input markup is escaped and rendered as text, not interpreted as HTML

#### Scenario: safe_inline_html uses strict allowlist
- **WHEN** a field uses `allowedHtmlPolicy=safe_inline_html`
- **THEN** only allowlisted inline tags (`b`, `strong`, `i`, `em`, `u`, `code`, `sub`, `sup`, `br`, `ruby`, `rt`, `span`) are preserved and disallowed tags/attributes are stripped

#### Scenario: trusted_html bypasses sanitizer
- **WHEN** a field uses `allowedHtmlPolicy=trusted_html`
- **THEN** the server permits raw HTML and records that trust mode in validation output for auditability

### Requirement: Field Validation Before Creation
The MCP server MUST provide a validation tool that checks user input against the selected card type schema before any note is created.

#### Scenario: Validation passes for correct data
- **WHEN** the client calls `` with schema-compliant values
- **THEN** the server returns `valid=true` with an empty error list

#### Scenario: Validation fails for missing required field
- **WHEN** the client omits a required field in ``
- **THEN** the server returns `valid=false` and includes a field-specific error code and message

#### Scenario: Validation reports non-fatal warnings
- **WHEN** the client submits valid data that violates style hints (for example, unusually long front text)
- **THEN** the server returns `valid=true` with warning entries and no write action performed

### Requirement: Catalog as MCP Resource
The MCP server MUST expose the card type catalog through an MCP resource so clients can cache and inspect definitions without repeated tool calls.

#### Scenario: Read catalog resource
- **WHEN** the client reads the catalog resource URI
- **THEN** the server returns the same logical data model as `list_card_types` plus cache metadata

#### Scenario: Resource and tool consistency
- **WHEN** the client compares catalog entries from resource and tool outputs within the same catalog version
- **THEN** the entries are semantically equivalent
