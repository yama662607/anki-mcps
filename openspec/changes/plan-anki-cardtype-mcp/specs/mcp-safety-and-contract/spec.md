## ADDED Requirements

### Requirement: Safety-Oriented Tool Segmentation
The MCP server MUST segment tools by risk so read-only and write operations are clearly distinguishable and independently controllable.

#### Scenario: Read-only tools do not mutate state
- **WHEN** the client calls discovery/validation/inspection tools
- **THEN** the server performs no Anki write action and returns deterministic responses

#### Scenario: Write operations require explicit tool call
- **WHEN** card data is validated and previewed
- **THEN** no persistent write beyond draft creation occurs until `commit_draft` is invoked

#### Scenario: Write operations require explicit profile
- **WHEN** a mutating tool (`create_draft`, `commit_draft`, `discard_draft`, `cleanup_drafts`) is called without `profileId`
- **THEN** the server returns `PROFILE_REQUIRED` and performs no mutation

### Requirement: Structured Error Contract
The MCP server MUST return machine-readable error payloads with stable error codes, human-readable messages, and remediation hints.

#### Scenario: Validation error format
- **WHEN** `` fails
- **THEN** the response includes `code`, `message`, `field`, and `hint` attributes

#### Scenario: Dependency error format
- **WHEN** Anki or AnkiConnect is unreachable
- **THEN** the response includes a specific connectivity error code and a recovery hint

#### Scenario: Concurrency conflict format
- **WHEN** commit fails due to revision mismatch or superseded draft state
- **THEN** the response includes `code=CONFLICT`, conflicting identifiers, and next-step guidance

### Requirement: Canonical Error Code Registry
The MCP server MUST define and publish a canonical error code registry with retryability semantics so clients can branch deterministically.

#### Scenario: Registry publishes full v1 code set
- **WHEN** clients inspect the canonical registry
- **THEN** it contains `INVALID_ARGUMENT`, `NOT_FOUND`, `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `PROFILE_REQUIRED`, `PROFILE_SCOPE_MISMATCH`, `INVALID_STATE_TRANSITION`, `INVALID_SUPERSEDE_SOURCE`, and `FORBIDDEN_OPERATION`

#### Scenario: Error envelope is stable
- **WHEN** any tool returns an error
- **THEN** the payload uses a stable envelope containing `code`, `message`, `retryable`, `hint`, and `context`

#### Scenario: Validation errors are non-retryable
- **WHEN** input schema or semantic validation fails
- **THEN** the server returns `INVALID_ARGUMENT` with `retryable=false` and field-level context

#### Scenario: Dependency failures are retryable
- **WHEN** Anki or AnkiConnect is temporarily unavailable
- **THEN** the server returns `DEPENDENCY_UNAVAILABLE` with `retryable=true` and recovery guidance

### Requirement: Tool I/O Contract Stability
The MCP server MUST define strict request/response contracts per tool and MUST reject undeclared input fields by default.

#### Scenario: Unknown request fields are rejected
- **WHEN** a client sends fields not declared in a tool schema
- **THEN** the server returns `INVALID_ARGUMENT` and does not execute side effects

#### Scenario: Response contract is deterministic
- **WHEN** a tool succeeds
- **THEN** the response contains only documented fields and stable field names for the same contract version

#### Scenario: Contract evolution is backward compatible
- **WHEN** the tool contract changes in a non-breaking release
- **THEN** only additive optional fields are introduced and existing required fields keep their meaning

### Requirement: Frozen v1 Tool Schema Registry
The MCP server MUST publish frozen v1 JSON Schemas for each tool and a shared-type registry so all clients implement identical contracts.

#### Scenario: Tool schemas are discoverable
- **WHEN** a client reads the contract resource URI
- **THEN** it receives request/response JSON Schemas for `list_card_types`, `get_card_type_schema`, `create_draft`, `open_draft_preview`, `commit_draft`, `discard_draft`, `list_drafts`, and `cleanup_drafts`

#### Scenario: Contract URI is stable
- **WHEN** a client discovers resources for tool contracts
- **THEN** it can read `anki://contracts/v1/tools` for v1 schemas and use that URI as a stable cache key

#### Scenario: Shared types are versioned with tool schemas
- **WHEN** a client reads the same contract resource
- **THEN** shared schemas (`CardTypeSummary`, `FieldSchema`, `ValidationIssue`, `DraftRecord`, `DraftListItem`) are included under the same `contractVersion`

#### Scenario: Contract updates are explicit
- **WHEN** any required field or enum meaning changes
- **THEN** the server increments major contract version and keeps prior major version available during migration window

### Requirement: Observability and Auditability
The MCP server MUST emit structured logs for all state transitions in the draft lifecycle.

#### Scenario: Draft lifecycle logging
- **WHEN** a draft is created, committed, discarded, or cleaned up
- **THEN** the server logs event type, identifiers, timestamp, and outcome without exposing sensitive card content by default

#### Scenario: Traceability of commit decisions
- **WHEN** a draft is committed
- **THEN** logs include the originating `draftId` and resulting `noteId` for audit correlation

#### Scenario: Profile-aware audit trail
- **WHEN** any draft lifecycle event is logged
- **THEN** the log includes `profileId` so events can be traced without cross-profile ambiguity

### Requirement: Testability as Contract
The MCP server MUST define contract-level tests covering successful flows and critical failure modes for each high-risk tool.

#### Scenario: Commit/discard regression protection
- **WHEN** test suite runs in CI
- **THEN** it verifies that committed drafts persist and discarded drafts are removed with no orphan artifacts

#### Scenario: GUI preview failure resilience
- **WHEN** GUI integration tests simulate unavailable GUI context
- **THEN** preview tools return recoverable errors and drafts remain recoverable

### Requirement: Quantitative Quality Gate Against Cloned Implementations
The MCP server MUST define quantitative pass/fail gates that demonstrate better operational quality than cloned reference projects.

#### Scenario: Safety gate is measurable
- **WHEN** regression and contract tests are executed
- **THEN** accidental auto-commit count is `0` and duplicate note creation from repeated commit is `0`

#### Scenario: Recovery gate is measurable
- **WHEN** restart recovery tests run for drafts
- **THEN** draft recovery success rate is `100%` and orphan-draft leakage is `0` in the test matrix

#### Scenario: Benchmark scoring is explicit
- **WHEN** comparing this project against cloned implementations
- **THEN** the project uses a published rubric across `safety`, `recovery`, `testability`, and `observability`, with no axis below `4/5` and total score strictly higher than the best clone baseline
