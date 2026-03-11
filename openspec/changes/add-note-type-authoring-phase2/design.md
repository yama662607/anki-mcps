## Context

次フェーズの目的は、Ankiの設計責務（note type がテンプレート/CSSを持つ）をMCPに取り込み、エージェントが「カードタイプを選ぶだけ」で追加運用できる状態を作ること。

現状の課題:
- ノートタイプ作成/更新がMCP非対応
- カードタイプ定義が実装内固定（`src/contracts/catalog.ts`）
- 新規ノートタイプを追加しても `create_draft` から参照できない

## Architecture

### 1) Note Type Authoring Surface

追加ツール:
- `list_note_types` (read)
- `get_note_type_schema` (read)
- `upsert_note_type` (write)

`upsert_note_type` は `dryRun=true` をデフォルトにし、適用前に planned operations を返す。
`dryRun=false` の場合のみ AnkiConnect へ反映する。

AnkiConnect action mapping:
- discovery: `modelNames`, `modelFieldNames`, `modelTemplates`, `modelStyling`, `modelFieldsOnTemplates`
- create/update: `createModel`, `modelFieldAdd`, `updateModelTemplates`, `updateModelStyling`, `modelFieldSetDescription`

安全制約（初期版）:
- additive-safe のみ許可（field remove/rename/reposition は不許可）
- template/css は上書き可
- cloze/non-cloze の型変更は不許可

### 2) Custom CardType Registry

新規テーブル（Draft DBに同居）:
- `card_type_definitions`
  - key: `(profile_id, card_type_id)`
  - fields: label/model/defaultDeck/requiredFields/optionalFields/fieldSchema/renderIntent/allowedHtmlPolicy/source/version/updatedAt

解決順:
- custom (profile-scoped) -> builtin
- 同一ID衝突時は `CONFLICT`（silent override禁止）

### 3) Existing Lifecycle Integration

既存 `create_draft` はカードタイプ解決だけ差し替える。
`open_draft_preview` / `commit_draft` / `discard_draft` 契約は変更しない。

## Trade-offs

- custom registryをSQLite同居にする利点:
  - profile分離、監査、バックアップ手順の単純化
- 欠点:
  - DBスキーマの責務が増える
- 採用理由:
  - 既存draft metadataと同じ運用面（TTL/整合性）で管理できるため

## Rollout

1. read-only note type tools
2. `upsert_note_type` dry-run/apply
3. custom card type registry
4. draft flow integration + regressions

## Open Questions (resolved in this design)

- Q: 破壊的更新（field remove/rename）を許可するか？
  - A: Phase2では不許可。別changeで明示的migration toolとして扱う。
- Q: 問題自動生成を同時に入れるか？
  - A: 入れない。カード生成自体は既存draft flowで対応し、生成は次フェーズ分離。
