import sanitizeHtml from 'sanitize-html';
import { CONFIG } from './sanitizer.config.js';

self.onmessage = ({ data: { id, html } }) => {
  try {
    const sanitized = sanitizeHtml(html, CONFIG);
    self.postMessage({ id, html: sanitized });
  } catch (error) {
    console.error('Sanitization failed:', error);
    self.postMessage({ id, error: error.message, html: '' });
  }
};
