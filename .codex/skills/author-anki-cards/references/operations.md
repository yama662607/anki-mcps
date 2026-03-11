# Card Operations

## 1. Create one staged card

Example user request:
- "Add one TypeScript concept card about `any` vs `unknown`."

Recommended sequence:
1. `get_card_type_schema`
2. `validate_card_fields`
3. `create_staged_card`
4. `get_staged_card`
5. `open_staged_card_preview`
6. Wait for explicit approval
7. `commit_staged_card` or `discard_staged_card`

Example create payload:
```json
{
  "name": "create_staged_card",
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
1. `get_staged_card`
2. build corrected fields
3. call `create_staged_card` with a new `clientRequestId` and `supersedesDraftId`
4. preview the new draft
5. commit only the latest draft

Example correction payload:
```json
{
  "name": "create_staged_card",
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
  "name": "create_staged_cards_batch",
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
  "name": "discard_staged_cards_batch",
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
1. `list_staged_cards`
2. `get_staged_card`
3. `open_staged_card_preview` if visual confirmation is still needed
4. `commit_staged_card`, `discard_staged_card`, or `cleanup_staged_cards`

Rule:
- Prefer explicit discard for known drafts.
- Use cleanup only for stale leftovers.
