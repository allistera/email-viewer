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
 *   CONCURRENCY        - Max simultaneous API uploads (default: 5)
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
const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY, 10) : 5;

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
 * @param {Buffer} rawBuffer - Raw RFC 2822 email bytes
 * @param {Object} [options]
 * @param {boolean} [options.archived] - Whether the message was archived in Gmail
 */
async function postEmail(rawBuffer, options = {}) {
  const maxRetries = 3;
  const url = new URL(`${API_URL}/api/messages/import`);
  if (options.archived) url.searchParams.set('archived', 'true');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
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
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        const isHtml = contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html');
        const body = isHtml ? `[HTML error page - likely Cloudflare error ${response.status}]` : text;
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Exponential backoff: 2s, 4s
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

/**
 * Concurrency pool: limits how many async tasks run simultaneously.
 * Tasks beyond the limit are queued and start as slots free up.
 * @param {number} limit - Max concurrent executions
 * @returns {function(fn: () => Promise): Promise} - Enqueue a task
 */
function createConcurrencyPool(limit) {
  let active = 0;
  const queue = [];
  return async function enqueue(fn) {
    if (active >= limit) {
      await new Promise(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (queue.length > 0) queue.shift()();
    }
  };
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

const IMAP_CONFIG = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  },
  logger: false
};

let imapClient = null;

async function connectImap() {
  if (imapClient) {
    try { await imapClient.logout(); } catch (_) {}
    imapClient = null;
  }
  imapClient = new ImapFlow(IMAP_CONFIG);
  await imapClient.connect();
  await imapClient.mailboxOpen(GMAIL_FOLDER);
}

async function downloadWithReconnect(uid) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const download = await imapClient.download(String(uid), undefined, { uid: true });
      const chunks = [];
      for await (const chunk of download.content) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      // Connection dropped — reconnect and retry
      process.stdout.write(`\n  Connection lost (UID ${uid}), reconnecting (attempt ${attempt})...`);
      try { imapClient.close(); } catch (_) {}
      imapClient = null;
      await new Promise(r => setTimeout(r, 3000 * attempt));
      await connectImap();
    }
  }
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

  await connectImap();
  console.log('  Connected to Gmail IMAP');

  const mailbox = await imapClient.mailboxOpen(GMAIL_FOLDER);
  console.log(`  Mailbox "${GMAIL_FOLDER}": ${mailbox.exists} messages`);

  // Build IMAP search criteria
  let searchCriteria = { all: true };
  if (AFTER_DATE) {
    searchCriteria = { since: new Date(AFTER_DATE) };
  }

  // Get list of message UIDs
  const uids = await imapClient.search(searchCriteria, { uid: true });
  stats.total = MAX_MESSAGES ? Math.min(uids.length, MAX_MESSAGES) : uids.length;
  console.log(`  Messages to process: ${stats.total}`);

  if (DRY_RUN) {
    console.log('\n  Dry run complete. No messages were imported.');
    await imapClient.logout();
    return;
  }

  console.log(`  Upload concurrency: ${CONCURRENCY}`);
  console.log('');

  // Process messages newest first (highest UIDs last assigned = most recent)
  const uidsToProcess = MAX_MESSAGES ? uids.slice(-MAX_MESSAGES).reverse() : [...uids].reverse();

  // When importing from [Gmail]/All Mail, fetch flags to detect archived messages.
  // In Gmail IMAP, archived messages lack the \Inbox flag.
  const isAllMail = GMAIL_FOLDER.toLowerCase().includes('all mail');
  let flagsByUid = new Map();
  if (isAllMail && uidsToProcess.length > 0) {
    console.log('  Fetching message flags to detect archived emails...');
    for await (const msg of imapClient.fetch(uidsToProcess, { flags: true, uid: true })) {
      flagsByUid.set(msg.uid, msg.flags);
    }
    const archivedCount = [...flagsByUid.values()].filter(f => !f.has('\\Inbox')).length;
    console.log(`  Found ${archivedCount} archived messages out of ${flagsByUid.size}`);
    console.log('');
  }

  // Pipeline: IMAP downloads are sequential (single connection), but API uploads
  // run concurrently. Each download overlaps with up to CONCURRENCY in-flight uploads.
  const pool = createConcurrencyPool(CONCURRENCY);
  const pendingUploads = [];

  for (const uid of uidsToProcess) {
    // Download from IMAP (must be sequential — single stateful connection)
    let rawBuffer, isArchived;
    try {
      rawBuffer = await downloadWithReconnect(uid);
      const flags = flagsByUid.get(uid);
      isArchived = isAllMail && flags && !flags.has('\\Inbox');
    } catch (err) {
      stats.errors++;
      console.error(`\n  Download error on UID ${uid}: ${err.message}`);
      printProgress();
      continue;
    }

    // Start upload concurrently — pipelined with the next IMAP download
    pendingUploads.push(
      pool(async () => {
        try {
          const result = await postEmail(rawBuffer, { archived: isArchived });
          if (result?.skipped) {
            stats.errors++;
          } else if (result?.deduplicated) {
            stats.deduplicated++;
          } else {
            stats.imported++;
            if (isArchived) stats.archived = (stats.archived || 0) + 1;
          }
        } catch (err) {
          stats.errors++;
          console.error(`\n  Upload error on UID ${uid}: ${err.message}`);
        }
        printProgress();
      })
    );
  }

  // Wait for all in-flight uploads to complete
  await Promise.all(pendingUploads);

  console.log('\n');
  console.log('  Import complete!');
  console.log(`  Imported: ${stats.imported}${stats.archived ? ` (${stats.archived} archived)` : ''}`);
  console.log(`  Skipped (duplicates): ${stats.deduplicated}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Total time: ${((Date.now() - stats.startTime) / 1000).toFixed(0)}s`);

  await imapClient.logout();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
