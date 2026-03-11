## Context

本プロジェクトは、語学学習・プログラミング学習・基礎知識暗記向けに、用途別カードタイプを選んで安全にAnkiへ追加するMCPサーバーを設計する。既存のAnki MCP実装は、(a) 低レベルAPIの列挙が中心、または (b) 高レベル操作があるが「追加前確認」と「確定/破棄」の境界が弱いものが多い。今回はこの弱点を補い、`draft -> GUI確認 -> commit/discard` を第一級の契約として設計する。

制約:
- 最終表示確認はAnki GUIを正とする（MCP側HTMLレンダリングは非採用）
- AnkiConnect依存であり、Anki起動状態やGUI可用性の影響を受ける
- 実装前段階として、ツール・リソース・テスト契約を先に固定する

## Goals / Non-Goals

**Goals:**
- カードタイプ中心の追加体験を標準化し、AIが誤ったmodel/fieldを推測しなくてよい状態を作る
- 破壊的操作を明示的に分離し、誤追加・誤確定のリスクを低減する
- 既存実装より高い可観測性（状態遷移追跡）とテスト容易性を確保する
- OpenSpec上で、後続実装に直接接続できる要求仕様と作業分解を完成させる

**Non-Goals:**
- このchangeでTypeScript実装を完了させること
- Anki内部レンダラーとの完全同等なHTMLプレビュー実装
- すべてのAnkiConnectアクションを網羅して公開すること

## Decisions

### 1) ツール分割はハイブリッド戦略を採用する
- 決定: `list/get/create/preview` は高レベル、`commit/discard` は明示分離
- 理由: 分割しすぎると呼び出し回数が増えるが、統合しすぎると事故時の切り分けと権限境界が曖昧になるため
- 代替案:
  - 全分割: 安全だがUXが重い
  - 全統合: UXは軽いが誤操作時の被害が大きい

### 2) ステージングを正規ライフサイクルとして扱う
- 決定: `draftId` を中心に `draft/committed/discarded` 状態を管理する
- 理由: セッション断やGUI失敗時でも復旧可能にし、運用時の信頼性を上げるため
- 代替案:
  - 即時追加のみ: 実装は簡単だが確認フローの品質が低い

### 3) カタログをツール + リソースの二面提供にする
- 決定: `list_card_types` と Resource の両方を提供
- 理由: エージェント実行ではツール、キャッシュ/監査ではリソースが有利
- 代替案:
  - ツールのみ: クライアント側キャッシュ戦略が不統一

### 4) エラー契約を構造化する
- 決定: すべての失敗で安定した `code/message/hint/context` 形式を返す
- 理由: エージェントの自動リトライ/分岐に必要
- 代替案:
  - 文字列エラーのみ: 人間は読めるが機械処理しにくい

### 5) 既存クローンより優位にするための設計軸を固定する
- 決定: 優位性を「安全性」「復旧性」「契約テスト」「運用可観測性」で評価する
- 理由: ツール数や機能数だけで比較すると、運用品質が担保されないため

### 6) draftメタデータ永続化はSQLiteを採用する
- 決定: draft lifecycleの永続メタデータはSQLiteに保存する
- 理由: `draftId` の一意制約、状態遷移の原子性、マルチプロファイル分離、監査クエリ、将来の移行・集計を低コストで実現できるため
- 代替案:
  - JSONL: 実装は簡単だが、競合・重複・部分書き込み回復・複雑検索が弱い

### 7) マルチプロファイル対応を初期仕様に含める
- 決定: すべてのdraft関連データは `profileId` を必須キーに含める
- 理由: 同一環境で複数学習プロファイルを混在運用しても誤コミットを防げるため
- 代替案:
  - 単一プロファイル前提: 初期実装は簡単だが将来破壊的変更になる

### 8) 手動編集と再作成に対応する整合性ポリシーを採用する
- 決定: commit時に楽観的整合性チェック（revision/hash）を行い、差分検知時は `CONFLICT` を返す。再作成は `supersedesDraftId` を使った新規draft作成で扱う
- 理由: GUI上の手動編集やユーザー指示による作り直しを安全に扱うため
- 補足: 初期版では `forceCommit` は不許可とし、競合時は再ステージを必須にする
- 代替案:
  - 無条件commit: 競合を見落として意図しない状態を確定しやすい

### 9) cleanupのデフォルト閾値は72時間とする
- 決定: `cleanup_drafts` のデフォルトを 72h に設定する
- 理由: 短すぎるとレビュー中断に弱く、長すぎるとステージ汚染が進むため
- 代替案:
  - 24h: クリーンだが中断復帰に厳しい
  - 168h: 復帰には強いが管理負荷が増える

### 10) Anki分類に基づく運用モデルを仕様化する
- 決定: `profile/deck/note type/note/card/tag` の責務を明示し、MCPツールがどの分類を操作するかを固定する
- 理由: 分類責務が曖昧なままでは、デザイン変更・学習設定・スケジューリング状態が混線し、運用事故を起こしやすいため
- 代替案:
  - 暗黙運用: 実装は早いが、拡張時に用語と責務が崩れやすい

### 11) ツールI/O契約を厳格化する
- 決定: 各ツールは厳格スキーマ（追加プロパティ拒否）を採用し、レスポンスは契約バージョン単位で安定化する
- 理由: クライアント実装の分岐を単純化し、曖昧入力による偶発挙動を防ぐため
- 代替案:
  - 緩いスキーマ: 互換性は高いが誤入力が運用で顕在化しやすい

### 12) エラーコード辞書を固定する
- 決定: v1の正規エラーコードを `INVALID_ARGUMENT`, `NOT_FOUND`, `CONFLICT`, `DEPENDENCY_UNAVAILABLE`, `PROFILE_REQUIRED`, `PROFILE_SCOPE_MISMATCH`, `INVALID_STATE_TRANSITION`, `INVALID_SUPERSEDE_SOURCE`, `FORBIDDEN_OPERATION` に固定する
- 理由: 再試行可否と運用アクションを機械的に判定できるようにするため
- 代替案:
  - 自由形式エラー: 実装は早いが自動復旧しにくい

### 13) 状態遷移表を実装契約にする
- 決定: `draft -> committed|discarded|superseded`, `superseded -> discarded` のみ許可し、その他遷移は拒否する
- 理由: ライフサイクル不整合とダブルコミット事故を防ぐため
- 代替案:
  - 暗黙遷移: 柔軟だが監査とテストが難しい

### 14) プロファイル解決順を固定する
- 決定: `request.profileId` 優先、次に一意な active profile、解決不能時は fail-closed (`PROFILE_REQUIRED`)
- 理由: マルチプロファイル運用で誤対象書き込みを防ぐため
- 代替案:
  - last-used profile fallback: 便利だが誤書き込みリスクが高い

### 15) 競合検知のfingerprint対象を固定する
- 決定: fingerprintは canonicalized `modelName`, `fields`, `sortedTags`, `profileId`, `noteId`, `modTimestamp` から算出する
- 理由: 手動編集検知の再現性を担保し、誤commitを防ぐため
- 代替案:
  - 単純なtimestampのみ比較: 実装は容易だが誤検知/見逃しが増える

### 16) supersedeの成立条件を固定する
- 決定: `supersedesDraftId` は `draft` 状態のみ受理し、旧draftを `superseded` に遷移、直接commitは禁止する
- 理由: ユーザーフィードバック反映時の作り直しを安全にトレース可能にするため
- 代替案:
  - 任意状態をsupersede可: 柔軟だがチェーン整合性が崩れやすい

### 17) カードタイプ定義の最小必須項目を固定する
- 決定: catalog entryの必須項目を `cardTypeId`, `label`, `modelName`, `defaultDeck`, `requiredFields`, `renderIntent`, `allowedHtmlPolicy` に固定する
- 理由: 用途選択と入力制約を機械的に判断できるようにするため
- 補足: `renderIntent` は `recognition|production|cloze|mixed`、`allowedHtmlPolicy` は `plain_text_only|safe_inline_html|trusted_html`
- 代替案:
  - 任意メタデータ: 拡張は楽だがクライアント選択ロジックが不安定になる

### 18) GUIプレビュー完了条件をcommit前提にする
- 決定: commit前に `対象カード一致`, `question確認`, `answer確認` の3条件を満たし、commit requestにレビュー決定ペイロードを必須化する
- 理由: 「見たつもり」での確定を減らし、レビュー工程を監査可能にするため
- 代替案:
  - 手順のみ推奨して強制しない: UXは軽いが誤確定の再発防止が弱い

### 19) SQLiteスキーマと保持期間を設計段階で固定する
- 決定: `drafts` テーブルを中核に、`(profileId, draftId)` 一意制約、`(profileId, state, updatedAt)` / `(profileId, supersedesDraftId)` インデックス、`draft/superseded=72h`, `committed/discarded=30d` 保持を採用する
- 理由: 実装者間の解釈差を排除し、cleanupと監査を予測可能にするため
- 代替案:
  - 実装時に都度決定: 初期速度は出るが移行コストと不整合リスクが高い

### 20) clone比較の定量KPIゲートを固定する
- 決定: `safety/recovery/testability/observability` の4軸を5点満点評価し、各軸4点以上かつ総合点でbest cloneを上回ることを採択条件にする
- 理由: 「良さそう」ではなく、採用可否を再現可能な基準で判定するため
- 補足: 安全性は `auto-commit 0`, `duplicate commit duplicate 0` を必須KPIに含める
- 代替案:
  - 定性比較のみ: 判断がレビュー担当者依存になりやすい

### 21) draftカードの学習混入を禁止する
- 決定: `create_draft` 時に draft専用タグを必須付与し、学習キューから除外する。`commit` で解除、`discard` で削除する
- 理由: 下書きの誤出題は学習品質と運用信頼性を直接損なうため
- 代替案:
  - タグ付与のみで除外しない: 実運用で混入事故が残る

### 22) create_draftの冪等キーを必須化する
- 決定: `clientRequestId` を `create_draft` の必須入力にし、同一`profileId + clientRequestId` の再送は同一draftを返す
- 理由: 通信再試行やエージェント再実行で重複下書きを作らないため
- 代替案:
  - サーバ側の曖昧重複判定: 実装差と誤判定が増える

### 23) allowedHtmlPolicyを実装可能な境界まで固定する
- 決定: `plain_text_only` はHTMLエスケープ、`safe_inline_html` は厳格allowlist、`trusted_html` は素通しに固定する
- 理由: クライアント間で表示差・安全性差が出ないようにするため
- 代替案:
  - ポリシー名のみ定義: 実装者ごとに挙動が分岐する

### 24) write系profile指定を必須化する
- 決定: `create/commit/discard/cleanup` は `profileId` 必須とし、未指定は fail-closed (`PROFILE_REQUIRED`)
- 理由: active profileの自動解決依存を減らし、誤プロファイル書き込みを防ぐため
- 代替案:
  - すべて自動解決: UXは軽いが誤対象リスクが高い

## Frozen Tool Contracts (v1)

契約バージョン: `1.0.0`

共通ルール:
- すべてのrequest schemaは `additionalProperties=false`
- すべてのresponseは先頭に `contractVersion` と `profileId` を含む
- エラーは `code`, `message`, `retryable`, `hint`, `context` を返す
- write系ツールは `profileId` 必須（未指定は `PROFILE_REQUIRED`）
- read系ツールのみ `profileId` 解決順を `request.profileId -> unique active profile -> PROFILE_REQUIRED` とする

### list_card_types
- request:
  - `profileId?: string`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `catalogVersion: string`
  - `cardTypes: CardTypeSummary[]`

### get_card_type_schema
- request:
  - `cardTypeId: string`
  - `profileId?: string`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `catalogVersion: string`
  - `cardType: CardTypeSummary`
  - `fields: FieldSchema[]`

### create_draft
- request:
  - `cardTypeId: string`
  - `profileId: string`
  - `clientRequestId: string`
  - `fields: Record<string, string>`
  - `deckName?: string`
  - `tags?: string[]`
  - `supersedesDraftId?: string`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `draft: DraftRecord`

### open_draft_preview
- request:
  - `draftId: string`
  - `profileId?: string`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `draftId: string`
  - `preview: { opened: boolean, selectedNoteId: number, selectedCardIds: number[], browserQuery: string }`

### commit_draft
- request:
  - `draftId: string`
  - `profileId: string`
  - `reviewDecision: { targetIdentityMatched: boolean, questionConfirmed: boolean, answerConfirmed: boolean, reviewedAt: string, reviewer: "user" | "agent" }`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `result: { status: "committed" | "already_committed", draftId: string, noteId: number, cardIds: number[], committedAt: string }`

### discard_draft
- request:
  - `draftId: string`
  - `profileId: string`
  - `reason?: "user_request" | "cleanup" | "superseded" | "conflict_recovery"`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `result: { status: "discarded" | "already_discarded", draftId: string, discardedAt: string, deletedNoteId?: number }`

### list_drafts
- request:
  - `profileId?: string`
  - `states?: Array<"draft" | "superseded" | "committed" | "discarded">`
  - `limit?: number` (`1..200`, default `50`)
  - `cursor?: string`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `items: DraftListItem[]`
  - `nextCursor?: string`

### cleanup_drafts
- request:
  - `profileId: string`
  - `olderThanHours?: number` (default `72`)
  - `states?: Array<"draft" | "superseded">`
- response:
  - `contractVersion: "1.0.0"`
  - `profileId: string`
  - `olderThanHours: number`
  - `deletedCount: number`
  - `deletedDraftIds: string[]`
  - `executedAt: string`

### Shared Types
- `CardTypeSummary`:
  - `cardTypeId: string`
  - `label: string`
  - `modelName: string`
  - `defaultDeck: string`
  - `requiredFields: string[]`
  - `renderIntent: "recognition" | "production" | "cloze" | "mixed"`
  - `allowedHtmlPolicy: "plain_text_only" | "safe_inline_html" | "trusted_html"`
- `FieldSchema`:
  - `name: string`
  - `required: boolean`
  - `type: "text" | "markdown" | "html" | "audio_ref" | "image_ref"`
  - `minLength?: number`
  - `maxLength?: number`
  - `multiline?: boolean`
  - `example?: string`
  - `hint?: string`
- `ValidationIssue`:
  - `code: string`
  - `message: string`
  - `field?: string`
  - `hint?: string`
- `DraftRecord`:
  - `draftId: string`
  - `noteId: number`
  - `cardIds: number[]`
  - `state: "draft"`
  - `cardTypeId: string`
  - `fingerprint: string`
  - `supersedesDraftId?: string`
  - `chainDepth: number`
  - `createdAt: string`
  - `updatedAt: string`
- `DraftListItem`:
  - `draftId: string`
  - `noteId: number`
  - `state: "draft" | "superseded" | "committed" | "discarded"`
  - `cardTypeId: string`
  - `supersedesDraftId?: string`
  - `chainDepth: number`
  - `createdAt: string`
  - `updatedAt: string`

## Risks / Trade-offs

- [Risk] GUI依存でE2Eが不安定化する
  - Mitigation: GUIを使うE2Eと非GUI契約テストを分離し、CIではヘッドレス可否に応じたレイヤー運用にする

- [Risk] ステージング状態とAnki実体の不整合
  - Mitigation: `list_drafts` と整合性チェックジョブ、`cleanup_drafts` を必須化する

- [Risk] カタログ肥大化でメンテナンス負荷増大
  - Mitigation: カタログ定義をスキーマ化し、CIでlint/validationを行う

- [Risk] ツール分割が多く感じられる
  - Mitigation: v2で `add_card_from_type`（確認省略ショートカット）を追加する

- [Risk] DeckとNote Typeの責務誤認による誤運用
  - Mitigation: 運用モデル仕様で「見た目はNote Type、学習設定はDeck、進捗はCard」を明記し、各ツール説明とテストに反映する

## Migration Plan

1. Phase 0: OpenSpecにproposal/specs/design/tasksを確定
2. Phase 1: カタログとvalidationの実装
3. Phase 2: draft lifecycle（create/list/commit/discard/cleanup）実装
4. Phase 3: GUI preview統合とエラーモデル統一
5. Phase 4: 契約テスト・統合テスト・回帰テストをCIに組み込み

ロールバック方針:
- 初期実装はstaging-onlyモードで導入し、`commit` を機能フラグで段階解放する
- 不具合時は `commit` を停止して `discard` のみ許可する

## Open Questions

- なし（現時点）
