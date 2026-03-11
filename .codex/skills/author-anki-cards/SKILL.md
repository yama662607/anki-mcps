---
name: author-anki-cards
description: Safe operation guide for draft authoring with the `anki-mcps` MCP server. Use when adding, previewing, revising, committing, discarding, batching, or recovering Anki cards that already have a note type and custom card type definition.
---

# Author Anki Cards

## Quick rules

- Pass `profileId` on every write tool.
- Run `get_card_type_schema` before generating fields for an unfamiliar card type.
- Validate required fields from `get_card_type_schema` before creating a draft.
- Never commit without explicit user approval in natural language.
- Never edit a draft in place. Rebuild with `supersedesDraftId`.
- Use batch tools for multiple notes.
- Treat `DEPENDENCY_UNAVAILABLE` as an Anki or AnkiConnect problem, not a content problem.

## Pick the workflow

- One new card:
  - `list_card_types -> get_card_type_schema -> create_draft -> get_draft -> open_draft_preview -> commit_draft|discard_draft`
- Many new cards:
  - `list_card_types -> get_card_type_schema -> create_drafts_batch -> get_draft/open_draft_preview as needed -> commit_drafts_batch|discard_drafts_batch`
- Revise after feedback:
  - `get_draft -> create_draft` with `supersedesDraftId` -> preview -> commit latest draft
- Recover after interruption:
  - `list_drafts -> get_draft -> open_draft_preview -> commit/discard or cleanup`

## When to read references

- Read [references/operations.md](references/operations.md) when you need concrete example payloads.
- If fields are unclear, inspect the schema before generating content.

## Failure handling

- `INVALID_ARGUMENT`: fix fields or incomplete `reviewDecision`.
- `CONFLICT`: fix duplicate `clientRequestId`, superseded draft usage, or deprecated card type usage.
- `PROFILE_SCOPE_MISMATCH`: retry against the correct profile.
- `NOT_FOUND`: refresh the draft list or card type selection.
