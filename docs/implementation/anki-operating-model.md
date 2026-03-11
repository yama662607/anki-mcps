# Anki Operating Model

## 7.1 responsibilities

- `profile`: full data scope boundary
- `deck`: grouping and review settings
- `note type`: template/CSS and field structure
- `note`: content payload
- `card`: generated review units and scheduling state
- `tag`: orthogonal metadata and workflow markers

## 7.2 naming and segregation rules

- Use domain deck roots:
  - `Languages::*`
  - `Programming::*`
  - `Fundamentals::*`
- Keep card-type IDs domain-prefixed and versioned.

## 7.3 tool-to-classification mapping

- Catalog tools: read note-type metadata
- create draft: writes note/card/tag in a profile + target deck
- commit/discard/cleanup: mutate draft note/card/tag lifecycle only
- preview: GUI navigation for target note/card

## 7.4 standard playbooks

- Add flow: list -> schema -> create draft -> preview -> commit/discard
- Correction flow: create draft with `supersedesDraftId` -> preview -> commit latest
- Recovery flow: list drafts -> cleanup stale -> recreate if needed

## 7.5 anti-pattern guardrails

- Do not use deck as design mechanism (design belongs to note type).
- Do not bypass the draft review flow for review-sensitive content.

## 7.6 profile resolution policy

- Write tools: explicit `profileId` required
- Read tools: `profileId` optional; fallback to unique active profile if available
- Otherwise fail-closed with `PROFILE_REQUIRED`

## 7.7 scope mismatch handling

- If a draft from another profile is referenced in mutate paths, return `PROFILE_SCOPE_MISMATCH`.
