## ADDED Requirements

### Requirement: Two-Phase Card Creation
The MCP server MUST implement card creation as a two-phase workflow (`draft` then `committed`) so users can inspect rendering in Anki GUI before finalizing.

#### Scenario: Create draft successfully
- **WHEN** the client calls `create_draft` with valid card type and fields
- **THEN** the server creates a draft note tagged as draft and returns a `draftId` with linked `noteId` and `cardIds`

#### Scenario: Staged card metadata is persisted
- **WHEN** a draft is created
- **THEN** the server records enough metadata to recover the draft by `draftId` across MCP session restarts

#### Scenario: Draft metadata is profile-scoped
- **WHEN** a draft is created under an active Anki profile
- **THEN** the server stores and resolves the draft with a `profileId` scope and prevents cross-profile draft lookup

#### Scenario: Staged cards are isolated from learning queue
- **WHEN** `create_draft` creates a draft
- **THEN** the server applies draft-only markers and excludes generated cards from normal study flow until commit

### Requirement: Draft State Machine and Idempotency
The MCP server MUST enforce a normative state machine for draft lifecycle and MUST reject invalid transitions.

#### Scenario: Allowed transitions are enforced
- **WHEN** draft lifecycle operations are executed
- **THEN** only `draft -> committed`, `draft -> discarded`, `draft -> superseded`, and `superseded -> discarded` transitions are allowed

#### Scenario: Invalid transitions are blocked
- **WHEN** a client attempts `committed -> draft` or `discarded -> committed`
- **THEN** the server returns `INVALID_STATE_TRANSITION` and performs no mutation

#### Scenario: Commit is idempotent
- **WHEN** `commit_draft` is called repeatedly for the same already committed draft
- **THEN** the server returns the original commit result without creating additional notes/cards

### Requirement: Idempotent Draft Creation
The MCP server MUST provide idempotent `create_draft` behavior using a client-supplied request key.

#### Scenario: Missing idempotency key is rejected
- **WHEN** `create_draft` is called without `clientRequestId`
- **THEN** the server returns `INVALID_ARGUMENT` and performs no mutation

#### Scenario: Retry with same key returns same draft
- **WHEN** `create_draft` is retried with the same `profileId` and `clientRequestId`
- **THEN** the server returns the original `draftId` and does not create additional notes/cards

#### Scenario: Key reuse with different payload is rejected
- **WHEN** `clientRequestId` is reused with different `cardTypeId`, `fields`, `deckName`, `tags`, or `supersedesDraftId`
- **THEN** the server returns `CONFLICT` with idempotency mismatch context and performs no mutation

### Requirement: GUI Preview Integration
The MCP server MUST provide GUI-preview helpers that operate on a `draftId` and navigate Anki UI to the corresponding card.

#### Scenario: Open draft in browser
- **WHEN** the client calls `open_draft_preview` for an existing draft
- **THEN** the server opens or focuses Anki Browser with the draft note selected

#### Scenario: Preview command fails gracefully when GUI unavailable
- **WHEN** Anki GUI is not available during `open_draft_preview`
- **THEN** the server returns a structured recoverable error with guidance and keeps draft data intact

### Requirement: Preview Completion Criteria
The MCP server MUST define normative GUI preview completion criteria before commit is considered valid.

#### Scenario: Checklist items are defined
- **WHEN** preview workflow documentation is evaluated
- **THEN** completion requires `target card identity matched`, `question side visually confirmed`, and `answer side visually confirmed`

#### Scenario: Commit requires explicit review decision
- **WHEN** the client calls `commit_draft`
- **THEN** the request includes a review decision payload declaring checklist completion and reviewer timestamp

#### Scenario: Missing review decision is rejected
- **WHEN** `commit_draft` omits the review decision payload
- **THEN** the server returns `INVALID_ARGUMENT` and performs no mutation

### Requirement: Explicit Commit and Discard Operations
The MCP server MUST separate `commit` and `discard` into dedicated tools and MUST NOT auto-commit drafts.

#### Scenario: Commit draft
- **WHEN** the client calls `commit_draft` for a valid draft
- **THEN** the server removes draft markers, applies final deck/tags if provided, and marks lifecycle state as `committed`

#### Scenario: Commit releases study isolation
- **WHEN** a draft is committed
- **THEN** the server removes draft-only markers and returns cards to normal study eligibility

#### Scenario: Discard draft
- **WHEN** the client calls `discard_draft` for a valid draft
- **THEN** the server deletes the draft note/cards and marks lifecycle state as `discarded`

#### Scenario: Prevent double-commit
- **WHEN** the client calls `commit_draft` on an already committed draft
- **THEN** the server returns an idempotent success or an explicit conflict response without duplicating notes

#### Scenario: Detect manual edits before commit
- **WHEN** the draft note was modified in Anki GUI after draft creation and before `commit_draft`
- **THEN** the server detects revision mismatch and returns `CONFLICT` with remediation guidance instead of committing silently

#### Scenario: Force commit is disabled
- **WHEN** a client attempts to bypass conflict checks using a force option
- **THEN** the server rejects the request with `FORBIDDEN_OPERATION` and requires creating a new draft

### Requirement: Commit Conflict Detection Algorithm
The MCP server MUST detect commit conflicts using a deterministic fingerprint computed at stage time and verified at commit time.

#### Scenario: Fingerprint scope is consistent
- **WHEN** a draft is created
- **THEN** the server stores a fingerprint derived from canonicalized `modelName`, `fields`, `sortedTags`, `profileId`, `noteId`, and source modification timestamp

#### Scenario: Fingerprint mismatch triggers conflict
- **WHEN** live note state differs from stored fingerprint during commit
- **THEN** the server returns `CONFLICT` with conflict fields and guidance to create a superseding draft

#### Scenario: No mismatch permits commit
- **WHEN** live note state matches stored fingerprint during commit
- **THEN** the server proceeds to commit and records the resulting state transition

### Requirement: Iterative Rebuild Workflow
The MCP server MUST support iterative rebuilds so users can preview, comment, and regenerate cards without losing traceability.

#### Scenario: Supersede an existing draft
- **WHEN** the client calls `create_draft` with `supersedesDraftId`
- **THEN** the server creates a new draft linked to the previous one and marks the previous draft as superseded (not committed)

#### Scenario: Commit only latest draft in chain
- **WHEN** a superseded draft is committed directly
- **THEN** the server returns a conflict instructing the client to commit the latest active draft

#### Scenario: Supersede requires active source draft
- **WHEN** `supersedesDraftId` points to a draft that is not `draft`
- **THEN** the server returns `INVALID_SUPERSEDE_SOURCE` and does not create a new draft

#### Scenario: Supersede lineage is preserved
- **WHEN** a new draft supersedes an existing draft
- **THEN** the server records lineage metadata (`supersedesDraftId`, chain depth, createdAt) for audit and recovery

### Requirement: Staged Draft Maintenance
The MCP server MUST provide operational tools to inspect and clean stale drafts.

#### Scenario: List current drafts
- **WHEN** the client calls `list_drafts`
- **THEN** the server returns active drafts with `draftId`, creation timestamp, and current lifecycle state

#### Scenario: Cleanup old drafts
- **WHEN** the client calls `cleanup_drafts` with `olderThanHours`
- **THEN** the server deletes only drafts older than the threshold and returns a deletion summary

#### Scenario: Cleanup default threshold
- **WHEN** the client calls `cleanup_drafts` without `olderThanHours`
- **THEN** the server uses a default threshold of 72 hours

### Requirement: SQLite Persistence Contract for Draft Metadata
The MCP server MUST persist draft lifecycle metadata in SQLite with fixed table structures, indexes, and retention behavior.

#### Scenario: Draft table schema is fixed
- **WHEN** the persistence schema is initialized
- **THEN** a `drafts` table exists with keys and columns for `profileId`, `draftId`, `noteId`, `state`, `fingerprint`, `supersedesDraftId`, timestamps, and serialized fields/tags payloads

#### Scenario: Integrity and lookup constraints are enforced
- **WHEN** draft lifecycle operations run
- **THEN** SQLite enforces uniqueness for `(profileId, draftId)` and provides indexes for `(profileId, state, updatedAt)` and `(profileId, supersedesDraftId)` lookups

#### Scenario: Metadata garbage-collection policy is deterministic
- **WHEN** cleanup runs with default policy
- **THEN** `draft` and `superseded` metadata older than 72 hours is purged, while `committed` and `discarded` metadata is retained for 30 days for auditability
