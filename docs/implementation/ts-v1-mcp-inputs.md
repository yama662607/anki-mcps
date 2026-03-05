# TypeScript Starter 3 Cards: MCP Tool Inputs

Current implementation does not yet support creating new Anki note types via MCP.
So these examples use existing `cardTypeId: programming.v1.concept-qa` (`Front/Back/Code`).
If your Anki model does not have `Code` field, omit `Code` from input (server now skips unspecified optional fields).

## 0) Recommended flow

1. `validate_card_fields`
2. `create_staged_card`
3. `open_staged_card_preview`
4. `commit_staged_card` (only after explicit user approval)

## 1) Concept card (any vs unknown)

### `validate_card_fields`
```json
{
  "profileId": "local-main",
  "cardTypeId": "programming.v1.concept-qa",
  "deckName": "Programming::TypeScript::Concept",
  "tags": ["programming", "typescript", "ts-concept", "starter"],
  "fields": {
    "Front": "TypeScript Concept: any vs unknown",
    "Back": "any disables type checking. unknown preserves type safety and requires narrowing before use.\n\nlet a: any = \"x\";\na.toFixed();\n\nlet u: unknown = \"x\";\n// u.toFixed();\nif (typeof u === \"string\") {\n  u.toUpperCase();\n}"
  }
}
```

### `create_staged_card`
```json
{
  "profileId": "local-main",
  "clientRequestId": "ts-starter-001-concept-any-unknown",
  "cardTypeId": "programming.v1.concept-qa",
  "deckName": "Programming::TypeScript::Concept",
  "tags": ["programming", "typescript", "ts-concept", "starter"],
  "fields": {
    "Front": "TypeScript Concept: any vs unknown",
    "Back": "any disables type checking. unknown preserves type safety and requires narrowing before use.\n\nlet a: any = \"x\";\na.toFixed();\n\nlet u: unknown = \"x\";\n// u.toFixed();\nif (typeof u === \"string\") {\n  u.toUpperCase();\n}"
  }
}
```

## 2) Output card (union narrowing)

### `create_staged_card`
```json
{
  "profileId": "local-main",
  "clientRequestId": "ts-starter-002-output-union-narrowing",
  "cardTypeId": "programming.v1.concept-qa",
  "deckName": "Programming::TypeScript::Output",
  "tags": ["programming", "typescript", "ts-output", "starter"],
  "fields": {
    "Front": "TypeScript Output: What can be printed?",
    "Back": "Expected: \"HI\" or \"42.0\". Reason: typeof narrowing picks string or number branch.\n\nconst x: string | number = Math.random() > 0.5 ? \"hi\" : 42;\nif (typeof x === \"string\") {\n  console.log(x.toUpperCase());\n} else {\n  console.log(x.toFixed(1));\n}"
  }
}
```

## 3) Debug card (nullable union)

### `create_staged_card`
```json
{
  "profileId": "local-main",
  "clientRequestId": "ts-starter-003-debug-nullable-union",
  "cardTypeId": "programming.v1.concept-qa",
  "deckName": "Programming::TypeScript::Debug",
  "tags": ["programming", "typescript", "ts-debug", "starter"],
  "fields": {
    "Front": "TypeScript Debug: fix Object is possibly null",
    "Back": "Symptom: Object is possibly null. RootCause: union includes null. Rule: narrow nullable unions before property access. Fix: if (!user) return ...\n\ntype User = { name: string };\nfunction greet(user: User | null) {\n  return \"Hi \" + user.name;\n}"
  }
}
```

## Preview and decision

After `create_staged_card`, call:

```json
{
  "profileId": "local-main",
  "draftId": "<draftId-from-create>"
}
```

Then decide:
- Commit: `commit_staged_card` with all reviewDecision flags `true`
- Or discard: `discard_staged_card`
