## Why

現行のMCPは単発の draft 追加には十分だが、教材を継続的に投入・整理する authoring 基盤としては不足がある。問題データを安全に増やす前に、batch 操作、draft 詳細参照、custom card type 定義の運用整理、そしてそれらの最小テスト契約を固める必要がある。

## What Changes

- batch で draft を作成・commit・discard できる MCP ツール契約を追加する
- draft 1件の詳細を取得する read ツール契約を追加する
- profile-scoped custom card type 定義を一覧参照し、誤定義を `deprecated` 扱いにできる運用契約を追加する
- authoring operations に対する最小テスト行列と品質ゲートを追加する
- 既存の preview-first / supersede-based correction 方針は維持し、既存 write ツールの意味は変えない

## Capabilities

### New Capabilities
- `authoring-batch-operations`: batch draft create/commit/discard の契約、制約、部分失敗ポリシーを定義する
- `draft-inspection`: draft 1件の詳細取得と agent-side review 用の安定レスポンスを定義する
- `cardtype-definition-lifecycle`: custom card type 定義の list/deprecate 契約と可視性ルールを定義する
- `authoring-quality-gates`: authoring operations に必要な unit/integration/E2E の最小テスト仕様と pass 条件を定義する

### Modified Capabilities
- なし

## Impact

- MCP ツール追加: batch 操作、draft inspection、card type definition 管理
- contract resource (`anki://contracts/v1/tools`) の拡張
- custom card type 永続化スキーマの拡張または活用方法の更新
- テスト追加: service 層、MCP handler 層、real-Anki smoke の authoring operation 拡張
