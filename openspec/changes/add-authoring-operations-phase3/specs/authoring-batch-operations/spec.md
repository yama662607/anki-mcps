## ADDED Requirements

### Requirement: Batch draft creation
The system SHALL provide a batch draft creation operation that accepts multiple create requests under one `profileId` and returns an itemized result for every request.

#### Scenario: Batch create with mixed outcomes
- **WHEN** a batch contains both valid and invalid create requests
- **THEN** the system returns a `results[]` entry for every item
- **AND** valid items are created as normal drafts
- **AND** invalid items return structured errors without cancelling successful items

### Requirement: Batch finalize operations
The system SHALL provide batch commit and batch discard operations that preserve the semantics of the single-item tools for each item.

#### Scenario: Batch commit preserves review checks
- **WHEN** a batch commit request includes multiple drafts
- **THEN** each item MUST include its own `reviewDecision`
- **AND** any item missing required review confirmations fails with `INVALID_ARGUMENT`
- **AND** successful items commit without waiting for failed items to be retried

#### Scenario: Batch discard is idempotent per item
- **WHEN** a batch discard request includes drafts that are already discarded
- **THEN** those items return an `already_discarded` result
- **AND** other discardable items continue to be discarded normally

### Requirement: Batch response stability
The system SHALL make batch responses machine-actionable and retry-safe.

#### Scenario: Batch response identifies item outcomes
- **WHEN** a batch operation completes
- **THEN** the response includes a stable per-item identifier from the request
- **AND** each item reports either a success payload or a structured error payload
- **AND** the response includes aggregate counts for `succeeded` and `failed`
