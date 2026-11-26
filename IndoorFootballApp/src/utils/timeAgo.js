// When an update happened, as the Notifications screen shows it
// (docs/features/notifications.md, P27; the steps approved by the owner on 2026-11-26):
// - "Just now": under a minute ago, or in the future (the phone's clock is behind);
// - "5 min ago": under an hour;
// - "3 h ago": under 24 hours;
// - "Yesterday": the previous calendar day, in the phone's time zone;
// - "12 Nov": anything older, with the year ("12 Nov 2025") when it isn't this year.
// No package and no Intl: the month names are written out, so it works the same on
// every phone.
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// `date`: anything Date accepts (the backend's ISO text). `now`: for tests.
// An unreadable date gives '' (nothing is shown).
export function timeAgo(date, now = new Date()) {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return '';
  const ago = now.getTime() - then.getTime();
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < 24 * HOUR) return `${Math.floor(ago / HOUR)} h ago`;

  // Midnight at the start of yesterday. Built from the calendar date, not by taking off
  // 24 hours, so a day with a clock change still counts as one day.
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (then >= yesterday) return 'Yesterday';

  const day = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === now.getFullYear()
    ? day
    : `${day} ${then.getFullYear()}`;
}
