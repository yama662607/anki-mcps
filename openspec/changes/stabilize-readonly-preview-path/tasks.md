## 1. Contracts and Spec Alignment

- [x] 1.1 Update preview-related specs to require a read-only native preview path for the optional extension integration
- [x] 1.2 Define preview/update safety semantics so extension-backed preview cannot silently corrupt later `update_note` operations
- [x] 1.3 Document the current repository gap (`openspec/project.md` missing) and keep the change scoped to the existing note-centric contract

## 2. Extension Preview Redesign

- [x] 2.1 Replace the editor-backed `guiPreviewNote` flow in `anki-connect-extension` with a read-only previewer opened directly from note cards
- [x] 2.2 Limit extension-managed GUI state to previewer instances and provide deterministic close behavior for that state
- [x] 2.3 Preserve compatibility for existing MCP calls by keeping `guiPreviewNote` / `guiCloseNoteDialog` callable under the new implementation

## 3. MCP Integration and Safety

- [x] 3.1 Update MCP integration to rely on the safer extension preview path without adding new public preview tools
- [x] 3.2 Remove or simplify MCP-side preview-close workarounds that are only needed because of editor-backed preview coupling
- [x] 3.3 Ensure preview-related failures remain structured and retryable without partial silent success

## 4. Validation and Operations

- [x] 4.1 Add automated regression coverage for `open_note_preview -> update_note(fields+tags)` stability under the extension path
- [x] 4.2 Add or update real-Anki smoke coverage proving `preview -> update_note(fields+tags) -> get_notes/search_notes -> delete` succeeds cleanly
- [x] 4.3 Update README and GUI observability docs to describe the extension preview path as native rendering without live editor state
- [x] 4.4 Validate with `openspec validate stabilize-readonly-preview-path --strict` and the relevant test/build commands after implementation
