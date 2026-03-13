## ADDED Requirements

### Requirement: Extension preview uses isolated native rendering
The optional extension-backed preview path MUST render real Anki cards without opening or depending on a live note editor dialog.

#### Scenario: Open extension preview for an existing note
- **WHEN** the extension-backed preview path is available and `open_note_preview` targets an existing note
- **THEN** the integration opens a native Anki previewer for that note's generated cards
- **AND** does not create editor lifecycle state that can later mutate or reload the note implicitly

#### Scenario: Reopen preview for the same note idempotently
- **WHEN** `open_note_preview` is called again for the same `noteId` while the extension preview is already open
- **THEN** the integration reuses or refreshes only previewer state
- **AND** does not create duplicate editor/dialog state for that note

### Requirement: Extension preview close is deterministic
The optional extension-backed preview path MUST close preview state without leaving stale GUI hooks tied to deleted widgets.

#### Scenario: Close preview before later note mutations
- **WHEN** extension-managed preview state for a note is closed before a later field or tag mutation
- **THEN** subsequent note updates do not fail because a deleted preview-related widget is still referenced by GUI hooks
