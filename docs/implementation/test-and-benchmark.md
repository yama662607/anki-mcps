# Test Strategy and Benchmark Gate

## 5.1 contract test matrix

Implemented test suites:
- `tests/sanitize.test.ts`
- `tests/catalogService.test.ts`
- `tests/draftService.test.ts`
- `tests/noteTypeService.test.ts`
- `tests/ankiConnectGateway.test.ts`

Coverage includes:
- schema/sanitizer behavior
- note-type discovery, dry-run, additive-safe update, and dependency failure wrapping
- staged creation and idempotent retry
- commit idempotency
- conflict detection after manual edit
- supersede behavior
- cleanup default threshold behavior
- profile-scope mismatch behavior

## 5.2 integration failure plan (AnkiConnect)

Planned cases (gateway boundary):
- endpoint unreachable -> `DEPENDENCY_UNAVAILABLE`
- HTTP non-200 -> `DEPENDENCY_UNAVAILABLE`
- AnkiConnect action error -> `DEPENDENCY_UNAVAILABLE`

## 5.3 GUI E2E plan

Planned end-to-end checks:
- create staged draft -> open preview -> confirm -> commit
- create staged draft -> preview -> user correction -> supersede -> commit latest
- GUI unavailable path returns recoverable structured error

## 5.4 duplicate commit / orphan prevention

Regression checks in `tests/draftService.test.ts`:
- second commit returns `already_committed`
- cleanup discard path removes stale staged drafts

## 5.5 manual edit conflict + superseded rejection

Regression checks in `tests/draftService.test.ts`:
- note mutation before commit => `CONFLICT`
- superseded draft direct commit => `CONFLICT`

---

## 6.1 clone comparison axes

Axes: `safety`, `recovery`, `testability`, `observability`

## 6.2 acceptance rubric

- Each axis scored out of 5
- Minimum per-axis: 4
- Total must be strictly greater than best clone baseline

## 6.3 open question review

- Design open questions: none

## 6.4 KPI thresholds

- accidental auto-commit: 0
- duplicate creation on commit retry: 0
- staged recovery success in test matrix: 100%

## 6.5 benchmark evidence format

| Axis | Score | Evidence |
|---|---:|---|
| safety | 4 | state-machine + no-force-commit + profile gating |
| recovery | 4 | staged persistence + cleanup + idempotency |
| testability | 4 | focused unit suites + deterministic memory gateway |
| observability | 4 | structured lifecycle logs + profile-scoped events |

Current total: 16/20.
