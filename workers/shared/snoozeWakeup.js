import { DB } from './db.js';

/**
 * Wake up snoozed messages whose snooze time has passed.
 * Clears snoozed_until, sends push notifications, and broadcasts
 * a real-time event so the frontend refreshes.
 *
 * @param {Object} env - Worker environment bindings
 */
export async function handleSnoozeWakeup(env) {
  const now = Date.now();
  let woken;
  try {
    woken = await DB.wakeUpSnoozedMessages(env.DB, now);
  } catch (e) {
    console.error('Snooze wakeup: failed to query DB:', e);
    return;
  }

  if (!woken.length) return;

  console.log(`Snooze wakeup: waking ${woken.length} message(s)`);

  const notifyPromises = woken.map(async (msg) => {
    try {
      const topic = (env.NTFY_TOPIC || '').trim();
      if (topic) {
        const server = (env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
        const endpoint = `${server}/${encodeURIComponent(topic)}`;
        const from = (msg.from_addr || 'Unknown').replace(/<[^>]+>/g, '').trim();
        const headers = {
          'Title': `Snoozed email: ${from}`,
          'Tags': 'alarm_clock',
          'Priority': '3',
        };
        if (env.NTFY_TOKEN) headers['Authorization'] = `Bearer ${env.NTFY_TOKEN}`;
        const baseUrl = env.NOTIFY_APP_URL || env.APP_URL || '';
        const body = msg.subject || '(No Subject)';
        if (baseUrl) {
          headers['Click'] = `${baseUrl.replace(/\/$/, '')}/#message=${msg.id}`;
        }
        await fetch(endpoint, { method: 'POST', headers, body });
      }
    } catch (e) {
      console.error('Snooze wakeup: notification failed for', msg.id, e);
    }
  });

  const broadcastPromise = (async () => {
    try {
      if (!env.REALTIME_HUB) return;
      const hubId = env.REALTIME_HUB.idFromName('global');
      const hub = env.REALTIME_HUB.get(hubId);
      await hub.fetch('https://fake/broadcast', {
        method: 'POST',
        body: JSON.stringify({ type: 'snooze.wakeup', count: woken.length }),
      });
    } catch (e) {
      console.error('Snooze wakeup: broadcast failed:', e);
    }
  })();

  await Promise.allSettled([...notifyPromises, broadcastPromise]);
}
