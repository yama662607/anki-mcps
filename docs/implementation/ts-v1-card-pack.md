# TypeScript v1 Card Pack (Concept / Output / Debug)

This file defines initial note-type templates and starter cards for TypeScript learning.

## 1) `ts.v1.concept`

### Fields
- `Prompt`
- `Answer`
- `Contrast`
- `Example`

### Front Template
```html
<div class="ts-card ts-concept">
  <div class="badge">TypeScript Concept</div>
  <div class="prompt">{{Prompt}}</div>
  {{#Contrast}}<div class="contrast">Compare: {{Contrast}}</div>{{/Contrast}}
</div>
```

### Back Template
```html
{{FrontSide}}
<hr id="answer" />
<div class="answer">{{Answer}}</div>
{{#Example}}<pre class="code"><code>{{Example}}</code></pre>{{/Example}}
```

## 2) `ts.v1.output`

### Fields
- `Code`
- `Question`
- `Expected`
- `Reason`

### Front Template
```html
<div class="ts-card ts-output">
  <div class="badge">TypeScript Output</div>
  <pre class="code"><code>{{Code}}</code></pre>
  <div class="question">{{Question}}</div>
</div>
```

### Back Template
```html
{{FrontSide}}
<hr id="answer" />
<div class="expected"><strong>Expected:</strong> {{Expected}}</div>
<div class="reason"><strong>Reason:</strong> {{Reason}}</div>
```

## 3) `ts.v1.debug`

### Fields
- `BuggyCode`
- `Symptom`
- `Fix`
- `RootCause`
- `Rule`

### Front Template
```html
<div class="ts-card ts-debug">
  <div class="badge">TypeScript Debug</div>
  <pre class="code"><code>{{BuggyCode}}</code></pre>
  <div class="symptom"><strong>Symptom:</strong> {{Symptom}}</div>
</div>
```

### Back Template
```html
{{FrontSide}}
<hr id="answer" />
<div><strong>Fix:</strong></div>
<pre class="code"><code>{{Fix}}</code></pre>
<div class="root"><strong>Root cause:</strong> {{RootCause}}</div>
<div class="rule"><strong>Rule:</strong> {{Rule}}</div>
```

## Shared CSS Policy (minimal, mobile-safe)

```css
.card {
  font-family: "SF Pro Text", "Noto Sans JP", sans-serif;
  line-height: 1.45;
  font-size: 18px;
  color: #1a1a1a;
  background: #f9f8f4;
}
.ts-card { padding: 8px 2px; }
.badge {
  display: inline-block;
  font-size: 12px;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: #5c4b3a;
  background: #efe5d6;
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 10px;
}
.prompt, .question, .symptom { margin-top: 6px; font-weight: 600; }
.contrast, .reason, .root, .rule { margin-top: 10px; color: #3d3d3d; }
.answer, .expected { margin-top: 8px; font-weight: 700; }
.code {
  background: #1f2430;
  color: #e6e6e6;
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
}
@media (max-width: 480px) {
  .card { font-size: 16px; }
  .code { font-size: 13px; }
}
```

## Starter 3 Cards

### Card 1 (`ts.v1.concept`)
- `Prompt`: `What is the practical difference between any and unknown?`
- `Answer`: `any disables type checking for that value. unknown keeps type safety and requires narrowing before use.`
- `Contrast`: `any vs unknown`
- `Example`:
```ts
let a: any = "x";
a.toFixed(); // no compile error

let u: unknown = "x";
// u.toFixed(); // compile error
if (typeof u === "string") {
  u.toUpperCase();
}
```

### Card 2 (`ts.v1.output`)
- `Code`:
```ts
const x: string | number = Math.random() > 0.5 ? "hi" : 42;
if (typeof x === "string") {
  console.log(x.toUpperCase());
} else {
  console.log(x.toFixed(1));
}
```
- `Question`: `What can be printed?`
- `Expected`: `"HI" or "42.0"`
- `Reason`: `typeof narrowing selects string branch or number branch.`

### Card 3 (`ts.v1.debug`)
- `BuggyCode`:
```ts
type User = { name: string };
function greet(user: User | null) {
  return "Hi " + user.name;
}
```
- `Symptom`: `Object is possibly 'null'.`
- `Fix`:
```ts
type User = { name: string };
function greet(user: User | null) {
  if (!user) return "Hi guest";
  return "Hi " + user.name;
}
```
- `RootCause`: `Union type includes null but code accesses property without narrowing.`
- `Rule`: `For nullable unions, narrow before property access.`
