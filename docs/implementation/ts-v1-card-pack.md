# TypeScript v1 Card Pack

This file records the applied TypeScript note types and starter cards currently in use.

## 1) `ts.v1.concept`

### Fields
- `Prompt`
- `Answer`
- `DetailedExplanation`
- `Contrast`
- `Example`

### Front Template
```html
<div class="ts-card ts-concept"><div class="badge">概念</div><div class="prompt">{{Prompt}}</div>{{#Contrast}}<div class="contrast">比較: {{Contrast}}</div>{{/Contrast}}</div>
```

### Back Template
```html
{{FrontSide}}<hr id="answer" /><div class="answer-block"><div class="section-label">要点</div><div class="answer">{{Answer}}</div></div>{{#DetailedExplanation}}<div class="explainer"><div class="section-label">解説</div><div>{{DetailedExplanation}}</div></div>{{/DetailedExplanation}}{{#Example}}<div class="example-block"><div class="section-label">例</div><pre class="code"><code>{{Example}}</code></pre></div>{{/Example}}
```

## 2) `ts.v1.output`

### Fields
- `Code`
- `Question`
- `Expected`
- `Reason`

### Front Template
```html
<div class="ts-card ts-output"><div class="badge">出力予測</div><div class="question">{{Question}}</div><div class="code-shell"><pre class="code"><code>{{Code}}</code></pre></div></div>
```

### Back Template
```html
{{FrontSide}}<hr id="answer" /><div class="answer-block"><div class="section-label">答え</div><div class="expected">{{Expected}}</div></div>{{#Reason}}<div class="reason-block"><div class="section-label">解説</div><div class="reason">{{Reason}}</div></div>{{/Reason}}
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
<div class="ts-card ts-debug"><div class="badge">デバッグ</div><div class="code-shell"><pre class="code"><code>{{BuggyCode}}</code></pre></div><div class="symptom">症状: {{Symptom}}</div></div>
```

### Back Template
```html
{{FrontSide}}<hr id="answer" /><div class="fix-block"><div class="section-label">修正</div><pre class="code"><code>{{Fix}}</code></pre></div><div class="cause-block"><div class="section-label">原因</div><div class="root">{{RootCause}}</div></div><div class="rule-block"><div class="section-label">ルール</div><div class="rule">{{Rule}}</div></div>
```

## Shared Design Direction

- dark theme
- rounded card shell with generous outer margin
- Japanese labels inside note templates
- consistent code-block treatment across concept / output / debug

## Starter 3 Cards

### Card 1 (`programming.v1.ts-concept`)
- `Prompt`: `any と unknown の実用上の違いは何ですか？`
- `Answer`: `any は型チェックを外し、unknown は narrowing を要求します。`
- `DetailedExplanation`: `any を使うと、その値に対する型検査がほぼ無効になり、誤ったプロパティアクセスやメソッド呼び出しも通りやすくなります。unknown は「型がまだ分からない値」として受け取り、実際に使う前に typeof や if 文で型を絞り込む必要があります。そのため、外部入力や一時的に型不明な値を扱うときは unknown の方が安全です。`
- `Contrast`: `any と unknown`
- `Example`:
```ts
let a: any = "x";
a.toFixed(); // コンパイルエラーにならない

let u: unknown = "x";
// u.toFixed(); // コンパイルエラー
if (typeof u === "string") {
  u.toUpperCase();
}
```

### Card 2 (`programming.v1.ts-output`)
- `Question`: `このコードでは何が出力されますか？`
- `Expected`: `"HI" または "42.0"`
- `Reason`: `x の型は最初は string | number ですが、if (typeof x === "string") に入るとその中では x を string と確定して扱えます。これが narrowing です。else 側では number と確定するので toFixed(1) を安全に呼び出せます。`
- `Code`:
```ts
const x: string | number = Math.random() > 0.5 ? "hi" : 42;
if (typeof x === "string") {
  console.log(x.toUpperCase());
} else {
  console.log(x.toFixed(1));
}
```

### Card 3 (`programming.v1.ts-debug`)
- `Symptom`: `Object is possibly null.`
- `RootCause`: `union 型に null が含まれているのに、絞り込みなしで user.name にアクセスしているためです。`
- `Rule`: `null を含む型では、プロパティアクセス前に必ず絞り込みます。`
- `BuggyCode`:
```ts
type User = { name: string };
function greet(user: User | null) {
  return "Hi " + user.name;
}
```
- `Fix`:
```ts
type User = { name: string };
function greet(user: User | null) {
  if (!user) return "Hi guest";
  return "Hi " + user.name;
}
```
