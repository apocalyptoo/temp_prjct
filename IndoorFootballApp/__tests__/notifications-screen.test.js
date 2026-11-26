/* eslint-env jest */
// Tests for the Notifications screen (docs/features/notifications.md, sections e, f and
// h): what a player and a venue owner see, the actions and their dialogs and errors,
// the updates with "New", marking as read, where a tap goes, the empty states, loading
// and reloading. Rendered alone with a fake API and a fake navigation object.

import React from 'react';
import {
  Alert,
  AppState,
  RefreshControl,
  Text as NativeText,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import NotificationsScreen, {
  LOAD_ERROR,
  NOTHING_AT_ALL,
  NO_ACTIONS,
  NO_UPDATES,
  updateIcon,
} from '../src/screens/Shared/NotificationsScreen';
import { ListRow } from '../src/components/ui';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

const PLAYER = { id: 1, name: 'Rahim Uddin', role: 'PLAYER' };
const OWNER = { id: 50, name: 'Arena One', role: 'OWNER' };

const invite = (teamId, name, memberCount = 11) => ({
  id: teamId * 10,
  teamId,
  createdAt: '2026-11-25T10:00:00.000Z',
  team: {
    id: teamId,
    name,
    area: 'Dhanmondi',
    memberCount,
    maxMembers: 15,
    captain: { id: 12, name: 'Tanvir Ahmed' },
  },
});

const requestRow = (userId, name, position, area, message = null) => ({
  id: userId * 100,
  userId,
  createdAt: '2026-11-25T10:00:00.000Z',
  message,
  user: { id: userId, name, playerProfile: { name, position, area } },
});

const group = (teamId, teamName, requests, memberCount = 9) => ({
  teamId,
  teamName,
  memberCount,
  maxMembers: 15,
  requests,
});

const MINUTE = 60 * 1000;
const ago = ms => new Date(Date.now() - ms).toISOString();

const update = (id, type, text, extra = {}) => ({
  id,
  type,
  text,
  note: null,
  createdAt: ago(5 * MINUTE),
  read: false,
  opens: null,
  ...extra,
});

const REMOVED = update(30, 'memberRemoved', 'You were removed from Alpha FC.', {
  opens: { kind: 'team', id: 7, name: 'Alpha FC' },
});
const DECLINED = update(
  29,
  'inviteDeclined',
  'Nayeem Islam declined the invite to Alpha FC.',
  { read: true, opens: { kind: 'player', id: 19, name: 'Nayeem Islam' } },
);

const reply = ({ invites = [], joinRequests = [], updates = [] } = {}) => ({
  count: 0,
  needsAction: { invites, joinRequests },
  updates,
});

const FULL_REPLY = reply({
  invites: [invite(7, 'Dhanmondi Strikers')],
  joinRequests: [
    group(9, 'Mirpur Mavericks', [
      requestRow(
        19,
        'Nayeem Islam',
        'Forward',
        'Mirpur 10',
        'I play Thursdays',
      ),
      requestRow(20, 'Fahim Rahman', 'Defender'),
    ]),
    group(11, 'Uttara United', [requestRow(21, 'Sakib Hasan', 'Goalkeeper')]),
  ],
  updates: [REMOVED, DECLINED],
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

function fakeNavigation() {
  const listeners = { focus: [], blur: [] };
  return {
    navigate: jest.fn(),
    addListener: jest.fn((event, callback) => {
      listeners[event]?.push(callback);
      return () => {
        listeners[event] = listeners[event].filter(fn => fn !== callback);
      };
    }),
    fire: event => act(async () => listeners[event].forEach(fn => fn())),
  };
}

// Renders the screen and brings it into view (the focus event), as React Navigation does.
async function render(data, { user = PLAYER } = {}) {
  if (data) api.get.mockResolvedValue({ data });
  const navigation = fakeNavigation();
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user }}>
          <NotificationsScreen navigation={navigation} />
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  await navigation.fire('focus');
  await settle();
  return { renderer, navigation };
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');
const texts = renderer => shownText(renderer).split(' | ');

const tappables = (renderer, label) =>
  renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  );
// The last match: a dialog renders after the screen, and its confirm button can share
// the label of the button that opened it ("Decline").
const button = (renderer, label) => tappables(renderer, label).pop();
const press = async (renderer, label) => {
  await act(async () => button(renderer, label).props.onPress());
  await settle();
};

// The update rows, as ListRow props.
const updateRows = renderer =>
  renderer.root.findAllByType(ListRow).filter(row => row.props.icon);
const rowFor = (renderer, text) =>
  updateRows(renderer).find(row => row.props.name === text);
const isNew = (renderer, text) =>
  rowFor(renderer, text).props.trailing !== null;

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

const readCalls = () =>
  api.post.mock.calls.filter(([path]) => path === '/notifications/read');
const loads = () =>
  api.get.mock.calls.filter(([path]) => path === '/notifications').length;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.post.mockResolvedValue({ data: { count: 0 } });
});

describe('What it shows', () => {
  test('a player: "Needs your action" with invites and one card per team of join requests, then "Updates"', async () => {
    const { renderer } = await render(FULL_REPLY);
    const text = shownText(renderer);

    expect(api.get).toHaveBeenCalledWith('/notifications');
    expect(text).toContain('Notifications');
    expect(text).toContain('Needs your action');
    expect(text).toContain('Dhanmondi Strikers');
    expect(text).toContain('Tanvir Ahmed invited you · 11 / 15 members');
    expect(text).toContain('Join requests · Mirpur Mavericks');
    expect(text).toContain('Join requests · Uttara United');
    // The rows as on Team detail: "Position · Area" and the quoted message.
    expect(text).toContain('Forward · Mirpur 10');
    expect(text).toContain('“I play Thursdays”');
    expect(text).toContain('Updates');
    // Order: invites, then the request cards, then the updates.
    const at = label => texts(renderer).indexOf(label);
    expect(at('Dhanmondi Strikers')).toBeLessThan(
      at('Join requests · Mirpur Mavericks'),
    );
    expect(at('Join requests · Uttara United')).toBeLessThan(at('Updates'));
    // Each request card counts its own requests.
    expect(texts(renderer)).toEqual(expect.arrayContaining(['2', '1']));
  });

  test('a venue owner: no "Needs your action" heading, only the updates (P23)', async () => {
    const { renderer } = await render(
      reply({
        updates: [
          update(
            5,
            'venueApproved',
            'Arena One was approved. Players can find it now.',
            {
              opens: { kind: 'venue', name: 'Arena One' },
            },
          ),
        ],
      }),
      { user: OWNER },
    );
    const text = shownText(renderer);

    expect(text).not.toContain('Needs your action');
    expect(text).not.toContain(NO_ACTIONS);
    expect(text).toContain('Updates');
    expect(text).toContain('Arena One was approved. Players can find it now.');
  });

  test("updates: newest first as sent, with their icon, time and the admin's note", async () => {
    const moved = update(
      40,
      'venueMovedToReview',
      'Arena One was moved back to review.',
      {
        note: 'Please add your phone.',
        createdAt: ago(3 * 60 * MINUTE),
        opens: { kind: 'venue', name: 'Arena One' },
      },
    );
    const { renderer } = await render(reply({ updates: [moved, REMOVED] }), {
      user: OWNER,
    });
    const rows = updateRows(renderer);

    expect(rows.map(row => row.props.name)).toEqual([
      'Arena One was moved back to review.',
      'You were removed from Alpha FC.',
    ]);
    expect(rows[0].props.icon).toBe('venue');
    expect(rows[0].props.meta).toBe('3 h ago');
    expect(rows[0].props.hint).toBe(
      'Note from the admin: Please add your phone.',
    );
    expect(rows[1].props.icon).toBe('remove');
    expect(rows[1].props.meta).toBe('5 min ago');
    expect(rows[1].props.hint).toBeNull();
  });

  test("every type has its icon; a type this version doesn't know gets the bell", () => {
    expect(
      [
        'requestApproved',
        'inviteAccepted',
        'venueApproved',
        'requestDeclined',
        'inviteDeclined',
        'memberRemoved',
        'memberLeft',
        'becameCaptain',
        'teamDeleted',
        'teamDeletedInvite',
        'teamDeletedRequest',
        'venueMovedToReview',
      ].map(updateIcon),
    ).toEqual([
      'approve',
      'approve',
      'approve',
      'reject',
      'reject',
      'remove',
      'leave',
      'captain',
      'delete',
      'delete',
      'delete',
      'venue',
    ]);
    expect(updateIcon('matchResult')).toBe('notifications');
  });

  test('unread updates end with "New", and screen readers hear "New." first (P26)', async () => {
    const { renderer } = await render(reply({ updates: [REMOVED, DECLINED] }));

    expect(isNew(renderer, REMOVED.text)).toBe(true);
    expect(isNew(renderer, DECLINED.text)).toBe(false);
    expect(rowFor(renderer, REMOVED.text).props.accessibilityLabel).toBe(
      'New. You were removed from Alpha FC., 5 min ago',
    );
    expect(rowFor(renderer, DECLINED.text).props.accessibilityLabel).toBe(
      'Nayeem Islam declined the invite to Alpha FC., 5 min ago',
    );
  });
});

describe('Empty states (P30)', () => {
  test('a player with nothing at all: one line, no headings', async () => {
    const { renderer } = await render(reply());
    const text = shownText(renderer);

    expect(text).toContain(NOTHING_AT_ALL);
    expect(text).not.toContain('Needs your action');
    expect(text).not.toContain('Updates');
  });

  test('a player with updates only: "Nothing needs your action."', async () => {
    const { renderer } = await render(reply({ updates: [REMOVED] }));

    expect(shownText(renderer)).toContain(NO_ACTIONS);
    expect(shownText(renderer)).not.toContain(NO_UPDATES);
  });

  test('a player with actions only: "No updates yet."', async () => {
    const { renderer } = await render(
      reply({ invites: [invite(7, 'Dhanmondi Strikers')] }),
    );

    expect(shownText(renderer)).toContain(NO_UPDATES);
    expect(shownText(renderer)).not.toContain(NO_ACTIONS);
  });

  test('an owner with no updates: "No notifications yet."', async () => {
    const { renderer } = await render(reply(), { user: OWNER });

    expect(shownText(renderer)).toContain(NOTHING_AT_ALL);
    expect(shownText(renderer)).not.toContain('Updates');
  });
});

describe('Invites', () => {
  test('Accept and Decline call the invite routes, once on a double tap, then reload', async () => {
    let finish;
    api.post.mockImplementation(path =>
      path === '/notifications/read'
        ? Promise.resolve({ data: {} })
        : new Promise(resolve => {
            finish = resolve;
          }),
    );
    const { renderer } = await render(FULL_REPLY);
    const accept = button(renderer, 'Accept the invite to Dhanmondi Strikers');

    await act(async () => {
      accept.props.onPress();
      accept.props.onPress();
    });
    // While it runs, the other buttons wait.
    expect(
      button(renderer, 'Decline the invite to Dhanmondi Strikers').props
        .accessibilityState.disabled,
    ).toBe(true);
    await act(async () => finish({ data: {} }));
    await settle();

    const accepts = api.post.mock.calls.filter(
      ([path]) => path === '/teams/7/accept',
    );
    expect(accepts).toHaveLength(1);
    expect(loads()).toBe(2);
    expect(Alert.alert).not.toHaveBeenCalled();

    api.post.mockResolvedValue({ data: {} });
    await press(renderer, 'Decline the invite to Dhanmondi Strikers');
    expect(api.post).toHaveBeenCalledWith('/teams/7/reject');
    expect(loads()).toBe(3);
  });

  test('a full team: Accept is disabled with "Team is full (15/15)"; Decline still works', async () => {
    const { renderer } = await render(
      reply({ invites: [invite(7, 'Dhanmondi Strikers', 15)] }),
    );

    expect(button(renderer, 'Team is full (15/15)').props.disabled).toBe(true);
    expect(
      button(renderer, 'Decline the invite to Dhanmondi Strikers').props
        .disabled,
    ).toBe(false);
  });

  test('tapping the card opens Team detail', async () => {
    const { renderer, navigation } = await render(FULL_REPLY);

    await press(renderer, 'Open Dhanmondi Strikers');

    expect(navigation.navigate).toHaveBeenCalledWith('TeamDetail', {
      teamId: 7,
    });
  });
});

describe('Join requests', () => {
  test('approve sends the approval for that team and player, once on a double tap, then reloads', async () => {
    let finish;
    api.post.mockImplementation(path =>
      path === '/notifications/read'
        ? Promise.resolve({ data: {} })
        : new Promise(resolve => {
            finish = resolve;
          }),
    );
    const { renderer } = await render(FULL_REPLY);
    const approve = button(renderer, 'Approve Sakib Hasan');

    await act(async () => {
      approve.props.onPress();
      approve.props.onPress();
    });
    expect(button(renderer, 'Approve Nayeem Islam').props.disabled).toBe(true);
    await act(async () => finish({ data: {} }));
    await settle();

    expect(
      api.post.mock.calls.filter(
        ([path]) => path === '/teams/11/requests/21/approve',
      ),
    ).toHaveLength(1);
    expect(loads()).toBe(2);
  });

  test('decline asks first, as on Team detail; Cancel sends nothing', async () => {
    const { renderer } = await render(FULL_REPLY);

    await press(renderer, 'Decline Nayeem Islam');
    expect(shownText(renderer)).toContain("Decline Nayeem Islam's request?");
    expect(shownText(renderer)).toContain('They can ask to join again later.');
    await press(renderer, 'Cancel');

    expect(
      api.post.mock.calls.filter(([path]) => path.startsWith('/teams')),
    ).toHaveLength(0);
  });

  test('decline, confirmed: the reject route for that team, then reload', async () => {
    const { renderer } = await render(FULL_REPLY);

    await press(renderer, 'Decline Nayeem Islam');
    await press(renderer, 'Decline');

    expect(api.post).toHaveBeenCalledWith('/teams/9/requests/19/reject');
    expect(loads()).toBe(2);
  });

  test('tapping a row opens Player detail', async () => {
    const { renderer, navigation } = await render(FULL_REPLY);

    await press(renderer, 'Nayeem Islam, Forward · Mirpur 10');

    expect(navigation.navigate).toHaveBeenCalledWith('PlayerDetail', {
      userId: 19,
      playerName: 'Nayeem Islam',
    });
  });
});

describe('Failed actions (section f, P34)', () => {
  test.each([
    [403, 'Only the team captain can approve or reject join requests.'],
    [404, 'Join request not found'],
    [409, 'Team is full (15/15).'],
  ])(
    'a %i says "Something changed" with the message, and reloads',
    async (status, message) => {
      const { renderer } = await render(FULL_REPLY);
      api.post.mockRejectedValue(httpError(status, message));

      await press(renderer, 'Approve Nayeem Islam');

      expect(Alert.alert).toHaveBeenCalledWith('Something changed', message);
      expect(loads()).toBe(2);
    },
  );

  test('another error says "Error" and does not reload', async () => {
    const { renderer } = await render(FULL_REPLY);
    api.post.mockRejectedValue(new Error('Network Error'));

    await press(renderer, 'Accept the invite to Dhanmondi Strikers');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Something went wrong. Please try again.',
    );
    expect(loads()).toBe(1);
  });
});

describe('Marking as read (D4, P16, P28)', () => {
  test('read is sent with the newest id shown', async () => {
    await render(reply({ updates: [REMOVED, DECLINED] }));

    expect(readCalls()).toEqual([['/notifications/read', { upToId: 30 }]]);
  });

  test('nothing unread: no read is sent', async () => {
    await render(reply({ updates: [DECLINED] }));

    expect(readCalls()).toHaveLength(0);
  });

  test('"New" stays through a pull to refresh and an action, and goes after leaving', async () => {
    const { renderer, navigation } = await render(
      reply({ invites: [invite(7, 'Dhanmondi Strikers')], updates: [REMOVED] }),
    );
    // The server now says it's read.
    const readNow = reply({
      invites: [invite(7, 'Dhanmondi Strikers')],
      updates: [{ ...REMOVED, read: true }],
    });
    api.get.mockResolvedValue({ data: readNow });

    await act(async () =>
      renderer.root.findByType(RefreshControl).props.onRefresh(),
    );
    await settle();
    expect(isNew(renderer, REMOVED.text)).toBe(true);

    await press(renderer, 'Decline the invite to Dhanmondi Strikers');
    expect(isNew(renderer, REMOVED.text)).toBe(true);

    // Another screen or tab: leaving. Coming back shows it as read.
    await navigation.fire('blur');
    expect(isNew(renderer, REMOVED.text)).toBe(false);
    await navigation.fire('focus');
    await settle();
    expect(isNew(renderer, REMOVED.text)).toBe(false);
    // Read was sent once, for the first load only.
    expect(readCalls()).toHaveLength(1);
  });

  test('a new unread update on a later load gets "New" too, and its own read', async () => {
    const { renderer } = await render(reply({ updates: [REMOVED] }));
    const newer = update(
      31,
      'becameCaptain',
      "You're now the captain of Alpha FC.",
      {
        opens: { kind: 'team', id: 7, name: 'Alpha FC' },
      },
    );
    api.get.mockResolvedValue({
      data: reply({ updates: [newer, { ...REMOVED, read: true }] }),
    });

    await act(async () =>
      renderer.root.findByType(RefreshControl).props.onRefresh(),
    );
    await settle();

    expect(isNew(renderer, newer.text)).toBe(true);
    expect(isNew(renderer, REMOVED.text)).toBe(true);
    expect(readCalls().map(([, body]) => body)).toEqual([
      { upToId: 30 },
      { upToId: 31 },
    ]);
  });

  test('a failed read shows nothing; the next visit tries again', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    const { renderer, navigation } = await render(
      reply({ updates: [REMOVED] }),
    );

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(isNew(renderer, REMOVED.text)).toBe(true);

    await navigation.fire('blur');
    await navigation.fire('focus');
    await settle();
    expect(readCalls()).toHaveLength(2);
    expect(isNew(renderer, REMOVED.text)).toBe(true);
  });

  test('a load that comes back after the user left is ignored: nothing is marked as read', async () => {
    let finish;
    api.get.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const { navigation } = await render(null);

    await navigation.fire('blur');
    await act(async () => finish({ data: reply({ updates: [REMOVED] }) }));
    await settle();

    expect(readCalls()).toHaveLength(0);
  });

  test('an older reply arriving after a newer one is ignored', async () => {
    const pending = [];
    api.get.mockImplementation(
      () => new Promise(resolve => pending.push(resolve)),
    );
    const { renderer } = await render(null);
    // A second load (pull to refresh) while the first is still on its way.
    // (Not awaited inside act: its reply is held back below.)
    await act(async () => {
      renderer.root.findByType(RefreshControl).props.onRefresh();
    });
    await settle();

    await act(async () => pending[1]({ data: reply({ updates: [REMOVED] }) }));
    await act(async () => pending[0]({ data: reply() }));
    await settle();

    expect(shownText(renderer)).toContain(REMOVED.text);
    expect(shownText(renderer)).not.toContain(NOTHING_AT_ALL);
  });
});

describe('Tapping an update (P22)', () => {
  test('a team update opens Team detail; declined and left open Player detail', async () => {
    const { renderer, navigation } = await render(
      reply({ updates: [REMOVED, DECLINED] }),
    );

    await act(async () => rowFor(renderer, REMOVED.text).props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('TeamDetail', {
      teamId: 7,
    });

    await act(async () => rowFor(renderer, DECLINED.text).props.onPress());
    expect(navigation.navigate).toHaveBeenLastCalledWith('PlayerDetail', {
      userId: 19,
      playerName: 'Nayeem Islam',
    });
  });

  test('a venue update opens My Venue in its own tab', async () => {
    const approved = update(
      5,
      'venueApproved',
      'Arena One was approved. Players can find it now.',
      {
        opens: { kind: 'venue', name: 'Arena One' },
      },
    );
    const { renderer, navigation } = await render(
      reply({ updates: [approved] }),
      {
        user: OWNER,
      },
    );

    await act(async () => rowFor(renderer, approved.text).props.onPress());

    expect(navigation.navigate).toHaveBeenCalledWith('MyVenueTab', {
      screen: 'MyVenue',
    });
  });

  test("`opens: null` (or a kind this version doesn't know) is not tappable, but still read out as one", async () => {
    const plain = update(3, 'memberLeft', 'A member left your team Alpha FC.');
    const future = update(4, 'matchResult', 'Alpha FC won 3–2.', {
      opens: { kind: 'match', id: 1, name: 'Alpha FC' },
    });
    const { renderer } = await render(reply({ updates: [plain, future] }));

    expect(rowFor(renderer, plain.text).props.onPress).toBeUndefined();
    expect(rowFor(renderer, future.text).props.onPress).toBeUndefined();
    const grouped = renderer.root.findAll(
      n =>
        n.props.accessible === true &&
        n.props.accessibilityLabel ===
          'New. A member left your team Alpha FC., 5 min ago',
    );
    expect(grouped.length).toBeGreaterThan(0);
  });
});

describe('Loading', () => {
  test('a failed first load says so, with Try again', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'));
    const { renderer } = await render(null);
    expect(shownText(renderer)).toContain(LOAD_ERROR);

    api.get.mockResolvedValue({ data: FULL_REPLY });
    await press(renderer, 'Try again');

    expect(shownText(renderer)).toContain('Dhanmondi Strikers');
  });

  test('a failed reload keeps what is shown', async () => {
    const { renderer } = await render(FULL_REPLY);
    api.get.mockRejectedValue(new Error('Network Error'));

    await act(async () =>
      renderer.root.findByType(RefreshControl).props.onRefresh(),
    );
    await settle();

    expect(shownText(renderer)).toContain('Dhanmondi Strikers');
    expect(shownText(renderer)).not.toContain(LOAD_ERROR);
  });

  test('loads again each time it comes into view', async () => {
    const { navigation } = await render(FULL_REPLY);

    await navigation.fire('blur');
    await navigation.fire('focus');
    await settle();

    expect(loads()).toBe(2);
  });

  test('back to the foreground: reloads while on this screen, not when the user is elsewhere', async () => {
    const { navigation } = await render(FULL_REPLY);
    const onChange = AppState.addEventListener.mock.calls.at(-1)[1];

    await act(async () => onChange('background'));
    await act(async () => onChange('active'));
    await settle();
    expect(loads()).toBe(2);

    await navigation.fire('blur');
    await act(async () => onChange('active'));
    await settle();
    expect(loads()).toBe(2);
  });

  test('the background is not leaving: "New" stays (P28)', async () => {
    const { renderer } = await render(reply({ updates: [REMOVED] }));
    const onChange = AppState.addEventListener.mock.calls.at(-1)[1];
    api.get.mockResolvedValue({
      data: reply({ updates: [{ ...REMOVED, read: true }] }),
    });

    await act(async () => onChange('background'));
    await act(async () => onChange('active'));
    await settle();

    expect(isNew(renderer, REMOVED.text)).toBe(true);
  });
});
