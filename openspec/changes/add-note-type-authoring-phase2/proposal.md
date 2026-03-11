## Why

現行v1は「既存カードタイプを使った draft 追加」は完成しているが、ノートタイプ（テンプレート/CSS/フィールド）をMCPから作成・更新できない。結果として、用途別デザインを事前準備する運用が手作業に依存し、AIエージェント運用の再現性が落ちる。

## What Changes

- ノートタイプをMCP経由で発見・参照・安全に作成/更新できる機能を追加する
- カスタムカードタイプ定義を永続化し、既存 `create_draft` フローに接続する
- 既存の preview-first / commit-or-discard ポリシーは維持する
- 破壊的なノートタイプ変更（フィールド削除/改名）はデフォルト拒否にする

## Scope

- In scope:
  - `list_note_types` / `get_note_type_schema`（read）
  - `upsert_note_type`（write, `dryRun` 対応, additive-safe）
  - `upsert_card_type_definition`（write, custom catalog管理）
  - `list_card_types` / `get_card_type_schema` / `` が custom catalog を読めるように拡張
  - `create_draft` が custom cardTypeId を解決できるように拡張
- Out of scope:
  - 問題文の自動生成（LLM生成）
  - 既存ノートタイプに対する破壊的マイグレーション自動実行
  - HTMLレンダラー実装

## Impact

- MCPツール追加（note type authoring 系）
- SQLiteスキーマ追加（custom card type registry）
- カタログ解決ロジックを static-only から merged (builtin + custom) に変更
- 既存 draft lifecycle の契約は維持し、入力元のみ拡張

## Gaps/Clarifications

- `openspec/project.md` と `openspec/AGENTS.md` は現リポジトリに存在しないため、既存 change と実装コードを根拠に計画化した。
