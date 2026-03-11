## ADDED Requirements

### Requirement: Custom card type definition listing
The system SHALL provide a read operation for profile-scoped custom card type definitions.

#### Scenario: List active definitions by default
- **WHEN** a client lists custom card type definitions without status filters
- **THEN** the system returns only active definitions for that profile
- **AND** each entry includes `cardTypeId`, `label`, `modelName`, `defaultDeck`, status metadata, and update timestamps

#### Scenario: Include deprecated definitions explicitly
- **WHEN** a client lists custom card type definitions with `includeDeprecated=true`
- **THEN** the system also returns deprecated definitions for that profile

### Requirement: Definition deprecation
The system SHALL support deprecating a custom card type definition without physically deleting it.

#### Scenario: Deprecate existing definition
- **WHEN** a client deprecates an active custom card type definition
- **THEN** the system marks the definition as `deprecated`
- **AND** the response includes the deprecation timestamp
- **AND** the definition remains available to read operations that opt into deprecated entries

### Requirement: Deprecated definition safety
The system SHALL prevent deprecated definitions from being used for new draft creation.

#### Scenario: Create draft from deprecated definition
- **WHEN** a client calls `create_draft` with a deprecated custom `cardTypeId`
- **THEN** the system returns `CONFLICT`
- **AND** the error context identifies the definition as deprecated
