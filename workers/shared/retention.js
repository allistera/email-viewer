import { DB } from './db.js';

/**
 * Handle retention policy: Delete old messages and associated R2 objects
 * @param {Object} env
 */
export async function handleRetention(env) {
  // 1. Check configuration
  const retentionDays = parseInt(env.RETENTION_DAYS || '0', 10);
  if (retentionDays <= 0) {
    console.log('Retention policy disabled (RETENTION_DAYS not set or <= 0)');
    return;
  }

  const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  console.log(`Starting retention cleanup. Cutoff: ${new Date(cutoffTimestamp).toISOString()} (${retentionDays} days)`);

  let totalDeleted = 0;
  const BATCH_SIZE = 50; // Process in small batches
  const MAX_ITERATIONS = 20; // Prevent infinite loops or timeouts (max 1000 messages per run)

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Fetch old messages
    const messages = await DB.getMessagesForRetention(env.DB, cutoffTimestamp, BATCH_SIZE);

    if (messages.length === 0) {
      break; // No more messages to delete
    }

    const messageIds = messages.map(m => m.id);
    const rawR2Keys = messages.map(m => m.raw_r2_key).filter(k => !!k);

    // 3. Fetch attachment keys
    const attachmentR2Keys = await DB.getAttachmentsForMessages(env.DB, messageIds);

    // 4. Delete R2 objects (Raw Emails + Attachments)
    const allR2Keys = [...rawR2Keys, ...attachmentR2Keys];

    if (env.MAILSTORE && allR2Keys.length > 0) {
      try {
        await env.MAILSTORE.delete(allR2Keys);
      } catch (e) {
        console.error('Error deleting R2 objects:', e);
        // Continue to DB deletion to prevent loop, but log error.
      }
    } else if (!env.MAILSTORE) {
      console.warn('MAILSTORE binding not found, skipping R2 deletion');
    }

    // 5. Delete from DB
    await DB.deleteMessages(env.DB, messageIds);
    await DB.deleteDedupeForMessages(env.DB, messageIds);

    totalDeleted += messages.length;
    console.log(`Deleted batch of ${messages.length} messages.`);
  }

  console.log(`Retention cleanup complete. Total messages deleted: ${totalDeleted}`);
}
