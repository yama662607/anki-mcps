# Note Type Authoring

Use note type authoring when the target field structure or template design does not exist yet.

## Recommended sequence

1. `list_note_types`
2. `get_note_type_schema` for related models
3. `upsert_note_type(dryRun=true)`
4. Review `result.operations` and `result.validation`
5. `upsert_note_type(dryRun=false)`
6. `ensure_deck`
7. `add_note`

No secondary registration step is required after `upsert_note_type`.

## Validation model

`upsert_note_type` returns structured validation data:

- `validation.canApply`
- `validation.errors[]`
- `validation.warnings[]`

Typical fatal `errors`:

- unknown field references in templates
- unbalanced or mismatched `{{#Field}} ... {{/Field}}` sections
- invalid cloze usage
- clearly broken CSS syntax

Typical `warnings`:

- fields that are defined but unused
- templates or CSS that are unusually large
- back templates that omit `{{FrontSide}}`
- suspicious HTML structure that still needs real preview confirmation

`dryRun=false` rejects the apply when `validation.errors` is non-empty.

## Safe update boundary

Allowed in place:

- add fields
- add templates
- update template HTML
- update CSS

Do not do in place:

- remove or rename fields
- remove or rename templates
- switch cloze and non-cloze mode

For destructive changes, create a new versioned `modelName`.

## Example

```json
{
  "name": "upsert_note_type",
  "arguments": {
    "profileId": "your-profile",
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
        "back": "{{FrontSide}}<hr id=\"answer\"><div>{{Fix}}</div>{{#RootCause}}<div>{{RootCause}}</div>{{/RootCause}}"
      }
    ],
    "css": ".card { background: #11161d; color: #edf3fb; }"
  }
}
```
