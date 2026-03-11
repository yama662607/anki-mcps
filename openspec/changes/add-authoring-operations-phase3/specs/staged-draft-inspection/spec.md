## ADDED Requirements

### Requirement: Draft detail inspection
The system SHALL provide a read operation that returns the stored details for a single draft.

#### Scenario: Read draft details
- **WHEN** a client requests a draft by `draftId` and matching `profileId`
- **THEN** the system returns the draft state, note identity, deck, tags, fields, timestamps, and card type identifiers
- **AND** the response is sufficient for an agent to explain or supersede the draft without reopening the catalog

### Requirement: Profile-scoped draft access
The system SHALL enforce the same profile boundary on draft inspection as on draft mutation.

#### Scenario: Cross-profile draft lookup
- **WHEN** a client requests a draft that belongs to another profile
- **THEN** the system returns `PROFILE_SCOPE_MISMATCH`

### Requirement: Terminal draft visibility
The system SHALL allow committed, discarded, and superseded drafts to be inspected while retained in local metadata.

#### Scenario: Read committed draft metadata
- **WHEN** a committed draft is requested before metadata retention expiry
- **THEN** the system returns the stored draft metadata with its terminal state
