## MODIFIED Requirements

### Requirement: Review-first note isolation
The MCP server MUST keep newly added notes out of normal study flow until the user explicitly keeps them.

#### Scenario: New note cards are suspended by default
- **WHEN** `add_note` succeeds without overriding the review behavior
- **THEN** the generated cards are suspended
- **AND** the response reports that the note is review-pending

#### Scenario: Preview by note identity
- **WHEN** the client calls `open_note_preview` with a valid `noteId`
- **THEN** the server opens the corresponding Anki preview for that existing note
- **AND** if the optional extension path is available, that preview uses the isolated native preview integration rather than a live editor dialog

#### Scenario: Update after extension-backed preview
- **WHEN** the client previews a note through the optional extension path and then calls `update_note` with a matching expected modification timestamp
- **THEN** field and tag updates either persist consistently or return a structured error
- **AND** the preview step does not silently cause later tag or field rollback

#### Scenario: Release note to study
- **WHEN** the client calls `set_note_cards_suspended` with `suspended=false`
- **THEN** the note's generated cards become eligible for normal study scheduling
