## MODIFIED Requirements

### Requirement: Safety-Oriented Tool Segmentation
The MCP server MUST segment tools by risk using official Anki discovery and note-authoring operations.

#### Scenario: Read-only tools do not mutate state
- **WHEN** the client calls `list_decks`, `list_note_types`, `get_note_type_schema`, `search_notes`, or `get_notes`
- **THEN** the server performs no Anki write action and returns deterministic responses

#### Scenario: Write operations require explicit tool call
- **WHEN** a client needs to create or change decks, note types, notes, or suspension state
- **THEN** no persistent write occurs until a mutating tool such as `ensure_deck`, `upsert_note_type`, `add_note`, `update_note`, `delete_note`, or `set_note_cards_suspended` is invoked

#### Scenario: Write operations require explicit profile
- **WHEN** a mutating tool such as `ensure_deck`, `upsert_note_type`, `add_note`, `update_note`, `delete_note`, `set_note_cards_suspended`, or `import_media_asset` is called without `profileId`
- **THEN** the server returns `PROFILE_REQUIRED`
- **AND** performs no mutation

### Requirement: Observability and Auditability
The MCP server MUST emit structured logs for note review state transitions.

#### Scenario: Review-note lifecycle logging
- **WHEN** a review-pending note is created, updated, unsuspended, or deleted through the MCP workflow
- **THEN** the server logs event type, identifiers, timestamp, and outcome without exposing sensitive field content by default

### Requirement: Preview failure isolation
The MCP server MUST expose preview-related failures in a way that prevents silent partial success.

#### Scenario: Extension preview does not silently corrupt updates
- **WHEN** a note has been previewed through the optional extension path and a later `update_note` cannot persist fields or tags consistently
- **THEN** the server returns a structured, retryable error
- **AND** includes enough context to show which values failed to persist
- **AND** does not report the update as successful
