/**
 * Lightweight MIME Parser Wrapper
 * Uses postal-mime for parsing (standard choice for Workers)
 */
import PostalMime from 'postal-mime';

export const MimeParser = {
  /**
   * Parse a raw email
   * @param {ReadableStream|Response|string} rawEmail 
   * @returns {Promise<Object>} simplified parsed object
   */
  async parse(rawEmail) {
    const parser = new PostalMime();
    const email = await parser.parse(rawEmail);

    // Extract minimal fields for our DB
    const headers = {};
    if (email.headers) {
      for (const h of email.headers) {
        if (['message-id', 'date', 'subject', 'from', 'to', 'in-reply-to', 'references'].includes(h.key)) {
          headers[h.key] = h.value;
        }
      }
    }

    const textBody = email.text || (email.html ? extractTextFromHtml(email.html) : '');
    const htmlBody = email.html || '';
    const snippet = textBody.substring(0, 300).replace(/\s+/g, ' ').trim();

    return {
      messageId: email.messageId,
      from: email.from?.address || email.from?.name || 'unknown',
      to: email.to?.map(t => t.address).join(', ') || '',
      subject: email.subject || '(no subject)',
      date: email.date,
      textBody,
      htmlBody,
      snippet,
      attachments: email.attachments || [],
      allHeaders: headers
    };
  }
};

export function extractTextFromHtml(html, limit = 102400) {
  // Very naive stripper, sufficient for snippet generation fallback
  // Optimized to truncate large inputs before regex processing
  if (html && html.length > limit) {
    html = html.substring(0, limit);
  }
  return html.replace(/<[^>]*>?/gm, ' ');
}
