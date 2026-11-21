/* eslint-env jest */
// Tests for the My Teams screen (feature 1, docs/features/team-membership.md, section e,
// "My Teams"): the team cards, the captain's notice line, Requests sent with Cancel, the
// empty state, Create team and the reloads.

import React from 'react';
import { Alert, RefreshControl, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import MyTeamsScreen from '../src/screens/Team/MyTeamsScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const ME = { id: 1, name: 'Rahim Uddin', role: 'PLAYER' };

const team = (id, name, extra = {}) => ({
  id,
  name,
  description: null,
  captainId: 99,
  memberCount: 8,
  maxMembers: 15,
  members: [],
  ...extra,
});

const CAPTAINED = team(7, 'Dhanmondi Strikers', {
  captainId: ME.id,
  description: 'Weekend 5-a-side crew.',
  memberCount: 11,
  joinRequestCount: 2,
  pendingInvites: [],
});
const PLAYING = team(8, 'Mirpur Mavericks', {
  description: 'Thursday night games after work.',
});
const REQUEST = {
  id: 50,
  teamId: 9,
  createdAt: '2026-11-21T10:00:00.000Z',
  message: 'I play Thursdays',
  team: { id: 9, name: 'Uttara United', memberCount: 14, maxMembers: 15 },
};

function serve({ teams = [CAPTAINED, PLAYING], requests = [REQUEST] } = {}) {
  api.get.mockImplementation(path =>
    Promise.resolve({ data: path === '/teams/me' ? teams : requests }),
  );
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

async function render() {
  const navigation = {
    navigate: jest.fn(),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') callback();
      return () => {};
    }),
  };
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user: ME }}>
          <MyTeamsScreen navigation={navigation} />
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  await settle();
  return { renderer, navigation };
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const tappables = renderer =>
  renderer.root.findAll(
    n =>
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel,
  );
const labels = renderer =>
  tappables(renderer).map(n => n.props.accessibilityLabel);
const press = async (renderer, label) => {
  const node = tappables(renderer).find(
    n => n.props.accessibilityLabel === label,
  );
  await act(async () => node.props.onPress());
  await settle();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('Team cards', () => {
  test('name, "x / 15 members", the pill and the description; no delete', async () => {
    serve();
    const { renderer } = await render();
    const text = shownText(renderer);

    expect(api.get).toHaveBeenCalledWith('/teams/me');
    expect(api.get).toHaveBeenCalledWith('/players/requests');
    for (const shown of [
      'My Teams',
      'Dhanmondi Strikers',
      '11 / 15 members',
      'Captain',
      'Weekend 5-a-side crew.',
      'Mirpur Mavericks',
      '8 / 15 members',
      'Player',
      'Thursday night games after work.',
    ]) {
      expect(text).toContain(shown);
    }
    expect(text).not.toMatch(/delete/i);
  });

  test('the captain sees "2 join requests waiting for you"', async () => {
    serve();
    const { renderer } = await render();

    expect(shownText(renderer)).toContain('2 join requests');
    expect(shownText(renderer)).toContain('waiting for you');
  });

  test('one request reads "1 join request"; none shows no line', async () => {
    serve({ teams: [{ ...CAPTAINED, joinRequestCount: 1 }], requests: [] });
    const one = await render();
    expect(shownText(one.renderer)).toContain('1 join request');
    expect(shownText(one.renderer)).not.toContain('1 join requests');

    serve({ teams: [{ ...CAPTAINED, joinRequestCount: 0 }], requests: [] });
    const none = await render();
    expect(shownText(none.renderer)).not.toContain('waiting for you');
  });

  test('a member never sees the notice line', async () => {
    serve({ teams: [{ ...PLAYING, joinRequestCount: 3 }], requests: [] });
    const { renderer } = await render();

    expect(shownText(renderer)).not.toContain('waiting for you');
  });

  test('tapping a card opens Team detail; Create team opens the form', async () => {
    serve();
    const { renderer, navigation } = await render();

    await press(renderer, 'Open Dhanmondi Strikers');
    await press(renderer, 'Create team');

    expect(navigation.navigate).toHaveBeenCalledWith('TeamDetail', {
      teamId: 7,
    });
    expect(navigation.navigate).toHaveBeenCalledWith('CreateTeam');
  });
});

describe('Requests sent', () => {
  test('each request: the team, "Waiting for the captain", the message and Cancel', async () => {
    serve();
    const { renderer } = await render();
    const text = shownText(renderer);

    expect(text).toContain('Requests sent');
    expect(text).toContain('Uttara United');
    expect(text).toContain('Waiting for the captain');
    expect(text).toContain('“I play Thursdays”');
    expect(labels(renderer)).toContain('Cancel request to Uttara United');
  });

  test('Cancel deletes the request and reloads', async () => {
    serve();
    api.delete.mockResolvedValue({ data: {} });
    const { renderer } = await render();
    serve({ requests: [] });

    await press(renderer, 'Cancel request to Uttara United');

    expect(api.delete).toHaveBeenCalledWith('/teams/9/requests/me');
    expect(shownText(renderer)).not.toContain('Requests sent');
  });

  test('a request already handled (404) says so and reloads', async () => {
    serve();
    api.delete.mockRejectedValue(
      Object.assign(new Error('HTTP 404'), {
        response: { status: 404, data: { error: 'Join request not found' } },
      }),
    );
    const { renderer } = await render();

    await press(renderer, 'Cancel request to Uttara United');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Join request not found',
    );
    expect(api.get).toHaveBeenCalledTimes(4); // first load + reload, two calls each
  });

  test('tapping the request row opens Team detail', async () => {
    serve();
    const { renderer, navigation } = await render();

    await press(renderer, 'Open Uttara United');

    expect(navigation.navigate).toHaveBeenCalledWith('TeamDetail', {
      teamId: 9,
    });
  });

  test('no requests: no section', async () => {
    serve({ requests: [] });
    const { renderer } = await render();

    expect(shownText(renderer)).not.toContain('Requests sent');
  });
});

describe('Empty state', () => {
  test('no teams and no requests: the line, Create team and Find a team', async () => {
    serve({ teams: [], requests: [] });
    const { renderer, navigation } = await render();

    expect(shownText(renderer)).toContain("You're not in a team yet.");
    await press(renderer, 'Find a team');

    expect(navigation.navigate).toHaveBeenCalledWith('ExploreTab', {
      screen: 'Teams',
      initial: false,
    });
  });

  test('no teams but a request sent: only the request, no empty-state line', async () => {
    serve({ teams: [] });
    const { renderer } = await render();

    expect(shownText(renderer)).not.toContain("You're not in a team yet.");
    expect(shownText(renderer)).toContain('Requests sent');
  });
});

describe('Loading', () => {
  test('pull to refresh loads again', async () => {
    serve();
    const { renderer } = await render();

    await act(async () =>
      renderer.root.findByType(RefreshControl).props.onRefresh(),
    );
    await settle();

    expect(api.get).toHaveBeenCalledTimes(4);
  });

  test('a failed first load offers Try again', async () => {
    api.get.mockRejectedValue(new Error('Network Error'));
    const { renderer } = await render();
    expect(shownText(renderer)).toContain("Couldn't load your teams.");

    serve();
    await press(renderer, 'Try again');

    expect(shownText(renderer)).toContain('Dhanmondi Strikers');
  });
});
