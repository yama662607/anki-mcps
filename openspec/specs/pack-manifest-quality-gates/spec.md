# pack-manifest-quality-gates Specification

## Purpose
TBD - created by archiving change add-pack-manifest-authoring. Update Purpose after archive.
## Requirements
### Requirement: Custom pack registry regression coverage
The project MUST add regression tests for custom pack registry storage, validation, and application behavior.

#### Scenario: Registry and apply coverage exists
- **WHEN** the automated test suite runs
- **THEN** it covers `upsert_pack_manifest`, `list_pack_manifests`, `get_pack_manifest`, `deprecate_pack_manifest`, and `apply_starter_pack` against a registered custom pack
- **AND** it includes success, validation failure, and ownership-conflict paths

### Requirement: Contract and documentation coverage for agent-authored packs
The project MUST document how an agent can create a new reusable pack without editing MCP source code.

#### Scenario: Example authoring workflow exists
- **WHEN** a developer reads the implementation docs and contract resource examples
- **THEN** they can see a complete flow for `upsert_pack_manifest -> apply_starter_pack -> create_draft -> open_draft_preview -> commit_draft|discard_draft`
- **AND** the example uses a non-built-in domain to prove the workflow is generic

### Requirement: Real-Anki smoke path for custom packs
The project MUST retain at least one real-Anki smoke path for a registered custom pack.

#### Scenario: Custom pack smoke succeeds
- **WHEN** the real-Anki smoke workflow provisions a minimal registered custom pack and creates a draft from it
- **THEN** preview opens successfully and the draft can be discarded cleanly
- **AND** the workflow does not leave orphan notes or database warnings

