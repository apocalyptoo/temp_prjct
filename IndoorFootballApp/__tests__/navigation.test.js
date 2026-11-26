/* eslint-env jest */
// Smoke tests for the bottom-tab navigators (src/navigation): one per role. Each renders
// the real navigator with a signed-in user and a fake API, checks the tab labels,
// switches tabs through our TabBar, opens a pushed screen, and checks what Android's
// back button does (React Navigation calls goBack when it can, else the app closes).

import React from 'react';
import { Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import PlayerNavigator from '../src/navigation/PlayerNavigator';
import OwnerNavigator from '../src/navigation/OwnerNavigator';
import AdminNavigator from '../src/navigation/AdminNavigator';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const PLAYER = {
  id: 10,
  name: 'Rahim Uddin',
  email: 'rahim@example.com',
  role: 'PLAYER',
};
const OWNER = {
  id: 20,
  name: 'Arena One',
  email: 'arena@example.com',
  role: 'OWNER',
};
const ADMIN = {
  id: 30,
  name: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN',
};

const TEAM = {
  id: 1,
  name: 'Dhanmondi Strikers',
  description: 'Weekend crew',
  captainId: PLAYER.id,
  createdAt: '2026-11-20T10:00:00.000Z',
  members: [
    {
      id: 1,
      teamId: 1,
      userId: PLAYER.id,
      status: 'accepted',
      createdAt: '2026-11-20T10:00:00.000Z',
      user: { id: PLAYER.id, name: PLAYER.name },
    },
  ],
  pendingInvites: [],
  memberCount: 1,
  maxMembers: 15,
  joinRequestCount: 0,
};

// A second player, in the first team and captain of a second one, for the chain of
// Team detail and Player detail pages.
const TANVIR_ROW = {
  id: 2,
  teamId: 1,
  userId: 11,
  status: 'accepted',
  createdAt: '2026-11-20T10:00:00.000Z',
  user: {
    id: 11,
    name: 'Tanvir Ahmed',
    playerProfile: { name: 'Tanvir Ahmed', position: 'Goalkeeper' },
  },
};

// GET /teams/:teamId for the new Team detail screen.
const TEAM_DETAIL = {
  ...TEAM,
  members: [...TEAM.members, TANVIR_ROW],
  memberCount: 2,
  maxMembers: 15,
  viewerState: 'none',
};
const SECOND_TEAM_DETAIL = {
  id: 2,
  name: 'Mirpur Mavericks',
  description: null,
  area: null,
  captainId: 11,
  createdAt: '2026-11-21T10:00:00.000Z',
  members: [{ ...TANVIR_ROW, id: 3, teamId: 2 }],
  memberCount: 1,
  maxMembers: 15,
  viewerState: 'none',
};
// GET /players/11 for Player detail.
const TANVIR_PROFILE = {
  id: 11,
  role: 'PLAYER',
  name: 'Tanvir Ahmed',
  playerProfile: { name: 'Tanvir Ahmed', position: 'Goalkeeper' },
  teams: [
    {
      id: 2,
      name: 'Mirpur Mavericks',
      area: null,
      memberCount: 1,
      maxMembers: 15,
      isCaptain: true,
    },
    {
      id: 1,
      name: 'Dhanmondi Strikers',
      area: null,
      memberCount: 2,
      maxMembers: 15,
      isCaptain: false,
    },
  ],
};

// A live venue, for Explore → Venues and Venue detail.
const VENUE = {
  userId: 5,
  indoorName: 'Floodlight Arena',
  area: 'Dhanmondi 27',
  address: 'Road 5',
  phone: '01712345678',
  website: null,
  description: null,
  openingHours: null,
  pricingInfo: null,
};

// GET /notifications for a player: one update about the first team.
const PLAYER_NOTIFICATIONS = {
  count: 1,
  needsAction: { invites: [], joinRequests: [] },
  updates: [
    {
      id: 7,
      type: 'memberRemoved',
      text: 'You were removed from Dhanmondi Strikers.',
      note: null,
      createdAt: '2026-11-20T10:00:00.000Z',
      read: false,
      opens: { kind: 'team', id: 1, name: 'Dhanmondi Strikers' },
    },
  ],
};
// The same for a venue owner: their venue was approved.
const OWNER_NOTIFICATIONS = {
  count: 1,
  needsAction: { invites: [], joinRequests: [] },
  updates: [
    {
      id: 8,
      type: 'venueApproved',
      text: 'Arena One was approved. Players can find it now.',
      note: null,
      createdAt: '2026-11-20T10:00:00.000Z',
      read: false,
      opens: { kind: 'venue', name: 'Arena One' },
    },
  ],
};

// Fake server replies, by path. Anything else gets an empty list.
const REPLIES = {
  '/owners': { items: [VENUE], page: 1, limit: 20, total: 1 },
  '/owners/5': VENUE,
  '/teams/me': [TEAM],
  '/notifications': PLAYER_NOTIFICATIONS,
  // The paged player list (Explore → Players).
  '/players': {
    items: [
      {
        id: 12,
        name: 'Listed Player',
        playerProfile: { name: 'Listed Player', position: 'Forward' },
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
  },
  // The paged team list (Explore → Teams): light rows, without member rows.
  '/teams': {
    items: [
      {
        id: TEAM.id,
        name: TEAM.name,
        description: TEAM.description,
        area: null,
        createdAt: TEAM.createdAt,
        captainId: TEAM.captainId,
        captain: { id: PLAYER.id, name: PLAYER.name },
        memberCount: 1,
        maxMembers: 15,
        viewerState: 'captain',
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
  },
  '/teams/1': TEAM_DETAIL,
  '/teams/2': SECOND_TEAM_DETAIL,
  '/players/11': TANVIR_PROFILE,
  '/players/me': {
    id: PLAYER.id,
    email: PLAYER.email,
    playerProfile: {
      name: PLAYER.name,
      phone: '01700000000',
      position: 'Midfielder',
    },
  },
  '/owners/me': {
    id: OWNER.id,
    email: OWNER.email,
    role: 'OWNER',
    ownerProfile: {
      indoorName: 'Arena One',
      phone: '01800000000',
      address: 'Road 1',
      website: null,
      description: null,
    },
  },
  '/auth/deletion-preview': {
    previewCode: 'a'.repeat(64),
    captainedTeams: [],
    otherTeams: [],
    pendingCount: 0,
    venue: null,
  },
  '/admin/stats': {
    userCount: 3,
    playerCount: 1,
    ownerCount: 1,
    teamCount: 1,
    adminCount: 1,
    pendingVenueCount: 1,
  },
  // The admin's venue list: one venue waiting for review.
  '/admin/indoors': [
    {
      ...VENUE,
      email: 'arena@example.com',
      verified: true,
      approvedAt: null,
      reviewNote: null,
      missingFields: [],
    },
  ],
};

// The old screens update their state after their (fake) loads finish, which React
// reports as "not wrapped in act(...)". That message is noise here; every other error
// still shows.
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    realConsoleError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  api.get.mockImplementation(path =>
    Promise.resolve({ data: REPLIES[path] ?? [] }),
  );
  // POST /notifications/read, sent when the Notifications screen shows unread updates.
  api.post.mockResolvedValue({ data: { count: 0 } });
});

// Lets pending fetches, their state updates and focus effects finish.
const settle = () =>
  ReactTestRenderer.act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

async function renderNavigator(Navigator, user) {
  const navigationRef = createNavigationContainerRef();
  let renderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user, logout: jest.fn() }}>
          <NavigationContainer ref={navigationRef}>
            <Navigator />
          </NavigationContainer>
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  await settle();
  return { renderer, navigationRef };
}

// The tab buttons in our TabBar, by label.
const tabButtons = renderer =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function' &&
      typeof node.props.onLongPress === 'function',
  );
const tabLabels = renderer =>
  tabButtons(renderer).map(tab => tab.props.accessibilityLabel);

async function pressTab(renderer, label) {
  const tab = tabButtons(renderer).find(
    t => t.props.accessibilityLabel === label,
  );
  await ReactTestRenderer.act(() => tab.props.onPress());
  await settle();
}

// Presses the nearest tappable thing around the given text. last: the last match
// (screens in other tabs stay mounted, so the same text can show twice).
async function pressText(renderer, text, { last = false } = {}) {
  const matches = renderer.root
    .findAllByType(NativeText)
    .filter(node => [].concat(node.props.children).join('') === text);
  const textNode = last ? matches[matches.length - 1] : matches[0];
  let node = textNode;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  await ReactTestRenderer.act(() => node.props.onPress());
  await settle();
}

async function pressLabel(renderer, label) {
  const node = renderer.root
    .findAll(
      n =>
        n.props.accessibilityLabel === label &&
        typeof n.props.onPress === 'function',
    )
    .pop();
  await ReactTestRenderer.act(() => node.props.onPress());
  await settle();
}

const current = navigationRef => navigationRef.getCurrentRoute().name;
const currentTab = navigationRef => {
  const root = navigationRef.getRootState();
  return root.routes[root.index].name;
};

async function goBack(navigationRef) {
  await ReactTestRenderer.act(() => navigationRef.goBack());
  await settle();
}

describe('Player navigator', () => {
  test('tabs, a pushed screen with the tab bar still shown, and Android back', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );

    expect(tabLabels(renderer)).toEqual([
      'My Teams',
      'Explore',
      'Notifications',
      'Profile',
    ]);
    expect(current(navigationRef)).toBe('MyTeams');

    // Open a team: Team detail is pushed inside the My Teams tab, and the tab bar stays.
    await pressText(renderer, 'Dhanmondi Strikers');
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(navigationRef.getCurrentRoute().params).toEqual({ teamId: 1 });
    expect(tabLabels(renderer)).toHaveLength(4);

    // Back inside a tab goes back within it.
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');

    // Explore opens on Teams; a team opens Team detail inside the Explore tab. (My Teams,
    // still mounted in its own tab, shows the same team name, so press the last one.)
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');
    await pressText(renderer, 'Dhanmondi Strikers', { last: true });
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({ teamId: 1 });
    expect(tabLabels(renderer)).toHaveLength(4);
    // Pressing Explore again goes back to its first screen.
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');
    await pressTab(renderer, 'My Teams');

    // The Players section: a player opens Player detail inside the Explore tab, and
    // coming back doesn't load the list again.
    await pressTab(renderer, 'Explore');
    await pressText(renderer, 'Players');
    expect(current(navigationRef)).toBe('Explore');
    await pressText(renderer, 'Listed Player');
    expect(current(navigationRef)).toBe('PlayerDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 12,
      playerName: 'Listed Player',
    });
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('Explore');
    for (const path of ['/teams', '/players']) {
      expect(api.get.mock.calls.filter(([p]) => p === path)).toHaveLength(1);
    }

    // The Venues section: a venue opens Venue detail inside the Explore tab; its back
    // link returns to Explore.
    await pressText(renderer, 'Venues');
    await pressText(renderer, 'Floodlight Arena');
    expect(current(navigationRef)).toBe('VenueDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 5,
      venueName: 'Floodlight Arena',
    });
    expect(tabLabels(renderer)).toHaveLength(4);
    await pressLabel(renderer, 'Back to Explore');
    expect(current(navigationRef)).toBe('Explore');

    // Pressing the tab you're on goes back to its first screen.
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');

    // From the first screen of another tab, back goes to the first tab…
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');
    // …and from there there's nothing to go back to, so Android leaves the app.
    expect(navigationRef.canGoBack()).toBe(false);

    // Notifications: an update opens Team detail inside the Notifications tab, whose
    // back link says "Notifications" (notifications spec P29).
    await pressTab(renderer, 'Notifications');
    expect(current(navigationRef)).toBe('Notifications');
    await pressText(renderer, 'You were removed from Dhanmondi Strikers.');
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(currentTab(navigationRef)).toBe('NotificationsTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({ teamId: 1 });
    await pressLabel(renderer, 'Back to Notifications');
    expect(current(navigationRef)).toBe('Notifications');

    // Profile has the Settings gear.
    await pressTab(renderer, 'Profile');
    expect(current(navigationRef)).toBe('PlayerProfile');
    const gear = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Settings' &&
        typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(() => gear.props.onPress());
    await settle();
    expect(current(navigationRef)).toBe('Settings');

    // Settings → Delete account, with the preview loaded; Back returns to Settings.
    await pressText(renderer, 'Delete account');
    expect(current(navigationRef)).toBe('DeleteAccount');
    expect(currentTab(navigationRef)).toBe('ProfileTab');
    expect(
      renderer.root
        .findAllByType(NativeText)
        .some(node => node.props.children === 'What will be deleted'),
    ).toBe(true);
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('Settings');
  });
});

describe('Explore from My Teams (explore spec, section e)', () => {
  // A player with no teams and no requests: My Teams' empty state.
  beforeEach(() => {
    api.get.mockImplementation(path =>
      Promise.resolve({
        data: path === '/teams/me' ? [] : REPLIES[path] ?? [],
      }),
    );
  });
  const exploreRoutes = navigationRef =>
    navigationRef
      .getRootState()
      .routes.find(r => r.name === 'ExploreTab')
      .state.routes.map(r => r.name);
  const selectedSection = renderer =>
    renderer.root
      .findAll(
        n =>
          n.props.accessibilityRole === 'tab' &&
          typeof n.props.style === 'function' &&
          n.props.accessibilityState?.selected,
      )
      .map(n => n.props.accessibilityLabel);

  test('"Find a team" opens Explore on Teams; back returns to My Teams', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    await pressText(renderer, 'Find a team');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(current(navigationRef)).toBe('Explore');
    expect(selectedSection(renderer)).toContain('Teams');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');
  });

  test('also when Explore was left on another section, with a detail screen open', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    for (let i = 0; i < 2; i += 1) {
      await pressTab(renderer, 'Explore');
      await pressText(renderer, 'Players');
      await pressText(renderer, 'Listed Player');
      expect(exploreRoutes(navigationRef)).toEqual(['Explore', 'PlayerDetail']);

      await pressTab(renderer, 'My Teams');
      await pressText(renderer, 'Find a team');
      expect(exploreRoutes(navigationRef)).toEqual(['Explore']);
      expect(current(navigationRef)).toBe('Explore');
      expect(selectedSection(renderer)).toContain('Teams');
      expect(selectedSection(renderer)).not.toContain('Players');
    }
  });

  test('no teams anywhere: Create team in Explore opens the form over My Teams', async () => {
    api.get.mockImplementation(path =>
      Promise.resolve({
        data:
          path === '/teams'
            ? { items: [], page: 1, limit: 20, total: 0 }
            : path === '/teams/me'
            ? []
            : REPLIES[path] ?? [],
      }),
    );
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    await pressTab(renderer, 'Explore');
    await pressText(renderer, 'Create team', { last: true });
    expect(current(navigationRef)).toBe('CreateTeam');
    expect(currentTab(navigationRef)).toBe('MyTeamsTab');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');
  });
});

// The screens a tab's stack can show (its state exists once the tab has been opened).
const stackRoutes = (navigationRef, tab) =>
  navigationRef.getRootState().routes.find(r => r.name === tab).state
    ?.routeNames ?? [];

describe('Player detail (explore spec P30)', () => {
  test('registered in every stack that can show a team', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    await pressTab(renderer, 'Explore');
    await pressTab(renderer, 'Notifications');

    for (const tab of ['MyTeamsTab', 'ExploreTab', 'NotificationsTab']) {
      expect(stackRoutes(navigationRef, tab)).toEqual(
        expect.arrayContaining(['TeamDetail', 'PlayerDetail']),
      );
      // The old lists' routes are gone.
      for (const old of ['Teams', 'Players', 'Venues']) {
        expect(stackRoutes(navigationRef, tab)).not.toContain(old);
      }
    }
  });

  test('team → player → their other team → player, and Android back one step at a time', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    const stackOf = () =>
      navigationRef
        .getRootState()
        .routes.find(r => r.name === 'MyTeamsTab')
        .state.routes.map(r => r.name);

    await pressText(renderer, 'Dhanmondi Strikers');
    expect(current(navigationRef)).toBe('TeamDetail');

    await pressText(renderer, 'Tanvir Ahmed', { last: true });
    expect(current(navigationRef)).toBe('PlayerDetail');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 11,
      playerName: 'Tanvir Ahmed',
    });
    expect(api.get).toHaveBeenCalledWith('/players/11');
    expect(tabLabels(renderer)).toHaveLength(4);

    await pressText(renderer, 'Mirpur Mavericks', { last: true });
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(navigationRef.getCurrentRoute().params).toEqual({ teamId: 2 });

    // The same player again: pushed, not jumped back to the earlier page.
    await pressText(renderer, 'Tanvir Ahmed', { last: true });
    expect(stackOf()).toEqual([
      'MyTeams',
      'TeamDetail',
      'PlayerDetail',
      'TeamDetail',
      'PlayerDetail',
    ]);

    for (const [screen, params] of [
      ['TeamDetail', { teamId: 2 }],
      ['PlayerDetail', { userId: 11, playerName: 'Tanvir Ahmed' }],
      ['TeamDetail', { teamId: 1 }],
    ]) {
      await goBack(navigationRef);
      expect(current(navigationRef)).toBe(screen);
      expect(navigationRef.getCurrentRoute().params).toEqual(params);
    }
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');
  });
});

describe('Invite players (explore spec P29)', () => {
  test('from Team detail; a player opens on top of it, even one already open below, and back returns', async () => {
    api.get.mockImplementation(path =>
      Promise.resolve({
        data:
          path === '/teams/2'
            ? {
                ...SECOND_TEAM_DETAIL,
                captainId: PLAYER.id,
                viewerState: 'captain',
              }
            : path === '/teams/2/invite-candidates'
            ? REPLIES['/players']
            : REPLIES[path] ?? [],
      }),
    );
    const { renderer, navigationRef } = await renderNavigator(
      PlayerNavigator,
      PLAYER,
    );
    const stackOf = () =>
      navigationRef
        .getRootState()
        .routes.find(r => r.name === 'MyTeamsTab')
        .state.routes.map(r => r.name);
    await pressText(renderer, 'Dhanmondi Strikers');
    await pressText(renderer, 'Tanvir Ahmed', { last: true });
    await pressText(renderer, 'Mirpur Mavericks', { last: true });
    await pressText(renderer, 'Invite players', { last: true });
    expect(current(navigationRef)).toBe('InvitePlayers');
    await pressText(renderer, 'Listed Player', { last: true });
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 12,
      playerName: 'Listed Player',
    });
    expect(stackOf()).toEqual([
      'MyTeams',
      'TeamDetail',
      'PlayerDetail',
      'TeamDetail',
      'InvitePlayers',
      'PlayerDetail',
    ]);
    const lists = () =>
      api.get.mock.calls.filter(
        ([path]) => path === '/teams/2/invite-candidates',
      ).length;
    const before = lists();
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('InvitePlayers');
    expect(lists()).toBe(before);
  });
});

describe('Owner navigator', () => {
  test('tabs, Explore lists, Notifications, Profile and Settings', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      OwnerNavigator,
      OWNER,
    );

    expect(tabLabels(renderer)).toEqual([
      'My Venue',
      'Explore',
      'Notifications',
      'Profile',
    ]);
    expect(current(navigationRef)).toBe('MyVenue');

    // My Venue's Edit venue opens the form inside the My Venue tab; back returns.
    await pressText(renderer, 'Edit venue');
    expect(current(navigationRef)).toBe('EditVenue');
    expect(currentTab(navigationRef)).toBe('MyVenueTab');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyVenue');

    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');
    await pressText(renderer, 'Venues');
    expect(tabLabels(renderer)).toHaveLength(4);
    // Venue owners open Venue detail too (read-only for everyone).
    await pressText(renderer, 'Floodlight Arena');
    expect(current(navigationRef)).toBe('VenueDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('Explore');

    // The Teams section: a team opens the read-only Team detail: no buttons to join.
    await pressText(renderer, 'Teams');
    await pressText(renderer, 'Dhanmondi Strikers');
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(
      renderer.root.findAll(
        node =>
          node.props.accessibilityLabel === 'Request to join' &&
          typeof node.props.onPress === 'function',
      ),
    ).toHaveLength(0);
    // Venue owners' Explore stack registers Team detail, but not the player screens.
    const exploreStack = navigationRef
      .getRootState()
      .routes.find(r => r.name === 'ExploreTab').state;
    expect(exploreStack.routeNames).toContain('TeamDetail');
    expect(exploreStack.routeNames).toContain('PlayerDetail');
    expect(exploreStack.routeNames).toEqual([
      'Explore',
      'VenueDetail',
      'TeamDetail',
      'PlayerDetail',
    ]);
    expect(exploreStack.routeNames).not.toContain('RequestToJoin');
    expect(exploreStack.routeNames).not.toContain('TransferCaptaincy');
    // A member row opens Player detail for owners too, without an Invite card.
    await pressText(renderer, 'Tanvir Ahmed');
    expect(current(navigationRef)).toBe('PlayerDetail');
    expect(
      renderer.root
        .findAllByType(NativeText)
        .some(node => node.props.children === 'Invite to my team'),
    ).toBe(false);
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('TeamDetail');

    // Notifications: no "Needs your action" for an owner (P23); a venue update opens
    // My Venue in its own tab (P22).
    api.get.mockImplementation(path =>
      Promise.resolve({
        data:
          path === '/notifications' ? OWNER_NOTIFICATIONS : REPLIES[path] ?? [],
      }),
    );
    await pressTab(renderer, 'Notifications');
    expect(current(navigationRef)).toBe('Notifications');
    const ownerTexts = renderer.root
      .findAllByType(NativeText)
      .map(node => node.props.children);
    expect(ownerTexts).toContain('Updates');
    expect(ownerTexts).not.toContain('Needs your action');
    await pressText(
      renderer,
      'Arena One was approved. Players can find it now.',
    );
    expect(current(navigationRef)).toBe('MyVenue');
    expect(currentTab(navigationRef)).toBe('MyVenueTab');

    // Profile: the account, with the Settings gear.
    await pressTab(renderer, 'Profile');
    expect(current(navigationRef)).toBe('OwnerProfile');
    const gear = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Settings' &&
        typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(() => gear.props.onPress());
    await settle();
    expect(current(navigationRef)).toBe('Settings');

    // Settings → Edit venue opens inside the Profile tab, so Back returns to Settings.
    // (My Venue, still mounted in its own tab, has an "Edit venue" button too, so press
    // the last one.)
    await pressText(renderer, 'Edit venue', { last: true });
    expect(current(navigationRef)).toBe('EditVenue');
    expect(currentTab(navigationRef)).toBe('ProfileTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      from: 'Settings',
    });
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('Settings');
    await pressText(renderer, 'Change password');
    expect(current(navigationRef)).toBe('ChangePassword');
    await goBack(navigationRef);
    await pressText(renderer, 'Delete account');
    expect(current(navigationRef)).toBe('DeleteAccount');
    await goBack(navigationRef);
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('OwnerProfile');

    // "Your venue listing" jumps to the My Venue tab.
    await pressText(renderer, 'Your venue listing');
    expect(current(navigationRef)).toBe('MyVenue');
    expect(currentTab(navigationRef)).toBe('MyVenueTab');
  });
});

describe('Admin navigator', () => {
  test('five tabs, each opening its screen', async () => {
    const { renderer, navigationRef } = await renderNavigator(
      AdminNavigator,
      ADMIN,
    );

    expect(tabLabels(renderer)).toEqual([
      'Dashboard',
      'Reports',
      'Venues',
      'Users',
      'Teams',
    ]);
    expect(current(navigationRef)).toBe('AdminDashboard');

    const expected = {
      Reports: 'AdminReports',
      Venues: 'AdminVenues',
      Users: 'ManageUsers',
      Teams: 'ManageTeams',
    };
    for (const [label, route] of Object.entries(expected)) {
      await pressTab(renderer, label);
      expect([label, current(navigationRef)]).toEqual([label, route]);
    }

    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('AdminDashboard');

    // The Dashboard's "Venues waiting for review" opens the Venues tab; a venue there
    // opens its review screen inside the tab, and back returns to the list.
    await pressText(renderer, 'Venues waiting for review');
    expect(currentTab(navigationRef)).toBe('VenuesTab');
    expect(current(navigationRef)).toBe('AdminVenues');
    await pressText(renderer, 'Floodlight Arena');
    expect(current(navigationRef)).toBe('AdminVenue');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 5,
      venueName: 'Floodlight Arena',
    });
    expect(tabLabels(renderer)).toHaveLength(5);
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('AdminVenues');
  });
});
