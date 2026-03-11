## Context

現行実装は単発の card authoring に必要な安全境界を持っているが、教材パックを継続的に追加・整理する運用にはまだ弱い。具体的には、custom card type 定義の一覧確認と整理、draft 1件の詳細確認、そして複数問題をまとめて draft / commit / discard する操作が不足している。

この change では、既存の `draft -> preview -> commit/discard` 方針を維持したまま、authoring operations を足す。新しい高リスク概念は導入せず、既存の draft store と custom card type registry を拡張する。

## Goals / Non-Goals

**Goals:**
- 問題追加運用に必要な最小 authoring ツール群を揃える
- batch 操作を追加しつつ、既存の review-first 契約を壊さない
- custom card type 定義を削除ではなく deprecate で安全に整理できるようにする
- 実装前に最小テスト行列を固定し、過剰なテスト追加を防ぐ

**Non-Goals:**
- 問題文の自動生成
- draft のその場更新
- custom card type 定義の物理削除 API
- transactional all-or-nothing batch rollback

## Decisions

### 1. batch 操作は「部分成功あり」の itemized response にする
- 決定: `create/commit/discard` の batch 版は単一トランザクションではなく、各 item を独立実行し、`results[]` で成功/失敗を返す。
- 理由: Anki 側操作は note 単位で完結しており、複数 note を完全に巻き戻すより、失敗 item を明示して再試行可能にする方が安全で単純。
- 代替案: all-or-nothing rollback。実装と復旧が重く、AnkiConnect 境界でも扱いにくい。

### 2. batch commit は item ごとの reviewDecision を必須にする
- 決定: batch commit でも各 draft に対して個別の `reviewDecision` を要求する。
- 理由: 既存の commit 前提条件を弱めないため。レビュー確認を batch で曖昧にしない。
- 代替案: 共通 reviewDecision 1つ。UX は軽いが監査性が落ちる。

### 3. draft の詳細取得は persisted draft を正本にする
- 決定: `get_draft` は draft store 上の内容とメタデータを返す read ツールとし、live note 差分検知までは含めない。
- 理由: 役割を「agent が再提案や説明に必要な情報取得」に絞るため。live 整合性確認は既存の commit-time conflict detection が担う。
- 代替案: live snapshot も毎回返す。便利だが read tool が重くなり、責務も曖昧になる。

### 4. custom card type 定義の整理は delete ではなく deprecate を採用する
- 決定: 誤定義の後始末は `deprecated` 状態への遷移で扱う。
- 理由: 既存 draft や運用履歴との参照整合性を壊さず、誤削除の復旧も容易にするため。
- 代替案: 物理削除。単純だが監査と復旧が弱い。

### 5. deprecated 定義は新規作成経路から隠す
- 決定: `list_card_types` と `list_card_type_definitions` は既定で active のみ返し、deprecated は明示 opt-in 時だけ返す。deprecated な `cardTypeId` では新規 `create_draft` を拒否する。
- 理由: 誤って旧定義を使い続ける事故を防ぐため。
- 代替案: 常時表示。可視性は高いが運用ノイズが増える。

### 6. テストは新ツール境界に限定する
- 決定: 今回の品質ゲートは `service`, `MCP handler`, `real-Anki smoke` の3層に絞る。
- 理由: 既存 contract 群はすでにカバー済みであり、今回の差分は新ツールと registry 状態遷移に集中しているため。
- 代替案: UI や大量 fixture の snapshot まで広げる。現段階では過剰。

## Risks / Trade-offs

- [部分成功 batch の扱いを誤る] → 各 item に stable id と error payload を返し、summary は参考情報に留める
- [deprecated 定義が既存運用で参照不能になる] → read 系は `includeDeprecated=true` を許可し、既存記録の参照は維持する
- [get_draft だけでは説明が不足する] → response に fields/tags/deck/cardType metadata を含め、preview 前後の再説明に必要な情報を揃える
- [テストを増やしすぎる] → 新規ツールの成功/失敗/境界のみを固定し、既存契約の重複検証は避ける

## Migration Plan

1. contract resource に新ツール schema を追加する
2. custom card type definition に `status/deprecatedAt` を追加する
3. read tools を active-only default に揃える
4. batch / inspection tools を実装する
5. service 層と MCP 層の差分テストを追加する
6. real-Anki smoke に batch draft create と finalize の最小経路を追加する

Rollback:
- 新ツールは additive なので既存 client は壊れない
- `deprecated` 化は reversible にし、必要なら同じ定義を active で再 upsert できるようにする

## Open Questions

- なし
