## Why

Ankiにカードを安全かつ一貫した品質で追加するためには、デッキ中心ではなく「用途別カードタイプ（ノートタイプ）」中心のMCP設計が必要です。先に仕様を固めずに実装すると、ツール分割・確認フロー・テスト戦略が後戻りしやすいため、今この段階で設計を確定します。

## What Changes

- 事前定義されたカードタイプをMCP経由で検索・選択・検証できる仕様を追加する
- カード追加を `draft -> GUI確認 -> commit/discard` の2段階フローに統一する
- 書き込み系と読み取り系の責務境界、権限制御、エラーモデルを仕様化する
- Ankiの分類（profile/deck/note type/note/card/tag）を前提にした運用モデルを仕様化する
- リソース（カタログ定義、テンプレート、運用メタデータ）を標準化する
- テスト要件（ユニット/統合/E2E/回帰）と品質ゲートを明文化する
- 既存クローン実装を比較して、採用・不採用の設計判断を記録する

## Capabilities

### New Capabilities
- `cardtype-catalog`: 用途別カードタイプ（model/field/validation/default deck/tags）を発見・参照・検証する機能
- `draft-lifecycle`: カード下書き作成、GUIプレビュー、確定、破棄、クリーンアップまでのライフサイクル管理機能
- `mcp-safety-and-contract`: ツール分割方針、入出力スキーマ、権限境界、エラー形式、監査可能性を保証するMCP契約
- `anki-information-architecture`: Anki分類単位の責務分離と、運用時の標準ワークフローを定義する機能

### Modified Capabilities
- なし（初期仕様のため）

## Impact

- `openspec/specs/` に新規仕様を追加
- 今後のTypeScript実装（ツール、リソース、テスト）の土台を変更
- AnkiConnect GUIアクション利用方針（MCP側HTMLレンダリング非採用）を確定
- リポジトリ内ドキュメントとしてMCPベストプラクティス調査結果を追加
