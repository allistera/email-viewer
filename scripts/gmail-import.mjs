#!/usr/bin/env node
/**
 * Gmail Import Script
 *
 * Connects to Gmail via IMAP (using an App Password), downloads raw emails,
 * and POSTs them to the email viewer's /api/messages/import endpoint.
 *
 * Environment variables:
 *   GMAIL_USER         - Gmail address (e.g. user@gmail.com)
 *   GMAIL_APP_PASSWORD - Google App Password (16 chars, no spaces)
 *   API_URL            - Base URL of the email viewer API (e.g. https://api.infinitywave.design)
 *   API_TOKEN          - Bearer token for API authentication
 *   GMAIL_FOLDER       - IMAP folder to import (default: [Gmail]/All Mail)
 *   AFTER_DATE         - Only import emails after this date (e.g. 2024-01-01)
 *   MAX_MESSAGES       - Maximum number of messages to import (default: unlimited)
 *   DRY_RUN            - If "true", only list messages without importing
 *
 * Usage:
 *   GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxx API_URL=https://... API_TOKEN=xxx node scripts/gmail-import.mjs
 */

import { ImapFlow } from 'imapflow';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const API_URL = process.env.API_URL;
const API_TOKEN = process.env.API_TOKEN;
const GMAIL_FOLDER = process.env.GMAIL_FOLDER || '[Gmail]/All Mail';
const AFTER_DATE = process.env.AFTER_DATE || null;
const MAX_MESSAGES = process.env.MAX_MESSAGES ? parseInt(process.env.MAX_MESSAGES, 10) : 0;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('Error: GMAIL_USER and GMAIL_APP_PASSWORD are required');
  process.exit(1);
}
if (!DRY_RUN && (!API_URL || !API_TOKEN)) {
  console.error('Error: API_URL and API_TOKEN are required (or set DRY_RUN=true)');
  process.exit(1);
}

const stats = {
  total: 0,
  imported: 0,
  deduplicated: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * POST a raw email to the import endpoint with retry logic.
 */
async function postEmail(rawBuffer) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_URL}/api/messages/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/octet-stream'
        },
        body: rawBuffer
      });

      if (response.status === 413) {
        // Message too large for the API, skip it
        return { error: 'Message too large', skipped: true };
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Exponential backoff: 2s, 4s
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

function printProgress() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
  const rate = stats.total > 0 ? (stats.imported / (elapsed || 1)).toFixed(1) : '0';
  process.stdout.write(
    `\r  Progress: ${stats.imported + stats.deduplicated + stats.errors}/${stats.total} ` +
    `(imported: ${stats.imported}, skipped: ${stats.deduplicated}, errors: ${stats.errors}) ` +
    `[${rate} msg/s, ${elapsed}s elapsed]`
  );
}

async function main() {
  console.log(`Gmail Import`);
  console.log(`  User: ${GMAIL_USER}`);
  console.log(`  Folder: ${GMAIL_FOLDER}`);
  console.log(`  After: ${AFTER_DATE || 'all time'}`);
  console.log(`  Max: ${MAX_MESSAGES || 'unlimited'}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  API: ${API_URL || '(dry run)'}`);
  console.log('');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    },
    logger: false
  });

  await client.connect();
  console.log('  Connected to Gmail IMAP');

  const mailbox = await client.mailboxOpen(GMAIL_FOLDER);
  console.log(`  Mailbox "${GMAIL_FOLDER}": ${mailbox.exists} messages`);

  // Build IMAP search criteria
  let searchCriteria = { all: true };
  if (AFTER_DATE) {
    searchCriteria = { since: new Date(AFTER_DATE) };
  }

  // Get list of message UIDs
  const uids = await client.search(searchCriteria, { uid: true });
  stats.total = MAX_MESSAGES ? Math.min(uids.length, MAX_MESSAGES) : uids.length;
  console.log(`  Messages to process: ${stats.total}`);

  if (DRY_RUN) {
    console.log('\n  Dry run complete. No messages were imported.');
    await client.logout();
    return;
  }

  console.log('');

  // Process messages in order (oldest first for consistent received_at ordering)
  const uidsToProcess = MAX_MESSAGES ? uids.slice(0, MAX_MESSAGES) : uids;

  for (const uid of uidsToProcess) {
    try {
      // Fetch raw RFC 2822 source
      const download = await client.download(String(uid), undefined, { uid: true });
      const chunks = [];
      for await (const chunk of download.content) {
        chunks.push(chunk);
      }
      const rawBuffer = Buffer.concat(chunks);

      const result = await postEmail(rawBuffer);

      if (result.skipped) {
        stats.errors++;
      } else if (result.deduplicated) {
        stats.deduplicated++;
      } else {
        stats.imported++;
      }
    } catch (err) {
      stats.errors++;
      console.error(`\n  Error on UID ${uid}: ${err.message}`);
    }

    printProgress();
  }

  console.log('\n');
  console.log('  Import complete!');
  console.log(`  Imported: ${stats.imported}`);
  console.log(`  Skipped (duplicates): ${stats.deduplicated}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Total time: ${((Date.now() - stats.startTime) / 1000).toFixed(0)}s`);

  await client.logout();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
