---
name: author-anki-cards
description: Safe operation guide for staged card authoring with the `anki-mcps` MCP server. Use when adding, previewing, revising, committing, discarding, batching, or recovering Anki cards that already have a note type and custom card type definition.
---

# Author Anki Cards

## Quick rules

- Pass `profileId` on every write tool.
- Run `get_card_type_schema` before generating fields for an unfamiliar card type.
- Run `validate_card_fields` before creating drafts when the payload is non-trivial.
- Never commit without explicit user approval in natural language.
- Never edit a staged draft in place. Rebuild with `supersedesDraftId`.
- Use batch tools for multiple notes.
- Treat `DEPENDENCY_UNAVAILABLE` as an Anki or AnkiConnect problem, not a content problem.

## Pick the workflow

- One new card:
  - `list_card_types -> get_card_type_schema -> validate_card_fields -> create_staged_card -> get_staged_card -> open_staged_card_preview -> commit_staged_card|discard_staged_card`
- Many new cards:
  - `list_card_types -> get_card_type_schema -> create_staged_cards_batch -> get_staged_card/open_staged_card_preview as needed -> commit_staged_cards_batch|discard_staged_cards_batch`
- Revise after feedback:
  - `get_staged_card -> create_staged_card` with `supersedesDraftId` -> preview -> commit latest draft
- Recover after interruption:
  - `list_staged_cards -> get_staged_card -> open_staged_card_preview -> commit/discard or cleanup`

## When to read references

- Read [references/operations.md](references/operations.md) when you need concrete example payloads.
- If fields are unclear, inspect the schema before generating content.

## Failure handling

- `INVALID_ARGUMENT`: fix fields or incomplete `reviewDecision`.
- `CONFLICT`: fix duplicate `clientRequestId`, superseded draft usage, or deprecated card type usage.
- `PROFILE_SCOPE_MISMATCH`: retry against the correct profile.
- `NOT_FOUND`: refresh the draft list or card type selection.
