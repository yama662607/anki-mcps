export function sortRecord(input: Record<string, string>): Record<string, string> {
  const entries = Object.entries(input).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function toCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => toCanonicalJson(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const body = keys.map((key) => `${JSON.stringify(key)}:${toCanonicalJson(record[key])}`).join(',');
  return `{${body}}`;
}
