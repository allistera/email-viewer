/**
 * Queue consumer for async post-processing
 */

import { getMessage, updateSpamStatus } from './db.js';
import { classifySpam } from './openai.js';

/**
 * Process queue messages
 */
export async function processQueueBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      await processQueueMessage(message.body, env);
      message.ack();
    } catch (error) {
      console.error('Queue message processing error:', error.message);
      message.retry();
    }
  }
}

/**
 * Process a single queue message
 */
async function processQueueMessage(event, env) {
  if (event.type === 'message.received') {
    await handleMessageReceived(event, env);
  }
}

/**
 * Handle message.received event
 */
async function handleMessageReceived(event, env) {
  const { messageId } = event;

  console.log(`[${messageId}] Processing message.received event`);

  const message = await getMessage(env.DB, messageId);
  if (!message) {
    console.error(`[${messageId}] Message not found in database`);
    return;
  }

  if (message.spam_checked_at) {
    console.log(`[${messageId}] Spam already checked, skipping`);
    return;
  }

  const spamResult = await classifySpam(message, env);
  console.log(`[${messageId}] Spam classification: ${spamResult.spam_status} (confidence: ${spamResult.spam_confidence})`);

  await updateSpamStatus(env.DB, messageId, spamResult);

  const hubId = env.REALTIME_HUB.idFromName('global');
  const hub = env.REALTIME_HUB.get(hubId);

  await hub.fetch(new Request('https://internal/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message.classified',
      messageId,
      spamStatus: spamResult.spam_status,
      spamConfidence: spamResult.spam_confidence
    })
  }));

  console.log(`[${messageId}] Broadcasted message.classified event`);
}
