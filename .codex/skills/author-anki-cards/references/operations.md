# Card Operations

## 1. Create one draft

Example user request:
- "Add one TypeScript concept card about `any` vs `unknown`."

Recommended sequence:
1. `get_card_type_schema`
2. `create_draft`
3. `get_draft`
4. `open_draft_preview`
5. Wait for explicit approval
6. `commit_draft` or `discard_draft`

Example create payload:
```json
{
  "name": "create_draft",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "clientRequestId": "ts-concept-any-vs-unknown-001",
    "cardTypeId": "programming.v1.ts-concept",
    "fields": {
      "Prompt": "`any` と `unknown` の違いは何ですか？",
      "Answer": "`unknown` は利用前に型の絞り込みが必要です。",
      "DetailedExplanation": "`any` は型検査を迂回しますが、`unknown` は安全側に倒れます。"
    }
  }
}
```

## 2. Revise after user feedback

Use when the user says "ここを変更してください" after preview.

Pattern:
1. `get_draft`
2. build corrected fields
3. call `create_draft` with a new `clientRequestId` and `supersedesDraftId`
4. preview the new draft
5. commit only the latest draft

Example correction payload:
```json
{
  "name": "create_draft",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "clientRequestId": "ts-concept-any-vs-unknown-002",
    "cardTypeId": "programming.v1.ts-concept",
    "supersedesDraftId": "old-draft-id",
    "fields": {
      "Prompt": "`any` と `unknown` の違いを説明してください。",
      "Answer": "`unknown` は安全で、使う前に絞り込みが必要です。"
    }
  }
}
```

## 3. Create cards in batch

Example user request:
- "TypeScript output prediction cardsを3枚追加してください。"

Example batch payload:
```json
{
  "name": "create_drafts_batch",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "items": [
      {
        "itemId": "ts-output-1",
        "clientRequestId": "ts-output-1-v1",
        "cardTypeId": "programming.v1.ts-output",
        "fields": {
          "Code": "const x: string | number = 1;\nif (typeof x === 'number') console.log(x + 1);",
          "Question": "出力は何ですか？",
          "Expected": "2",
          "Reason": "`typeof x === 'number'` で narrowing されます。"
        }
      },
      {
        "itemId": "ts-output-2",
        "clientRequestId": "ts-output-2-v1",
        "cardTypeId": "programming.v1.ts-output",
        "fields": {
          "Code": "console.log(typeof null);",
          "Question": "出力は何ですか？",
          "Expected": "object",
          "Reason": "JavaScript の歴史的仕様です。"
        }
      }
    ]
  }
}
```

Batch finalize example:
```json
{
  "name": "discard_drafts_batch",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "items": [
      { "itemId": "ts-output-1", "draftId": "draft-1", "reason": "user_request" },
      { "itemId": "ts-output-2", "draftId": "draft-2", "reason": "user_request" }
    ]
  }
}
```

## 4. Recover after interruption

Sequence:
1. `list_drafts`
2. `get_draft`
3. `open_draft_preview` if visual confirmation is still needed
4. `commit_draft`, `discard_draft`, or `cleanup_drafts`

Rule:
- Prefer explicit discard for known drafts.
- Use cleanup only for stale leftovers.
