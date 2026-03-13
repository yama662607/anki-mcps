## MODIFIED Requirements

### Requirement: Minimal regression coverage for authoring operations
The system SHALL add focused regression tests for every new note-centric authoring tool introduced by this change.

#### Scenario: Service and MCP coverage
- **WHEN** the change is implemented
- **THEN** service-layer tests cover success paths and at least one failure path for `list_decks`, `search_notes`, `get_notes`, `ensure_deck`, `add_note`, `update_note`, `delete_note`, `open_note_preview`, and `set_note_cards_suspended`
- **AND** MCP handler tests verify registration, schema parsing, and structured errors for those tools

### Requirement: Batch failure-path coverage
The system SHALL test partial-success behavior for note-centric batch operations.

#### Scenario: Mixed batch result regression
- **WHEN** a batch add or delete operation contains at least one failing item
- **THEN** automated tests verify that successful items are preserved
- **AND** failing items return structured errors without corrupting neighboring results

### Requirement: Real-Anki smoke coverage
The system SHALL extend the real-Anki smoke plan only to the minimum note-centric paths introduced by this change.

#### Scenario: Preview-update-readback smoke flow
- **WHEN** real-Anki smoke tests are run with the extension-backed preview path available
- **THEN** at least one `add note -> preview -> update_note(fields+tags) -> get_notes/search_notes -> delete` path is exercised
- **AND** the smoke flow proves that preview does not cause later field or tag rollback
- **AND** the smoke flow leaves Anki in a clean state after completion
