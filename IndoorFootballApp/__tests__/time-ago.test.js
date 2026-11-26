/* eslint-env jest */
// Tests for timeAgo, how the Notifications screen shows when an update happened
// (docs/features/notifications.md, P27; the steps approved on 2026-11-26).

import { timeAgo } from '../src/utils/timeAgo';

describe('timeAgo (P27)', () => {
  const NOW = new Date(2026, 10, 27, 9, 0, 0); // 27 Nov 2026, 09:00 on the phone

  test.each([
    [new Date(2026, 10, 27, 8, 59, 30), 'Just now'],
    [new Date(2026, 10, 27, 9, 5, 0), 'Just now'], // the phone's clock is behind
    [new Date(2026, 10, 27, 8, 59, 0), '1 min ago'],
    [new Date(2026, 10, 27, 8, 5, 0), '55 min ago'],
    [new Date(2026, 10, 27, 8, 0, 0), '1 h ago'],
    [new Date(2026, 10, 26, 22, 0, 0), '11 h ago'],
    [new Date(2026, 10, 26, 9, 0, 1), '23 h ago'],
    [new Date(2026, 10, 26, 8, 0, 0), 'Yesterday'],
    [new Date(2026, 10, 26, 0, 0, 0), 'Yesterday'],
    [new Date(2026, 10, 25, 23, 59, 0), '25 Nov'],
    [new Date(2026, 0, 3, 12, 0, 0), '3 Jan'],
    [new Date(2025, 10, 12, 12, 0, 0), '12 Nov 2025'],
  ])('%s → %s', (then, expected) => {
    expect(timeAgo(then.toISOString(), NOW)).toBe(expected);
  });

  test('an unreadable date shows nothing', () => {
    expect(timeAgo('not a date', NOW)).toBe('');
  });

  test('without a "now", it uses the phone\'s clock', () => {
    expect(timeAgo(new Date().toISOString())).toBe('Just now');
  });
});
