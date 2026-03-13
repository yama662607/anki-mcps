import type {
  NoteTypeField,
  NoteTypeLintIssue,
  NoteTypeTemplate,
  NoteTypeValidation,
} from "../contracts/types.js";

const SPECIAL_REFS = new Set(["FrontSide", "Tags", "Type", "Deck", "Subdeck", "Card", "CardFlag"]);
const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const TEMPLATE_SIZE_WARNING_BYTES = 8 * 1024;
const CSS_SIZE_WARNING_BYTES = 16 * 1024;
const SECTION_DEPTH_WARNING = 4;

type TemplateLintResult = {
  usedFields: Set<string>;
  errors: NoteTypeLintIssue[];
  warnings: NoteTypeLintIssue[];
  usedCloze: boolean;
};

export function lintNoteTypeDefinition(input: {
  modelName: string;
  fields: NoteTypeField[];
  templates: NoteTypeTemplate[];
  css?: string;
  isCloze?: boolean;
}): NoteTypeValidation {
  const fieldNames = input.fields.map((field) => field.name);
  const fieldNameSet = new Set(fieldNames);
  const errors: NoteTypeLintIssue[] = [];
  const warnings: NoteTypeLintIssue[] = [];
  const usedFields = new Set<string>();
  let usedCloze = false;

  collectDuplicateIssues(fieldNames, "DUPLICATE_FIELD_NAME", "field", errors);
  collectDuplicateIssues(
    input.templates.map((template) => template.name),
    "DUPLICATE_TEMPLATE_NAME",
    "template",
    errors
  );

  for (const template of input.templates) {
    const front = lintTemplateSide(template.name, "front", template.front, fieldNameSet);
    const back = lintTemplateSide(template.name, "back", template.back, fieldNameSet);

    for (const fieldName of [...front.usedFields, ...back.usedFields]) {
      usedFields.add(fieldName);
    }

    usedCloze = usedCloze || front.usedCloze || back.usedCloze;
    errors.push(...front.errors, ...back.errors);
    warnings.push(...front.warnings, ...back.warnings);

    if (!template.back.includes("{{FrontSide}}")) {
      warnings.push({
        code: "MISSING_FRONTSIDE_ON_BACK",
        message: `Template ${template.name} back does not include {{FrontSide}}`,
        location: { templateName: template.name, side: "back" },
      });
    }
  }

  for (const field of input.fields) {
    if (!usedFields.has(field.name)) {
      warnings.push({
        code: "UNUSED_FIELD",
        message: `Field ${field.name} is not referenced by any template`,
        location: { side: "note_type", fieldName: field.name },
      });
    }
  }

  const css = input.css ?? "";
  const cssError = validateCssSyntax(css);
  if (cssError) {
    errors.push({
      code: "INVALID_CSS_SYNTAX",
      message: cssError,
      location: { side: "css" },
    });
  }
  if (byteLength(css) > CSS_SIZE_WARNING_BYTES) {
    warnings.push({
      code: "LARGE_CSS",
      message: `CSS exceeds the recommended size threshold of ${CSS_SIZE_WARNING_BYTES} bytes`,
      location: { side: "css" },
    });
  }

  const isCloze = input.isCloze ?? false;
  if (!isCloze && usedCloze) {
    errors.push({
      code: "INVALID_CLOZE_USAGE",
      message: `Model ${input.modelName} uses {{cloze:...}} tokens but is not marked as cloze`,
      location: { side: "note_type" },
    });
  }
  if (isCloze && !usedCloze) {
    errors.push({
      code: "INVALID_CLOZE_USAGE",
      message: `Model ${input.modelName} is marked as cloze but no {{cloze:...}} token was found`,
      location: { side: "note_type" },
    });
  }

  return {
    canApply: errors.length === 0,
    errors: dedupeIssues(errors),
    warnings: dedupeIssues(warnings),
  };
}

function lintTemplateSide(
  templateName: string,
  side: "front" | "back",
  source: string,
  fieldNames: Set<string>
): TemplateLintResult {
  const errors: NoteTypeLintIssue[] = [];
  const warnings: NoteTypeLintIssue[] = [];
  const usedFields = new Set<string>();
  const sectionStack: string[] = [];
  let usedCloze = false;
  let maxDepth = 0;

  for (const match of source.matchAll(/\{\{([^}]+)\}\}/g)) {
    const rawToken = match[1]?.trim() ?? "";
    if (!rawToken) {
      continue;
    }

    if (rawToken.startsWith("!")) {
      continue;
    }

    if (rawToken.startsWith("/")) {
      const closeName = normalizeFieldName(rawToken.slice(1));
      const openName = sectionStack.pop();

      if (!openName || openName !== closeName) {
        errors.push({
          code: "INVALID_SECTION_NESTING",
          message: `Template ${templateName} ${side} closes ${closeName} without a matching open section`,
          location: { templateName, side, fieldName: closeName },
        });
      }
      continue;
    }

    if (rawToken.startsWith("#") || rawToken.startsWith("^")) {
      const sectionName = normalizeFieldName(rawToken.slice(1));
      if (sectionName && !fieldNames.has(sectionName) && !SPECIAL_REFS.has(sectionName)) {
        errors.push({
          code: "UNKNOWN_FIELD_REF",
          message: `Template ${templateName} ${side} references unknown field: ${sectionName}`,
          location: { templateName, side, fieldName: sectionName },
        });
      }
      if (sectionName) {
        usedFields.add(sectionName);
        sectionStack.push(sectionName);
        maxDepth = Math.max(maxDepth, sectionStack.length);
      }
      continue;
    }

    const fieldName = normalizeFieldName(rawToken);
    if (!fieldName || SPECIAL_REFS.has(fieldName)) {
      continue;
    }

    if (rawToken.includes("cloze:")) {
      usedCloze = true;
    }

    usedFields.add(fieldName);
    if (!fieldNames.has(fieldName)) {
      errors.push({
        code: "UNKNOWN_FIELD_REF",
        message: `Template ${templateName} ${side} references unknown field: ${fieldName}`,
        location: { templateName, side, fieldName },
      });
    }
  }

  if (sectionStack.length > 0) {
    for (const fieldName of sectionStack) {
      errors.push({
        code: "UNBALANCED_SECTION_TAG",
        message: `Template ${templateName} ${side} opens ${fieldName} without a matching close tag`,
        location: { templateName, side, fieldName },
      });
    }
  }

  if (maxDepth > SECTION_DEPTH_WARNING) {
    warnings.push({
      code: "DEEP_SECTION_NESTING",
      message: `Template ${templateName} ${side} nests conditionals deeper than ${SECTION_DEPTH_WARNING} levels`,
      location: { templateName, side },
    });
  }

  if (byteLength(source) > TEMPLATE_SIZE_WARNING_BYTES) {
    warnings.push({
      code: "LARGE_TEMPLATE",
      message: `Template ${templateName} ${side} exceeds the recommended size threshold of ${TEMPLATE_SIZE_WARNING_BYTES} bytes`,
      location: { templateName, side },
    });
  }

  if (hasSuspiciousHtmlStructure(source)) {
    warnings.push({
      code: "SUSPICIOUS_HTML_STRUCTURE",
      message: `Template ${templateName} ${side} contains suspicious HTML structure`,
      location: { templateName, side },
    });
  }

  return {
    usedFields,
    errors,
    warnings,
    usedCloze,
  };
}

function collectDuplicateIssues(
  names: string[],
  code: "DUPLICATE_FIELD_NAME" | "DUPLICATE_TEMPLATE_NAME",
  label: "field" | "template",
  target: NoteTypeLintIssue[]
): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      target.push({
        code,
        message: `Duplicate ${label} name is not allowed: ${name}`,
        location: {
          side: "note_type",
          fieldName: label === "field" ? name : undefined,
          templateName: label === "template" ? name : undefined,
        },
      });
      continue;
    }
    seen.add(name);
  }
}

function normalizeFieldName(rawToken: string): string {
  const withoutPrefix = rawToken.replace(/^[#/^!]+/, "").trim();
  const segments = withoutPrefix
    .split(":")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return segments.at(-1) ?? "";
}

function validateCssSyntax(source: string): string | undefined {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (inComment) {
      if (current === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && current === "'") {
        inSingle = false;
      }
      escaped = !escaped && current === "\\";
      continue;
    }

    if (inDouble) {
      if (!escaped && current === '"') {
        inDouble = false;
      }
      escaped = !escaped && current === "\\";
      continue;
    }

    if (current === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }

    if (current === "'") {
      inSingle = true;
      escaped = false;
      continue;
    }

    if (current === '"') {
      inDouble = true;
      escaped = false;
      continue;
    }

    if (current === "{") {
      depth += 1;
      continue;
    }

    if (current === "}") {
      depth -= 1;
      if (depth < 0) {
        return "CSS closes more blocks than it opens";
      }
    }
  }

  if (inComment) {
    return "CSS ends inside a comment block";
  }
  if (inSingle || inDouble) {
    return "CSS ends inside a string literal";
  }
  if (depth !== 0) {
    return "CSS has unbalanced block braces";
  }
  return undefined;
}

function hasSuspiciousHtmlStructure(source: string): boolean {
  const neutralized = source.replace(/\{\{[^}]+\}\}/g, "x-token").replace(/<!--[\s\S]*?-->/g, "");

  const stack: string[] = [];
  for (const match of neutralized.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const tagName = (match[1] ?? "").toLowerCase();
    const raw = match[0] ?? "";
    const closing = raw.startsWith("</");
    const selfClosing = raw.endsWith("/>");

    if (!tagName || VOID_HTML_TAGS.has(tagName) || selfClosing) {
      continue;
    }

    if (closing) {
      const open = stack.pop();
      if (open !== tagName) {
        return true;
      }
      continue;
    }

    stack.push(tagName);
  }

  return stack.length > 0;
}

function dedupeIssues(issues: NoteTypeLintIssue[]): NoteTypeLintIssue[] {
  const seen = new Set<string>();
  const unique: NoteTypeLintIssue[] = [];

  for (const issue of issues) {
    const key = JSON.stringify(issue);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(issue);
  }

  return unique;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}
