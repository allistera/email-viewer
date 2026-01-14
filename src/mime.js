/**
 * MIME parsing and email utilities
 * Lightweight parser for email headers, bodies, and attachments
 */

/**
 * Parse email headers from raw email content
 */
export function parseHeaders(rawEmail) {
  const headers = {};
  const lines = rawEmail.split('\n');
  let currentHeader = null;
  let currentValue = '';

  for (const line of lines) {
    if (line === '\r' || line === '') {
      break;
    }

    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += ' ' + line.trim();
    } else {
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue.trim();
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentHeader = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      }
    }
  }

  if (currentHeader) {
    headers[currentHeader.toLowerCase()] = currentValue.trim();
  }

  return headers;
}

/**
 * Extract email address from header value (e.g., "Name <email@domain.com>" -> "email@domain.com")
 */
export function extractEmail(headerValue) {
  if (!headerValue) return '';

  const match = headerValue.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }

  const simpleMatch = headerValue.match(/([^\s@]+@[^\s@]+)/);
  return simpleMatch ? simpleMatch[1] : headerValue.trim();
}

/**
 * Compute SHA-256 hash of a string
 */
export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate dedupe key from message headers
 */
export async function generateDedupeKey(headers, textBody) {
  const messageId = headers['message-id'];
  const to = headers['to'];

  if (messageId && to) {
    const key = `${messageId.toLowerCase()}|${to.toLowerCase()}`;
    return sha256(key);
  }

  const from = headers['from'] || '';
  const subject = headers['subject'] || '';
  const date = headers['date'] || '';
  const bodySnippet = textBody ? textBody.substring(0, 200) : '';

  const fallbackKey = `${from}|${subject}|${date}|${bodySnippet}`;
  return sha256(fallbackKey);
}

/**
 * Generate snippet from text body
 */
export function generateSnippet(textBody, maxLength = 300) {
  if (!textBody) return '';

  const cleaned = textBody
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength) + '...';
}

/**
 * Strip HTML tags from HTML body
 */
export function stripHtml(html) {
  if (!html) return '';

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse MIME multipart message
 */
export async function parseMimeMessage(emailMessage) {
  const rawEmail = await emailMessage.raw();
  const rawText = new TextDecoder().decode(rawEmail);

  const headers = parseHeaders(rawText);

  const parts = {
    headers,
    from: extractEmail(headers['from']),
    to: extractEmail(headers['to']),
    subject: headers['subject'] || '(No Subject)',
    date: headers['date'] || '',
    messageId: headers['message-id'] || '',
    textBody: null,
    htmlBody: null,
    attachments: []
  };

  const contentType = headers['content-type'] || '';

  if (contentType.includes('multipart')) {
    const boundary = extractBoundary(contentType);
    if (boundary) {
      await parseMultipart(rawText, boundary, parts);
    }
  } else {
    const bodyStart = rawText.indexOf('\r\n\r\n') + 4;
    const body = rawText.substring(bodyStart);

    if (contentType.includes('text/html')) {
      parts.htmlBody = body;
    } else {
      parts.textBody = body;
    }
  }

  return parts;
}

/**
 * Extract boundary from Content-Type header
 */
function extractBoundary(contentType) {
  const match = contentType.match(/boundary="?([^"\s;]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Parse multipart MIME content
 */
async function parseMultipart(rawText, boundary, parts) {
  const boundaryMarker = `--${boundary}`;
  const sections = rawText.split(boundaryMarker);

  for (const section of sections) {
    if (!section.trim() || section.startsWith('--')) continue;

    const sectionHeaders = parseHeaders(section);
    const contentType = sectionHeaders['content-type'] || '';
    const contentDisposition = sectionHeaders['content-disposition'] || '';

    const bodyStart = section.indexOf('\r\n\r\n');
    if (bodyStart === -1) continue;

    const body = section.substring(bodyStart + 4).trim();

    if (contentDisposition.includes('attachment')) {
      const filename = extractFilename(contentDisposition) || extractFilename(contentType) || 'attachment';
      const contentTransferEncoding = sectionHeaders['content-transfer-encoding'] || '';

      parts.attachments.push({
        filename,
        contentType: contentType.split(';')[0].trim(),
        contentTransferEncoding,
        body
      });
    } else if (contentType.includes('text/plain') && !parts.textBody) {
      parts.textBody = decodeContent(body, sectionHeaders['content-transfer-encoding']);
    } else if (contentType.includes('text/html') && !parts.htmlBody) {
      parts.htmlBody = decodeContent(body, sectionHeaders['content-transfer-encoding']);
    } else if (contentType.includes('multipart')) {
      const nestedBoundary = extractBoundary(contentType);
      if (nestedBoundary) {
        await parseMultipart(section, nestedBoundary, parts);
      }
    }
  }
}

/**
 * Extract filename from Content-Disposition or Content-Type header
 */
function extractFilename(header) {
  const match = header.match(/filename="?([^";\s]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Decode content based on transfer encoding
 */
function decodeContent(content, encoding) {
  if (!encoding) return content;

  const enc = encoding.toLowerCase();

  if (enc === 'base64') {
    try {
      return atob(content.replace(/\s/g, ''));
    } catch {
      return content;
    }
  }

  if (enc === 'quoted-printable') {
    return content
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return content;
}

/**
 * Decode base64 to Uint8Array
 */
export function decodeBase64ToBytes(base64String) {
  const cleaned = base64String.replace(/\s/g, '');
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute SHA-256 hash of binary data
 */
export async function sha256Bytes(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
