## Why

The current direct-preview path depends on `anki-connect-extension` opening AnkiConnect's live `Edit` dialog and then calling `show_preview()`. Investigation against real Anki showed two unstable behaviors in that design:

- keeping the preview/editor open can cause later note updates to partially revert, especially tags
- closing the preview/editor before a field update can trigger `wrapped C/C++ object of type QWidget has been deleted`

Those failures were reproduced through raw AnkiConnect actions, which means the remaining defect is below `anki-mcps` itself. The integration needs a preview path that still uses Anki's native rendering, but no longer depends on editor lifecycle state.

## Context Gaps

- `openspec/project.md` is not present in this repository, so this proposal is grounded in the current specs, docs, source, and real-Anki investigation logs.
- The implementation will span this repository and the companion `anki-connect-extension` repository, but the public contract remains owned here.

## What Changes

- Add a dedicated GUI-preview integration capability that requires the extension path to use a read-only native Anki previewer instead of a live editor dialog.
- Modify note-centric preview requirements so `open_note_preview` stays contract-compatible while no longer depending on editor/browser fallback semantics when the extension path is available.
- Tighten safety requirements so preview state cannot silently corrupt later `update_note` operations.
- Extend regression and real-Anki quality gates to prove `preview -> update_note(fields+tags) -> read/search` remains stable.

## Capabilities

### New Capabilities
- `gui-preview-integration`: define the required behavior for the optional extension-backed preview path, including read-only rendering and lifecycle isolation.

### Modified Capabilities
- `note-centric-authoring`: preserve `open_note_preview` while requiring preview/update compatibility under the extension path.
- `mcp-safety-and-contract`: require deterministic preview-related failure semantics and non-corrupting fallback behavior.
- `authoring-quality-gates`: add focused regression and real-Anki smoke coverage for preview-then-update stability.

## Impact

- Affected MCP docs and contract semantics in [README.md](/Users/daisukeyamashiki/Code/Projects/anki-mcps/README.md), [docs/implementation/gui-and-observability.md](/Users/daisukeyamashiki/Code/Projects/anki-mcps/docs/implementation/gui-and-observability.md), and [src/contracts/toolContracts.ts](/Users/daisukeyamashiki/Code/Projects/anki-mcps/src/contracts/toolContracts.ts)
- Affected gateway/service behavior in [src/gateway/ankiConnectGateway.ts](/Users/daisukeyamashiki/Code/Projects/anki-mcps/src/gateway/ankiConnectGateway.ts) and [src/services/noteAuthoringService.ts](/Users/daisukeyamashiki/Code/Projects/anki-mcps/src/services/noteAuthoringService.ts)
- Companion implementation required in the `anki-connect-extension` repository to replace the editor-backed preview path
- No planned breaking MCP tool rename; the goal is to stabilize the existing `open_note_preview` contract
