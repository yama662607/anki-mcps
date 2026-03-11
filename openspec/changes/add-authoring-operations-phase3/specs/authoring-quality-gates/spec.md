## ADDED Requirements

### Requirement: Minimal regression coverage for authoring operations
The system SHALL add focused regression tests for every new authoring tool introduced by this change.

#### Scenario: Service and MCP coverage
- **WHEN** the change is implemented
- **THEN** service-layer tests cover the success path and at least one failure path for every new tool
- **AND** MCP handler tests verify tool registration, schema parsing, and structured error payloads for the new tools

### Requirement: Batch failure-path coverage
The system SHALL test partial-success behavior for batch operations.

#### Scenario: Mixed batch result regression
- **WHEN** a batch create, commit, or discard operation contains at least one failing item
- **THEN** automated tests verify that successful items are preserved
- **AND** failing items return structured errors without corrupting neighboring results

### Requirement: Real-Anki smoke coverage
The system SHALL extend the real-Anki smoke plan only to the minimum paths introduced by this change.

#### Scenario: Batch authoring smoke flow
- **WHEN** real-Anki smoke tests are run
- **THEN** at least one batch draft create path and one batch finalize path are exercised
- **AND** the smoke flow leaves Anki in a clean state after completion
