/* eslint-env jest */
// Tests for the Notifications tab's badge (docs/features/notifications.md, section e,
// "The badge", P31–P33): when the number is fetched, what the tab shows, late and failed
// replies, a fresh start at the next login, and nothing for the admin. Renders the real
// navigators with a fake API.

import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import PlayerNavigator from '../src/navigation/PlayerNavigator';
import OwnerNavigator from '../src/navigation/OwnerNavigator';
import AdminNavigator from '../src/navigation/AdminNavigator';
import api, { setTeamChangeListener } from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
  setTeamChangeListener: jest.fn(),
}));

const PLAYER = { id: 10, name: 'Rahim Uddin', role: 'PLAYER' };
const PLAYER_2 = { id: 11, name: 'Tanvir Ahmed', role: 'PLAYER' };
const OWNER = { id: 20, name: 'Arena One', role: 'OWNER' };
const ADMIN = { id: 30, name: 'Admin', role: 'ADMIN' };

const PAGE = { items: [], page: 1, limit: 20, total: 0 };
const SCREEN = {
  count: 2,
  needsAction: { invites: [], joinRequests: [] },
  updates: [
    {
      id: 5,
      type: 'memberRemoved',
      text: 'You were removed from Alpha FC.',
      note: null,
      createdAt: new Date().toISOString(),
      read: false,
      opens: null,
    },
  ],
};

// Replies by path. '/notifications/count' answers from `counts`, one per request, so a
// test can hold one back (a deferred) or fail it (a function, so the failure is only
// made when the request is sent).
let counts;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const countReply = value => Promise.resolve({ data: { count: value } });

let teamChange; // the listener the provider gave api.js
let removeTeamChange;

// The screens update their state after their (fake) loads finish, which React reports as
// "not wrapped in act(...)". That message is noise here; every other error still shows.
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    realConsoleError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  jest.clearAllMocks();
  counts = [];
  teamChange = null;
  removeTeamChange = jest.fn(() => {
    teamChange = null;
  });
  setTeamChangeListener.mockImplementation(listener => {
    teamChange = listener;
    return removeTeamChange;
  });
  api.get.mockImplementation(path => {
    if (path === '/notifications/count') {
      const next = counts.shift();
      if (typeof next === 'function') return next();
      return next ?? countReply(0);
    }
    if (path === '/notifications') return Promise.resolve({ data: SCREEN });
    if (['/teams', '/players', '/owners'].includes(path)) {
      return Promise.resolve({ data: PAGE });
    }
    if (path === '/owners/me') {
      return Promise.resolve({
        data: { id: 20, ownerProfile: { indoorName: 'Arena One' } },
      });
    }
    if (path === '/admin/stats') {
      return Promise.resolve({ data: { pendingVenueCount: 0 } });
    }
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: { count: 1 } }); // POST /notifications/read
});

const settle = () =>
  ReactTestRenderer.act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

// Renders a navigator for a user; `rerender` swaps the user (or logs out with null), the
// way AppNavigator does.
function App({ user, Navigator }) {
  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ user, logout: jest.fn() }}>
        <NavigationContainer>
          {user ? <Navigator key={user.id} /> : null}
        </NavigationContainer>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

async function render(user, Navigator = PlayerNavigator) {
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <App user={user} Navigator={Navigator} />,
    );
  });
  await settle();
  return renderer;
}

const tabs = renderer =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function' &&
      typeof node.props.onLongPress === 'function',
  );
// What the Notifications tab says to screen readers: "Notifications" or "Notifications, 3".
const notificationsTab = renderer =>
  tabs(renderer)
    .map(tab => tab.props.accessibilityLabel)
    .find(label => label.startsWith('Notifications'));

async function pressTab(renderer, label) {
  const tab = tabs(renderer).find(t =>
    t.props.accessibilityLabel.startsWith(label),
  );
  await ReactTestRenderer.act(() => tab.props.onPress());
  await settle();
}

const countRequests = () =>
  api.get.mock.calls.filter(([path]) => path === '/notifications/count').length;

const appStateListener = () => {
  const calls = AppState.addEventListener.mock.calls;
  return calls[calls.length - 1][1];
};

describe('When the number is fetched', () => {
  test('when the app opens (the first tab comes into view): once, and the tab shows it', async () => {
    counts = [countReply(3)];
    const renderer = await render(PLAYER);

    expect(countRequests()).toBe(1);
    expect(notificationsTab(renderer)).toBe('Notifications, 3');
  });

  test('when the user switches to another tab', async () => {
    counts = [countReply(1), countReply(4)];
    const renderer = await render(PLAYER);

    await pressTab(renderer, 'Explore');

    expect(countRequests()).toBe(2);
    expect(notificationsTab(renderer)).toBe('Notifications, 4');
  });

  test('switching to Notifications loads the screen instead, which brings the number, then reading it', async () => {
    counts = [countReply(7)];
    let read;
    api.post.mockImplementation(() => {
      read = deferred();
      return read.promise;
    });
    const renderer = await render(PLAYER);

    await pressTab(renderer, 'Notifications');

    expect(countRequests()).toBe(1);
    expect(api.get).toHaveBeenCalledWith('/notifications');
    expect(notificationsTab(renderer)).toBe('Notifications, 2');

    // The read's reply has the number after reading.
    await ReactTestRenderer.act(async () =>
      read.resolve({ data: { count: 0 } }),
    );
    await settle();
    expect(notificationsTab(renderer)).toBe('Notifications');
  });

  test('when the app comes back to the foreground', async () => {
    counts = [countReply(1), countReply(6)];
    const renderer = await render(PLAYER);

    await ReactTestRenderer.act(async () => appStateListener()('background'));
    expect(countRequests()).toBe(1);
    await ReactTestRenderer.act(async () => appStateListener()('active'));
    await settle();

    expect(countRequests()).toBe(2);
    expect(notificationsTab(renderer)).toBe('Notifications, 6');
  });

  test('after a team action (the api.js listener)', async () => {
    counts = [countReply(2), countReply(1)];
    const renderer = await render(PLAYER);
    expect(teamChange).toEqual(expect.any(Function));

    await ReactTestRenderer.act(async () => teamChange());
    await settle();

    expect(countRequests()).toBe(2);
    expect(notificationsTab(renderer)).toBe('Notifications, 1');
  });

  test('a venue owner gets the badge too', async () => {
    counts = [countReply(2)];
    const renderer = await render(OWNER, OwnerNavigator);

    expect(countRequests()).toBe(1);
    expect(notificationsTab(renderer)).toBe('Notifications, 2');
    expect(teamChange).toEqual(expect.any(Function));
  });
});

describe('What the tab shows', () => {
  test('nothing at 0', async () => {
    counts = [countReply(0)];
    const renderer = await render(PLAYER);

    expect(notificationsTab(renderer)).toBe('Notifications');
  });

  test('"99+" above 99', async () => {
    counts = [countReply(150)];
    const renderer = await render(PLAYER);

    expect(notificationsTab(renderer)).toBe('Notifications, 99+');
  });
});

describe('Late and failed replies (P33)', () => {
  test('a reply that arrives after a newer one is ignored', async () => {
    const first = deferred();
    const second = deferred();
    counts = [first.promise, second.promise];
    const renderer = await render(PLAYER);
    await pressTab(renderer, 'Explore');

    await ReactTestRenderer.act(async () =>
      second.resolve({ data: { count: 5 } }),
    );
    await ReactTestRenderer.act(async () =>
      first.resolve({ data: { count: 2 } }),
    );
    await settle();

    expect(notificationsTab(renderer)).toBe('Notifications, 5');
  });

  test('a failed refresh keeps the last number', async () => {
    counts = [countReply(3), () => Promise.reject(new Error('Network Error'))];
    const renderer = await render(PLAYER);

    await pressTab(renderer, 'Explore');

    expect(countRequests()).toBe(2);
    expect(notificationsTab(renderer)).toBe('Notifications, 3');
  });

  test('a reply without a number changes nothing', async () => {
    counts = [countReply(3), Promise.resolve({ data: {} })];
    const renderer = await render(PLAYER);

    await pressTab(renderer, 'Explore');

    expect(notificationsTab(renderer)).toBe('Notifications, 3');
  });
});

describe('Logout and the next login (P31)', () => {
  test('nothing is carried over, and a late reply for the old account is ignored', async () => {
    const late = deferred();
    counts = [countReply(4), late.promise];
    const renderer = await render(PLAYER);
    expect(notificationsTab(renderer)).toBe('Notifications, 4');
    await pressTab(renderer, 'Explore'); // a refresh still on its way at logout

    // Log out: the navigator and its provider go, and so does the api.js listener.
    await ReactTestRenderer.act(async () =>
      renderer.update(<App user={null} Navigator={PlayerNavigator} />),
    );
    expect(removeTeamChange).toHaveBeenCalled();
    expect(teamChange).toBeNull();

    // Someone else logs in: their number is still on its way.
    const next = deferred();
    counts = [next.promise];
    await ReactTestRenderer.act(async () =>
      renderer.update(<App user={PLAYER_2} Navigator={PlayerNavigator} />),
    );
    await settle();
    expect(notificationsTab(renderer)).toBe('Notifications');

    // The old account's late reply lands nowhere; the new one shows.
    await ReactTestRenderer.act(async () =>
      late.resolve({ data: { count: 9 } }),
    );
    await settle();
    expect(notificationsTab(renderer)).toBe('Notifications');
    await ReactTestRenderer.act(async () =>
      next.resolve({ data: { count: 1 } }),
    );
    await settle();
    expect(notificationsTab(renderer)).toBe('Notifications, 1');
  });

  test('logged out: no count requests', async () => {
    await render(null);

    expect(countRequests()).toBe(0);
  });
});

describe('The admin', () => {
  test('no Notifications tab, no badge, no count requests, no listener', async () => {
    const renderer = await render(ADMIN, AdminNavigator);
    await pressTab(renderer, 'Venues');

    expect(notificationsTab(renderer)).toBeUndefined();
    expect(countRequests()).toBe(0);
    expect(setTeamChangeListener).not.toHaveBeenCalled();
  });
});
