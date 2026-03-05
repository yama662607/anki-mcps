import { describe, expect, it } from 'vitest';
import { sanitizeByPolicy } from '../src/utils/sanitize.js';

describe('sanitizeByPolicy', () => {
  it('escapes all html for plain_text_only', () => {
    const result = sanitizeByPolicy('<b>x</b>&y', 'plain_text_only');
    expect(result.value).toBe('&lt;b&gt;x&lt;/b&gt;&amp;y');
    expect(result.modified).toBe(true);
  });

  it('keeps only allowlisted inline tags for safe_inline_html', () => {
    const result = sanitizeByPolicy('<b>Hello</b><script>alert(1)</script><span class="x">ok</span>', 'safe_inline_html');
    expect(result.value).toBe('<b>Hello</b>alert(1)<span>ok</span>');
    expect(result.modified).toBe(true);
  });

  it('passes through trusted html', () => {
    const input = '<div data-x="1">ok</div>';
    const result = sanitizeByPolicy(input, 'trusted_html');
    expect(result.value).toBe(input);
    expect(result.modified).toBe(false);
  });
});
