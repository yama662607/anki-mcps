# Contracts and Catalog (Implementation Notes)

## 1.1 `cardTypeId` naming and versioning

- Naming: `<domain>.v<major>.<variant>`
- Examples:
  - `language.v1.basic-bilingual`
  - `programming.v1.concept-qa`
  - `fundamentals.v1.cloze-facts`
- Rules:
  - domain: `language | programming | fundamentals`
  - major version increments for breaking template/field semantics
  - variant is kebab-case and immutable once published

## 1.2 / 1.3 / 1.7 Tool contracts and schemas

- Frozen contract resource URI: `anki://contracts/v1/tools`
- Source of truth: `src/contracts/toolContracts.ts`
- Runtime resource exposure: `src/mcp/contractsResource.ts`
- Catalog resource URI: `anki://catalog/card-types`

## 1.4 validation error/warning model

- Errors: hard failure (`valid=false`) such as missing required fields, unknown fields.
- Warnings: non-fatal issues (`valid=true`) such as length recommendation overflow.
- Validation implementation: `src/services/catalogService.ts`

## 1.5 strict request behavior (`additionalProperties=false`)

- All zod request schemas use `.strict()`.
- Implementation: `src/contracts/schemas.ts`

## 1.6 minimum metadata

Each card type includes:
- `cardTypeId`, `label`, `modelName`, `defaultDeck`, `requiredFields`
- `renderIntent` (`recognition|production|cloze|mixed`)
- `allowedHtmlPolicy` (`plain_text_only|safe_inline_html|trusted_html`)

## 1.8 sanitizer constraints

- `plain_text_only`: full HTML escape
- `safe_inline_html`: strict allowlist (`b,strong,i,em,u,code,sub,sup,br,ruby,rt,span`) and attribute stripping
- `trusted_html`: pass-through
- Implementation: `src/utils/sanitize.ts`

## 2.x staged lifecycle contracts

- State model and transitions: `staged -> committed|discarded|superseded`, `superseded -> discarded`
- Idempotent create: required `clientRequestId` with payload fingerprint
- Conflict detection: canonical fingerprint over model/fields/tags/profile/note/modTimestamp
- Supersede workflow: source must be `staged`; old draft becomes `superseded`
- Cleanup default: `72` hours
- Study isolation: staged notes are suspended until commit
- Implementation: `src/services/draftService.ts`, `src/persistence/draftStore.ts`
