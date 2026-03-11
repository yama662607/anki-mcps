# GUI and Observability (Implementation Notes)

## 3.x GUI preview and commit preconditions

- Preview tool: `open_draft_preview`
- Review completion inputs required at commit:
  - `targetIdentityMatched=true`
  - `questionConfirmed=true`
  - `answerConfirmed=true`
  - `reviewedAt`, `reviewer`
- If checklist is incomplete, commit fails with `INVALID_ARGUMENT`.

## 4.1 read/write boundary

- Read-ish tools: `list_card_types`, `list_card_type_definitions`, `get_card_type_schema`, `get_draft`, `open_draft_preview`, `list_drafts`
- Write tools: `create_draft`, `create_drafts_batch`, `commit_draft`, `commit_drafts_batch`, `discard_draft`, `discard_drafts_batch`, `cleanup_drafts`, `deprecate_card_type_definition`

## 4.2 / 4.8 structured errors and canonical registry

- Envelope: `code`, `message`, `retryable`, `hint`, `context`
- Canonical codes:
  - `INVALID_ARGUMENT`
  - `NOT_FOUND`
  - `CONFLICT`
  - `DEPENDENCY_UNAVAILABLE`
  - `PROFILE_REQUIRED`
  - `PROFILE_SCOPE_MISMATCH`
  - `INVALID_STATE_TRANSITION`
  - `INVALID_SUPERSEDE_SOURCE`
  - `FORBIDDEN_OPERATION`
- Source: `src/contracts/errors.ts`

## 4.3 audit log schema and redaction

- Emitted as structured JSON to stderr from draft lifecycle service.
- Fields: `event`, `timestamp`, `profileId`, `draftId`, `noteId`, `state`, and limited operation metadata.
- Sensitive content (field text) is intentionally excluded.

## 4.4 operational metrics

Primary runtime metrics (derived from logs/store):
- `draft_count{state,profileId}`
- `commit_rate{profileId}`
- `discard_rate{profileId}`
- `cleanup_count{profileId}`
- `conflict_count{profileId}`
- `batch_item_success_count{operation,profileId}`
- `batch_item_failure_count{operation,profileId}`

## 4.5 profile-scoped identifiers

- Draft store partition key includes `profileId`.
- Lifecycle logs always include `profileId`.

## 4.6 conflict detection

- Fingerprint compares stored draft snapshot vs live Anki note snapshot at commit.

## 4.7 no-force-commit

- No force path exists in API; manual conflict bypass is rejected via draft lifecycle rules.

## 4.9 contract versioning policy

- Current version: `1.0.0`.
- Non-breaking: additive optional fields only.
- Breaking: new major + parallel migration window.

## 4.10 SQLite schema contract

- DB: `.data/drafts.sqlite` (configurable via `DRAFT_DB_PATH`)
- Table: `drafts`
- Constraints:
  - PK `(profile_id, draft_id)`
  - UNIQUE `(profile_id, client_request_id)`
- Indexes:
  - `(profile_id, state, updated_at DESC)`
  - `(profile_id, supersedes_draft_id)`
- Terminal metadata retention purge: 30 days.

## 4.11 contract URI and migration window

- Fixed URI: `anki://contracts/v1/tools`
- Migration rule: major version bump must keep prior major during migration window.

## 4.12 write profile requirement

- Write tools require explicit `profileId`.
- Missing `profileId` => `PROFILE_REQUIRED`.
