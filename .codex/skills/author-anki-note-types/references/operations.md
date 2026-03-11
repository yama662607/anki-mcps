# Note Type and Definition Operations

## 1. Create or update a note type

Use when a design or field structure does not exist yet.

Example user request:
- "Create a TypeScript debug note type with BuggyCode, Fix, and RootCause fields."

Example dry-run payload:
```json
{
  "name": "upsert_note_type",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "modelName": "ts.v1.debug",
    "dryRun": true,
    "fields": [
      { "name": "BuggyCode" },
      { "name": "Fix" },
      { "name": "RootCause" }
    ],
    "templates": [
      {
        "name": "Card 1",
        "front": "<pre>{{BuggyCode}}</pre>",
        "back": "{{FrontSide}}<hr id=answer><div>{{Fix}}</div><div>{{RootCause}}</div>"
      }
    ],
    "css": ".card { background: #10151d; color: #edf3fb; }"
  }
}
```

Apply the same payload with `dryRun=false` only after inspecting `operations`.

## 2. Register a reusable custom card type definition

Use after the note type shape is correct.

Example payload:
```json
{
  "name": "upsert_card_type_definition",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "definition": {
      "cardTypeId": "programming.v1.ts-debug",
      "label": "TypeScript Debug",
      "modelName": "ts.v1.debug",
      "defaultDeck": "Programming::TypeScript::Debug",
      "requiredFields": ["BuggyCode", "Fix"],
      "optionalFields": ["RootCause"],
      "renderIntent": "production",
      "allowedHtmlPolicy": "safe_inline_html",
      "fields": [
        { "name": "BuggyCode", "required": true, "type": "markdown", "allowedHtmlPolicy": "safe_inline_html" },
        { "name": "Fix", "required": true, "type": "markdown", "allowedHtmlPolicy": "safe_inline_html" },
        { "name": "RootCause", "required": false, "type": "markdown", "allowedHtmlPolicy": "safe_inline_html" }
      ]
    }
  }
}
```

## 3. Inspect and deprecate custom definitions

Use when older definitions should stop being used for new cards.

Example list payload:
```json
{
  "name": "list_card_type_definitions",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "includeDeprecated": true
  }
}
```

Example deprecate payload:
```json
{
  "name": "deprecate_card_type_definition",
  "arguments": {
    "profileId": "y@m@ちゃん",
    "cardTypeId": "programming.v1.ts-output"
  }
}
```

Rule:
- Use deprecation when a type should stop being selected for new cards.
- Re-run `upsert_card_type_definition` for the same `cardTypeId` to reactivate it.

## 4. Safe update boundary

Allowed:
- add fields
- add templates
- update template HTML
- update CSS

Do not do in place:
- remove fields
- rename fields
- remove templates
- rename templates
- switch cloze and non-cloze mode

For those cases, create a new versioned model instead.
