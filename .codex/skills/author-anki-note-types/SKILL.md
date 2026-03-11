---
name: author-anki-note-types
description: Safe operation guide for note type and custom card type definition authoring with the `anki-mcps` MCP server. Use when creating or revising Anki note types, registering reusable custom card type definitions, inspecting definition state, or deprecating old definitions.
---

# Author Anki Note Types

## Quick rules

- Pass `profileId` on every write tool.
- Run `upsert_note_type` with `dryRun=true` before applying.
- Treat note types as design/schema work, not card content work.
- Register reusable entry points with `upsert_card_type_definition` after note type changes.
- Deprecate old custom definitions instead of deleting them.
- If a change is destructive, create a new model/version instead of mutating in place.

## Pick the workflow

- New note type:
  - `list_note_types -> get_note_type_schema -> upsert_note_type(dryRun=true) -> upsert_note_type(dryRun=false) -> upsert_card_type_definition`
- Additive-safe update to an existing note type:
  - `get_note_type_schema -> upsert_note_type(dryRun=true) -> upsert_note_type(dryRun=false)`
- Inspect custom definition inventory:
  - `list_card_type_definitions`
- Retire a custom definition:
  - `list_card_type_definitions -> deprecate_card_type_definition`

## When to read references

- Read [references/operations.md](references/operations.md) when you need concrete payload examples.
- If you are unsure whether a change is additive-safe, inspect the current schema before writing.

## Failure handling

- `FORBIDDEN_OPERATION`: the requested note type change is destructive for the current phase.
- `INVALID_ARGUMENT`: fix field names, template references, or duplicate metadata.
- `CONFLICT`: fix builtin/custom ID collisions or deprecated-definition usage.
- `NOT_FOUND`: refresh the target note type or definition inventory.
