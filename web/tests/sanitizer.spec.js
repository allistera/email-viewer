import { test, expect } from '@playwright/test';
import sanitizeHtml from 'sanitize-html';
import { CONFIG } from '../src/workers/sanitizer.config.js';

test.describe('Sanitizer Security', () => {
  test('should block <base> tag', async () => {
    const input = '<base href="http://evil.com/"><a href="login">Login</a>';
    const output = sanitizeHtml(input, CONFIG);
    expect(output).not.toContain('<base');
  });

  test('should enforce rel="noopener noreferrer" on links with target', async () => {
    const input = '<a href="http://example.com" target="_blank">Link</a>';
    const output = sanitizeHtml(input, CONFIG);
    expect(output).toContain('rel="noopener noreferrer"');
  });

  test('should not allow vulnerable tags like script', async () => {
    const input = '<script>alert(1)</script>';
    const output = sanitizeHtml(input, CONFIG);
    expect(output).not.toContain('<script');
  });
});
