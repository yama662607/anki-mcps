import type { AllowedHtmlPolicy } from '../contracts/types.js';

const SAFE_INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'code', 'sub', 'sup', 'br', 'ruby', 'rt', 'span']);

export type SanitizationResult = {
  value: string;
  modified: boolean;
};

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeSafeInline(input: string): SanitizationResult {
  let modified = false;
  const sanitized = input.replace(/<\/?([a-zA-Z0-9]+)(?:\s[^>]*)?>/g, (full, rawTagName: string) => {
    const isClosing = full.startsWith('</');
    const tagName = rawTagName.toLowerCase();
    if (!SAFE_INLINE_TAGS.has(tagName)) {
      modified = true;
      return '';
    }
    const normalized = isClosing ? `</${tagName}>` : `<${tagName}>`;
    if (normalized !== full) {
      modified = true;
    }
    return normalized;
  });
  return { value: sanitized, modified };
}

export function sanitizeByPolicy(input: string, policy: AllowedHtmlPolicy): SanitizationResult {
  if (policy === 'trusted_html') {
    return { value: input, modified: false };
  }
  if (policy === 'plain_text_only') {
    const escaped = escapeHtml(input);
    return { value: escaped, modified: escaped !== input };
  }
  return sanitizeSafeInline(input);
}
