## Context

`anki-mcps` currently treats the optional extension path as the preferred preview mechanism because it shows real Anki rendering instead of the edit-dialog fallback. Real-Anki investigation showed that the current extension implementation does not merely open a preview window; it opens AnkiConnect's `Edit` dialog, registers editor lifecycle hooks, and then opens a preview from that dialog.

That creates two distinct failure modes:

1. `preview kept open -> update_note(fields+tags)` can persist fields while tags revert later
2. `preview closed -> update_note(fields)` can fail with `wrapped C/C++ object of type QWidget has been deleted`

Raw AnkiConnect reproduction showed the second failure even without `anki-mcps`, so the root problem is the editor-backed preview design, not only MCP orchestration.

## Goals / Non-Goals

**Goals**
- Keep the public MCP tools unchanged where possible.
- Continue using Anki's native card rendering for preview.
- Remove dependency on AnkiConnect's live editor dialog for extension-backed preview.
- Guarantee that preview state does not silently invalidate later `update_note` operations.
- Preserve the edit-dialog fallback path for environments without the extension.

**Non-Goals**
- Rebuild a browser-based HTML renderer inside `anki-mcps`.
- Fork or deeply modify AnkiConnect's core note CRUD API.
- Introduce a new public preview tool name unless compatibility cannot be preserved.
- Solve every possible Anki GUI race beyond the extension-backed preview lifecycle.

## Decision

### 1. Keep `open_note_preview` as the public entry point

The MCP contract already exposes `open_note_preview`, and callers should not need to learn a new tool just because the extension implementation changes.

Consequence:
- contract schemas remain mostly stable
- runtime semantics change from `editor-backed preview` to `read-only native preview` when the extension is installed

### 2. Move the extension path to a read-only native previewer

The extension should stop calling `Edit.open_dialog_and_show_note_with_id(note)` for preview. Instead, it should open a previewer directly from the note's generated cards.

Desired properties:
- uses Anki's native card rendering
- does not create an editor or register editor hooks
- keeps only previewer state, not dialog/editor state
- can be reopened or closed idempotently per `noteId`

Rationale:
- preserves rendering fidelity
- avoids stale editor state and close/cleanup races
- keeps AnkiConnect itself largely unchanged

### 3. Treat extension preview lifecycle as isolated from note mutation

After this change, `update_note` should no longer need to work around extension-created editor dialogs. If a preview is open, updates should either coexist safely or fail deterministically without partial persistence.

Rationale:
- mutation safety should come from removing the root coupling, not from stacking retries and delays in MCP
- it keeps `noteAuthoringService` simpler and more trustworthy

### 4. Keep fallback behavior conservative

If the extension is unavailable, the server may continue using the edit-dialog fallback. However, the stronger preview/update stability guarantee only applies to the extension-backed path introduced by this change.

Rationale:
- preserves reachability for users who have not installed the extension
- keeps the risky lifecycle isolated to the fallback path, which remains explicitly secondary

## Architecture Sketch

### Current path

```text
open_note_preview
  -> extension guiPreviewNote(noteId)
    -> open Edit dialog
      -> register editor hooks
      -> show preview from dialog

update_note
  -> field/tag mutation collides with dialog/editor lifecycle
```

### Target path

```text
open_note_preview
  -> extension guiPreviewNote(noteId)
    -> load note/cards
    -> open read-only previewer directly
    -> remember previewer only

update_note
  -> note mutation through AnkiConnect CRUD
  -> no editor lifecycle coupling from preview path
```

## Alternatives Considered

### A. Patch `anki-mcps` only with more close/wait/retry logic
Rejected.

Investigation already showed that even raw AnkiConnect can fail after `guiCloseNoteDialog`, so MCP-side timing logic does not remove the root race.

### B. Patch AnkiConnect core `Edit` lifecycle
Rejected as the first move.

It is possible, but it increases fork/maintenance cost and broadens the surface area of divergence from upstream AnkiConnect.

### C. Keep editor-backed preview but never reuse dialogs
Rejected.

This would reduce some stale-state issues but still leaves `Edit` lifecycle hooks in the preview path, which is the core architectural problem.

## Risks / Trade-offs

- [Extension implementation becomes slightly larger] -> acceptable because it isolates the complexity to the optional GUI companion.
- [Fallback path remains weaker than extension path] -> document this explicitly in runtime guidance and docs.
- [Previewer-only path may need its own close/status bookkeeping] -> acceptable and simpler than editor/dialog bookkeeping.
- [Cross-repo work is required] -> keep this change tightly scoped to preview lifecycle and contract wording.

## Migration / Rollout Plan

1. Specify the read-only preview requirement and preview/update stability guarantees.
2. Implement the new preview path in `anki-connect-extension` without changing public MCP tool names.
3. Simplify `anki-mcps` preview/update orchestration to rely on the safer extension path.
4. Add regression and real-Anki smoke coverage for `preview -> update_note(fields+tags) -> read/search`.
5. Update docs to explain that extension preview is native Anki rendering without editor state.

## Open Questions

- Should runtime status expose a more specific preview mode label than `extension-preview`, or is a docs-only clarification sufficient?
- Should the fallback edit-dialog path gain stronger warnings in `guidance` because it cannot provide the same mutation safety guarantees?
