# MCP Tool Design Best Practices (Research)

Updated: 2026-03-05 (JST)

## Purpose

Anki向けMCPサーバー設計で「ツールをどこまで分割するか」を決めるため、MCP公式仕様/ガイドと主要LLMベンダーのツール設計ガイドを調査した。

## Key Findings

### 1) MCP仕様上の基本原則は「明確で集中したツール」

- MCPのツールは「明確な入力スキーマ」「明確な出力」「安全に呼び出せる境界」を持つことが前提。
- 目的が曖昧で多機能すぎるツールは、推論時の誤使用・曖昧な失敗原因につながる。

Implication:
- 破壊的操作（commit/discardなど）は分離し、呼び出し意図を明確化する。

### 2) 実運用では「ツール統合」も有効（タスク完了単位）

- Anthropicのガイドでは、関連する低レベル処理を適切に統合し、モデルが少ない呼び出しで目的達成できる設計を推奨。
- ただし統合しすぎると入力スキーマが肥大化し、失敗切り分けが難しくなる。

Implication:
- 読み取り/検索/整形は高レベル統合、書き込み確定は分離が妥当。

### 3) ツール定義はトークンコストに直結する

- ツール数・説明文・スキーマはコンテキストトークンに乗る。
- ツールが多いほど毎ターンの負荷が増えやすい。

Implication:
- 常時公開ツールは最小化し、ワークフロー段階ごとに有効ツールを絞る運用が必要。

### 4) 大規模ツール群では「そのターンで使うツールだけ見せる」

- 高度ツール利用では、`allowed_tools` のような制約や、ツール検索で候補を絞る戦略が有効。

Implication:
- `catalog/validation` 段階と `commit/discard` 段階で許可ツールセットを分離する。

### 5) 構造化エラー契約が必須

- リトライ・分岐・自己修復には、文字列のみではなく機械可読なエラーコードが必要。

Implication:
- `code`, `message`, `hint`, `context` を標準化する。

### 6) テストは「契約テスト + 統合 + GUI E2E」の三層が必要

- ツール契約（schema/エラー）と、AnkiConnect依存の統合、GUI依存のE2Eを分けると回帰に強い。

Implication:
- GUI失敗時のrecoverability（draft保持）を必須ケースとして固定する。

## Recommended Policy for This Project

### A. Granularity Policy

- High-level (まとめる):
  - `list_card_types`, `get_card_type_schema`, `create_draft`, `open_draft_preview`
- Fine-grained (分ける):
  - `commit_draft`, `discard_draft`, `cleanup_drafts`

### B. Safety Policy

- 書き込み確定は `commit` のみ
- プレビュー段階では draft 作成以外の本番変更を禁止
- すべての状態遷移を構造化ログで記録

### C. Performance Policy

- ツール説明を簡潔化（過剰な自然文を避ける）
- 大量結果はページング必須
- ターンごとに利用ツール集合を限定

## Open Risks to Resolve Before Implementation

- `draftId` メタデータ永続化方式（SQLite vs JSONL）
- マルチプロファイル時のID名前空間
- GUI上の手動編集をcommit時にどう扱うか

## Sources

- MCP Server Concepts: https://modelcontextprotocol.io/docs/learn/server-concepts
- MCP Specification (tools): https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP Legacy Tools Concepts: https://modelcontextprotocol.io/legacy/concepts/tools
- Anthropic: Writing tools for agents (2025-09-11): https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic: Advanced tool use (2025-11-24): https://www.anthropic.com/engineering/advanced-tool-use
- Claude Tool Use Overview (token/cost implications): https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
- OpenAI GPT-5 guide (`allowed_tools` mention): https://platform.openai.com/docs/guides/gpt-5
