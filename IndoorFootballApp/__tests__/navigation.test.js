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

// GET /teams/:teamId for the new Team detail screen.
const TEAM_DETAIL = {
  ...TEAM,
  memberCount: 1,
  maxMembers: 15,
  viewerState: 'none',
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

// Fake server replies, by path. Anything else gets an empty list.
const REPLIES = {
  '/owners': { items: [VENUE], page: 1, limit: 20, total: 1 },
  '/owners/5': VENUE,
  '/teams/me': [TEAM],
  '/teams': [TEAM],
  '/teams/1': TEAM_DETAIL,
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

    // Explore → Teams → a team opens Team detail inside the Explore tab. (My Teams,
    // still mounted in its own tab, shows the same team name, so press the last one.)
    await pressTab(renderer, 'Explore');
    await pressText(renderer, 'Teams');
    await pressText(renderer, 'Dhanmondi Strikers', { last: true });
    expect(current(navigationRef)).toBe('TeamDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({ teamId: 1 });
    expect(tabLabels(renderer)).toHaveLength(4);
    // Pressing Explore again goes back to its first screen.
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');
    await pressTab(renderer, 'My Teams');

    // Explore opens its lists inside the Explore tab.
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');
    await pressText(renderer, 'Players');
    expect(current(navigationRef)).toBe('Players');

    // Explore → Venues → a venue opens Venue detail inside the Explore tab; its back
    // link returns to the list.
    await pressTab(renderer, 'Explore');
    await pressText(renderer, 'Venues');
    expect(current(navigationRef)).toBe('Venues');
    await pressText(renderer, 'Floodlight Arena');
    expect(current(navigationRef)).toBe('VenueDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    expect(navigationRef.getCurrentRoute().params).toEqual({
      userId: 5,
      venueName: 'Floodlight Arena',
    });
    expect(tabLabels(renderer)).toHaveLength(4);
    await pressText(renderer, 'Venues', { last: true });
    expect(current(navigationRef)).toBe('Venues');

    // Pressing the tab you're on goes back to its first screen.
    await pressTab(renderer, 'Explore');
    expect(current(navigationRef)).toBe('Explore');

    // From the first screen of another tab, back goes to the first tab…
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');
    // …and from there there's nothing to go back to, so Android leaves the app.
    expect(navigationRef.canGoBack()).toBe(false);

    // "+ Create Team" on the team list (Explore tab) jumps to Create Team in the
    // My Teams tab, with My Teams under it, so going back lands on My Teams.
    await pressTab(renderer, 'Explore');
    await pressText(renderer, 'Teams');
    expect(current(navigationRef)).toBe('Teams');
    await pressText(renderer, '+ Create Team');
    expect(current(navigationRef)).toBe('CreateTeam');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('MyTeams');

    // Notifications shows the invites screen; Profile has the Settings gear.
    await pressTab(renderer, 'Notifications');
    expect(current(navigationRef)).toBe('Invites');
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
  });
});

describe('Owner navigator', () => {
  test('tabs, Explore lists, Profile, Settings and the interim screens', async () => {
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
    await pressText(renderer, 'Venues');
    expect(current(navigationRef)).toBe('Venues');
    expect(tabLabels(renderer)).toHaveLength(4);
    // Venue owners open Venue detail too (read-only for everyone).
    await pressText(renderer, 'Floodlight Arena');
    expect(current(navigationRef)).toBe('VenueDetail');
    expect(currentTab(navigationRef)).toBe('ExploreTab');
    await goBack(navigationRef);
    expect(current(navigationRef)).toBe('Venues');

    // Explore → Teams → a team opens the read-only Team detail: no buttons to join.
    await pressTab(renderer, 'Explore');
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
    expect(exploreStack.routeNames).not.toContain('RequestToJoin');
    expect(exploreStack.routeNames).not.toContain('TransferCaptaincy');

    await pressTab(renderer, 'Notifications');
    expect(current(navigationRef)).toBe('OwnerNotifications');
    expect(
      renderer.root
        .findAllByType(NativeText)
        .some(node => node.props.children === 'No notifications yet.'),
    ).toBe(true);

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
