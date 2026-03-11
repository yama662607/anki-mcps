## 1. Contracts and Persistence

- [x] 1.1 Add request/response schemas and contract resource entries for `get_draft`, `list_card_type_definitions`, `deprecate_card_type_definition`, `create_drafts_batch`, `commit_drafts_batch`, and `discard_drafts_batch`
- [x] 1.2 Extend custom card type persistence with `status` and `deprecatedAt`, plus active-only default query paths
- [x] 1.3 Update shared contract/types to represent batch item results and deprecated definition metadata

## 2. Authoring Operations

- [x] 2.1 Implement `get_draft` service and MCP handler with profile-scoped access checks
- [x] 2.2 Implement `list_card_type_definitions` and `deprecate_card_type_definition` service and MCP handlers
- [x] 2.3 Implement `create_drafts_batch` using per-item execution and stable itemized responses
- [x] 2.4 Implement `commit_drafts_batch` and `discard_drafts_batch` using existing single-item semantics per item
- [x] 2.5 Reject deprecated custom card type definitions in new draft-card creation while preserving read access

## 3. Validation and Regression Tests

- [x] 3.1 Add service-layer tests for inspection, definition lifecycle, and mixed-outcome batch operations
- [x] 3.2 Add MCP handler tests for new tool registration, strict schema parsing, and structured error payloads
- [x] 3.3 Extend real-Anki smoke coverage with one batch draft-create path and one batch finalize path that clean up after execution

## 4. Documentation and Readiness

- [x] 4.1 Update implementation docs to describe the new authoring workflow and deprecated-definition behavior
- [x] 4.2 Document the minimal test matrix for authoring operations and verify `typecheck`, `test`, `build`, and relevant smoke flows
