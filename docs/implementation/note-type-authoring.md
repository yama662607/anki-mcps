# Note Type Authoring Workflow

## Safe workflow

1. Call `list_note_types` to inspect existing models.
2. Call `get_note_type_schema` if reusing or extending an existing model.
3. Call `upsert_note_type` without `dryRun` or with `dryRun=true`.
4. Review returned `operations`.
5. Call `upsert_note_type` with `dryRun=false` only when the plan is acceptable.
6. Register the model as a reusable custom card type with `upsert_card_type_definition`.
7. Use the normal staged-card flow for note creation.

## Safe update policy

- Phase2 allows additive-safe changes only.
- Allowed:
  - create a new note type
  - add new fields
  - add new templates
  - update template HTML
  - update CSS
- Rejected:
  - removing fields
  - renaming fields
  - removing templates
  - renaming templates
  - switching cloze/non-cloze mode

## Rollback playbook

- If `upsert_note_type(dryRun=false)` fails before applying, fix the payload and retry with the same `modelName`.
- If template/CSS changes were applied but are incorrect, call `get_note_type_schema` to capture the current state and then run `upsert_note_type` again with the corrected full template/CSS payload.
- If a custom card type definition points at the wrong note type or deck, rerun `upsert_card_type_definition` for the same `cardTypeId` with corrected metadata.
- Phase2 does not support destructive rollback. For field/template removal or rename, create a new model/version instead of mutating in place.
