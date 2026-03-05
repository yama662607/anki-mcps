## 1. Contracts and Capability Boundaries

- [ ] 1.1 Define request/response JSON Schemas for `list_note_types`, `get_note_type_schema`, `upsert_note_type`, `upsert_card_type_definition`
- [ ] 1.2 Freeze tool descriptions and read/write boundaries (`readOnlyHint`, destructive semantics)
- [ ] 1.3 Extend contract resource payload (`anki://contracts/v1/tools`) with new tool schemas

## 2. Note Type Authoring

- [ ] 2.1 Implement AnkiConnect gateway adapters for model discovery and safe update actions
- [ ] 2.2 Implement `upsert_note_type` planning (`dryRun=true`) and apply (`dryRun=false`)
- [ ] 2.3 Enforce additive-safe policy (no remove/rename/reposition in Phase2)
- [ ] 2.4 Add structured errors for authoring failures (`CONFLICT`, `INVALID_ARGUMENT`, `DEPENDENCY_UNAVAILABLE`)

## 3. Custom CardType Registry

- [ ] 3.1 Add SQLite schema for `card_type_definitions` with profile-scoped unique key
- [ ] 3.2 Implement registry service and `upsert_card_type_definition`
- [ ] 3.3 Merge builtin+custom catalog in `list/get/validate` paths
- [ ] 3.4 Extend `create_staged_card` to resolve custom `cardTypeId`

## 4. Validation and Regression Safety

- [ ] 4.1 Add unit tests for authoring validation and dryRun/apply behavior
- [ ] 4.2 Add regression tests for catalog merge precedence and ID-collision rejection
- [ ] 4.3 Add integration tests for AnkiConnect note-type creation/update failure paths
- [ ] 4.4 Re-run staged lifecycle regression suite to ensure no behavior drift

## 5. Documentation and Operational Readiness

- [ ] 5.1 Add docs for note-type authoring workflow and safe update policy
- [ ] 5.2 Add TypeScript starter note-type bootstrap examples using the new tools
- [ ] 5.3 Document rollback playbook for failed note-type updates
- [ ] 5.4 Validate with `openspec validate add-note-type-authoring-phase2 --strict`
