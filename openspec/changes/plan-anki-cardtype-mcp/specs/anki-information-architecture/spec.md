## ADDED Requirements

### Requirement: Classification Responsibility Model
The MCP server specification MUST define distinct responsibilities for Anki classification units (`profile`, `deck`, `note type`, `note`, `card`, `tag`) and MUST NOT treat them as interchangeable.

#### Scenario: Responsibility definitions are explicit
- **WHEN** an operator reads the operating model documentation
- **THEN** they can identify which classification controls rendering, scheduling, grouping, and metadata tagging without ambiguity

#### Scenario: Design responsibility is assigned to note type
- **WHEN** a user asks how card appearance is controlled
- **THEN** the model states that templates and CSS are managed by `note type` rather than `deck`

### Requirement: Profile-Scoped Operations
All draft lifecycle and catalog operations MUST execute within an explicit Anki profile scope.

#### Scenario: Profile context is attached to operations
- **WHEN** a client executes draft tools
- **THEN** the operation context includes a resolved profile identifier and rejects ambiguous profile state

#### Scenario: Cross-profile isolation
- **WHEN** a client references a draft created in a different profile
- **THEN** the server rejects the request with a profile scope error and performs no mutation

### Requirement: Profile Resolution Policy
The operating model MUST define a deterministic precedence order for resolving the effective profile of each request.

#### Scenario: Explicit profile takes precedence
- **WHEN** a request includes `profileId`
- **THEN** the server uses the provided profile if it exists and is accessible

#### Scenario: Active profile fallback
- **WHEN** `profileId` is omitted and exactly one active profile can be resolved from Anki runtime
- **THEN** the server uses that active profile and returns it in response context

#### Scenario: Ambiguous or missing profile fails closed
- **WHEN** `profileId` is omitted and no unique active profile can be resolved
- **THEN** the server returns `PROFILE_REQUIRED` and performs no mutation

### Requirement: Explicit Profile for Write Operations
The operating model MUST require explicit `profileId` for all mutating tools.

#### Scenario: Write request without profile is rejected
- **WHEN** `create_draft`, `commit_draft`, `discard_draft`, or `cleanup_drafts` is called without `profileId`
- **THEN** the server returns `PROFILE_REQUIRED` and performs no mutation

#### Scenario: Read-only tools can use active-profile fallback
- **WHEN** `list_card_types`, `get_card_type_schema`, `open_draft_preview`, or `list_drafts` omits `profileId`
- **THEN** the server may resolve a unique active profile and returns the resolved value in response context

#### Scenario: Cross-profile draft mutation is blocked
- **WHEN** a write request references a `draftId` that belongs to another profile
- **THEN** the server returns `PROFILE_SCOPE_MISMATCH` and performs no mutation

### Requirement: Tool-to-Classification Mapping
The specification MUST provide a normative mapping of each MCP tool to the Anki classification unit(s) it reads or mutates.

#### Scenario: Mutation boundaries are auditable
- **WHEN** a tool is invoked
- **THEN** operators can determine from the mapping whether it affects profile state, deck placement, note content, card scheduling, or tags

#### Scenario: High-risk mutations are isolated
- **WHEN** a tool can persist user-visible changes
- **THEN** its mapped mutation scope is limited and explicitly documented in line with `mcp-safety-and-contract`

### Requirement: Standard Operating Playbooks
The specification MUST define standard workflows for add, preview, correction, and rebuild operations using the draft lifecycle.

#### Scenario: Add and confirm workflow
- **WHEN** a new card is created
- **THEN** the flow follows `cardtype-catalog -> create draft -> preview -> commit/discard`

#### Scenario: Rebuild workflow after user feedback
- **WHEN** a user requests revisions after preview
- **THEN** the flow creates a superseding draft and preserves lineage to prior drafts

#### Scenario: Manual edit during preview
- **WHEN** a user edits the note directly in Anki before commit
- **THEN** the subsequent commit path enforces conflict detection and routes to rebuild guidance

### Requirement: Anti-Pattern Guardrails
The operating model MUST document prohibited or discouraged usage patterns that historically cause data-quality or scheduling problems.

#### Scenario: Deck-driven design anti-pattern warning
- **WHEN** a workflow attempts to encode card appearance by deck configuration alone
- **THEN** the guidance flags the approach as invalid and redirects to note type management

#### Scenario: Direct write without staging warning
- **WHEN** an automation requests immediate persistent write for review-sensitive content
- **THEN** the guidance marks it as high risk and recommends draft confirmation flow
