/**
 * Date formatting utilities
 */

/**
 * Format ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 */
export function formatOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Format a timestamp as a relative/human-readable date:
 * - Today: "x hours ago"
 * - This week (Mon-Sun): "Monday"
 * - Otherwise: "12th March"
 */
export function formatRelativeDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // Week starts on Monday
  const dayOfWeek = startOfToday.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  // Today: relative time
  if (date >= startOfToday && date < startOfTomorrow) {
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return diffSeconds <= 1 ? 'Just now' : `${diffSeconds} seconds ago`;
    }
    if (diffMinutes < 60) {
      return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  // This week (excluding today): "Monday"
  if (date >= startOfWeek && date < startOfToday) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  // Otherwise: "12th March"
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  return `${formatOrdinal(day)} ${month}`;
}
