/* eslint-env jest */
// Tests for Invite players (docs/features/explore.md, section e, "Invite players"; P29):
// what it asks the backend (never the whole player list), the search and filters, the
// pages, inviting without leaving, the full team, and the empty states.

import React from 'react';
import { Alert, FlatList, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import InvitePlayersScreen, {
  NO_CANDIDATES,
} from '../src/screens/Team/InvitePlayersScreen';
import { SEARCH_DELAY_MS } from '../src/hooks/usePagedList';
import { Button, OptionGroup } from '../src/components/ui';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const flush = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
const wait = async ms => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const CANDIDATES = '/teams/7/invite-candidates';
const TEAM = {
  id: 7,
  name: 'Dhanmondi Strikers',
  captainId: 1,
  memberCount: 2,
  maxMembers: 15,
  viewerState: 'captain',
  members: [],
  pendingInvites: [],
  joinRequests: [],
};
const FULL_TEAM = { ...TEAM, memberCount: 15 };

const player = (id, name, position, area) => ({
  id,
  name,
  playerProfile: area ? { name, position, area } : { name, position },
});
const FAHIM = player(5, 'Fahim Rahman', 'Defender', 'Mirpur 10');
const ARIF = player(6, 'Arif Chowdhury', 'Any');

// A stand-in for the backend: everyone who could be invited, in order. An invited player
// leaves the list, as on the real backend, so the pages after them shift.
let server;
function listPage({ page = 1, search, area, position }) {
  const matches = server.players.filter(
    p =>
      (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
      (!area || (p.playerProfile.area ?? '').includes(area)) &&
      (!position || p.playerProfile.position === position),
  );
  const start = (page - 1) * 20;
  return {
    data: {
      items: matches.slice(start, start + 20),
      page,
      limit: 20,
      total: matches.length,
    },
  };
}
const asked = () =>
  api.get.mock.calls
    .filter(([path]) => path === CANDIDATES)
    .map(([, options]) => options.params);

async function render({ players = [FAHIM, ARIF], team = TEAM } = {}) {
  server = { players, team };
  const listeners = [];
  const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') {
        listeners.push(callback);
        callback();
      }
      return () => {};
    }),
  };
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <InvitePlayersScreen
          route={{ params: { teamId: 7, teamName: 'Dhanmondi Strikers' } }}
          navigation={navigation}
        />
      </ThemeProvider>,
    );
  });
  await flush();
  const focus = async () => {
    await act(async () => listeners.forEach(fn => fn()));
    await flush();
  };
  return { renderer, navigation, focus };
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');
const buttons = (renderer, label) =>
  renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  );
const button = (renderer, label) => buttons(renderer, label)[0];
const press = async (renderer, label) => {
  await act(async () => button(renderer, label).props.onPress());
  await flush();
};
// Every row's button, in order ("Invite Fahim Rahman", "Invited: …").
const rowButtons = renderer =>
  renderer.root
    .findAll(
      n =>
        /^(Invite |Invited: |Joined: )/.test(n.props.accessibilityLabel) &&
        typeof n.props.style === 'function' &&
        typeof n.props.onPress === 'function',
    )
    .map(n => n.props.accessibilityLabel);
const input = (renderer, label) =>
  renderer.root.find(
    n => n.type === TextInput && n.props.accessibilityLabel === label,
  );
const type = (renderer, label, text) =>
  act(async () => input(renderer, label).props.onChangeText(text));
const list = renderer => renderer.root.findByType(FlatList);
const scrollToEnd = async renderer => {
  await act(async () => list(renderer).props.onEndReached());
  await flush();
};
// The ids in the list, drawn or not (a FlatList draws only the rows near the screen).
const ids = renderer => list(renderer).props.data.map(p => p.id);
const pressRow = async (renderer, id) => {
  const { renderItem, data } = list(renderer).props;
  const { actions } = renderItem({ item: data.find(p => p.id === id) }).props;
  await act(async () => actions.props.onPress());
  await flush();
};

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.get.mockImplementation(async (path, options) =>
    path === CANDIDATES ? listPage(options.params) : { data: server.team },
  );
  api.post.mockImplementation(async (path, { userId }) => {
    server.players = server.players.filter(p => p.id !== userId);
    return { status: 201, data: { id: 99 } };
  });
});
afterEach(() => jest.useRealTimers());

describe('The list', () => {
  test('comes from invite-candidates, a page at a time; the player list is never downloaded', async () => {
    const { renderer } = await render();
    expect(asked()).toEqual([{ page: 1 }]);
    expect(new Set(api.get.mock.calls.map(([path]) => path))).toEqual(
      new Set(['/teams/7', CANDIDATES]),
    );
    const text = shownText(renderer);
    for (const shown of [
      'Dhanmondi Strikers', // the back link
      'Invite players',
      '2 / 15 members',
      'Fahim Rahman',
      'Defender · Mirpur 10',
      'Arif Chowdhury',
      'Any',
    ]) {
      expect(text.split(' | ')).toContain(shown);
    }
    expect(rowButtons(renderer)).toEqual([
      'Invite Fahim Rahman',
      'Invite Arif Chowdhury',
    ]);
  });

  test('name, area and position are sent to the backend together', async () => {
    const { renderer } = await render();
    await type(renderer, 'Search players', ' fa ');
    await type(renderer, 'Area', 'Mirpur   10');
    await wait(SEARCH_DELAY_MS - 1);
    expect(asked()).toHaveLength(1);
    await wait(1);
    await press(renderer, 'Defender');
    expect(asked().slice(1)).toEqual([
      { search: 'fa', area: 'Mirpur 10', page: 1 },
      { search: 'fa', area: 'Mirpur 10', position: 'Defender', page: 1 },
    ]);
    expect(ids(renderer)).toEqual([5]);
  });

  test('no match: Clear search brings everyone back', async () => {
    const { renderer } = await render();
    await type(renderer, 'Search players', 'zzz');
    await wait(SEARCH_DELAY_MS);
    expect(shownText(renderer)).toContain('No players match your search.');
    expect(shownText(renderer)).not.toContain(NO_CANDIDATES);
    await press(renderer, 'Clear search');
    expect(ids(renderer)).toEqual([5, 6]);
  });

  test('nobody left to invite: "No players to invite right now."', async () => {
    const { renderer } = await render({ players: [] });
    expect(NO_CANDIDATES).toBe('No players to invite right now.');
    expect(shownText(renderer)).toContain(NO_CANDIDATES);
    expect(buttons(renderer, 'Clear search')).toHaveLength(0);
  });

  test('the list failing: "Couldn\'t load players." with Try again; the team failing: its own', async () => {
    server = { players: [FAHIM], team: TEAM };
    const works = api.get.getMockImplementation();
    api.get.mockImplementation((path, options) =>
      path === CANDIDATES
        ? Promise.reject(new Error('offline'))
        : works(path, options),
    );
    const first = await render();
    expect(shownText(first.renderer)).toContain("Couldn't load players.");
    expect(shownText(first.renderer)).toContain('2 / 15 members');
    api.get.mockImplementation(works);
    await press(first.renderer, 'Try again');
    expect(ids(first.renderer)).toEqual([5, 6]);

    api.get.mockRejectedValue(new Error('offline'));
    const second = await render();
    expect(shownText(second.renderer)).toContain("Couldn't load this team.");
    api.get.mockImplementation(works);
    await press(second.renderer, 'Try again');
    expect(ids(second.renderer)).toEqual([5, 6]);
  });

  test('a row opens Player detail; its button does not', async () => {
    const { renderer, navigation } = await render();
    await press(renderer, 'Fahim Rahman, Defender · Mirpur 10');
    expect(navigation.push.mock.calls).toEqual([
      ['PlayerDetail', { userId: 5, playerName: 'Fahim Rahman' }],
    ]);
    const row = button(renderer, 'Fahim Rahman, Defender · Mirpur 10');
    expect(
      row.findAll(n => n.props.accessibilityLabel === 'Invite Fahim Rahman'),
    ).toHaveLength(0);
    await press(renderer, 'Invite Fahim Rahman');
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  test('coming back reloads the team, not the list: the search and rows stay', async () => {
    const { renderer, focus } = await render();
    await type(renderer, 'Search players', 'fahim');
    await wait(SEARCH_DELAY_MS);
    server.team = { ...TEAM, memberCount: 3 };
    await focus();
    expect(asked()).toHaveLength(2);
    expect(input(renderer, 'Search players').props.value).toBe('fahim');
    expect(ids(renderer)).toEqual([5]);
    expect(shownText(renderer)).toContain('3 / 15 members');
  });
});

describe('Inviting', () => {
  test('the button turns into a disabled "Invited"; the row and the screen stay', async () => {
    const { renderer, navigation } = await render();
    const looks = () =>
      renderer.root.findAllByType(Button).map(b => b.props.variant);
    expect(looks()).toEqual(['primary', 'primary']); // lime until it's used
    await press(renderer, 'Invite Fahim Rahman');
    expect(looks()).toEqual(['secondary', 'primary']);

    expect(api.post.mock.calls).toEqual([['/teams/7/invite', { userId: 5 }]]);
    expect(button(renderer, 'Invited: Fahim Rahman').props.disabled).toBe(true);
    expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(
      false,
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(asked()).toHaveLength(1);
  });

  test('two players in a row', async () => {
    const { renderer } = await render();
    await press(renderer, 'Invite Fahim Rahman');
    await press(renderer, 'Invite Arif Chowdhury');
    expect(rowButtons(renderer)).toEqual([
      'Invited: Fahim Rahman',
      'Invited: Arif Chowdhury',
    ]);
  });

  test('one at a time: a double tap sends once, and the other buttons wait', async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const { renderer } = await render();
    await act(async () => {
      button(renderer, 'Invite Fahim Rahman').props.onPress();
      button(renderer, 'Invite Fahim Rahman').props.onPress();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(true);
    await act(async () => finish({ status: 201, data: {} }));
    await flush();
    expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(
      false,
    );
  });

  test('"Joined": the row says so and the member count reloads, the list does not', async () => {
    api.post.mockImplementation(async () => {
      server.team = { ...TEAM, memberCount: 3 };
      return {
        status: 200,
        data: { message: 'Request approved', joined: true },
      };
    });
    const { renderer } = await render();
    await press(renderer, 'Invite Arif Chowdhury');
    expect(button(renderer, 'Joined: Arif Chowdhury').props.disabled).toBe(
      true,
    );
    expect(shownText(renderer)).toContain('3 / 15 members');
    expect(asked()).toHaveLength(1);
  });

  test('"Joined" filling the team disables every Invite at once', async () => {
    api.post.mockImplementation(async () => {
      server.team = FULL_TEAM;
      return { status: 200, data: { joined: true } };
    });
    const { renderer } = await render({ team: { ...TEAM, memberCount: 14 } });
    await press(renderer, 'Invite Arif Chowdhury');
    expect(shownText(renderer)).toContain('Team is full (15/15)');
    expect(button(renderer, 'Invite Fahim Rahman').props.disabled).toBe(true);
  });

  test('a plain invite does not reload the team', async () => {
    const { renderer } = await render();
    const before = api.get.mock.calls.length;
    await press(renderer, 'Invite Fahim Rahman');
    expect(api.get).toHaveBeenCalledTimes(before);
  });

  test('a fresh load leaves the invited player out, and a player who declined can be invited again', async () => {
    const { renderer } = await render();
    await press(renderer, 'Invite Fahim Rahman');
    await act(async () =>
      list(renderer).props.refreshControl.props.onRefresh(),
    );
    await flush();
    expect(rowButtons(renderer)).toEqual(['Invite Arif Chowdhury']);

    server.players = [FAHIM, ARIF];
    await act(async () =>
      list(renderer).props.refreshControl.props.onRefresh(),
    );
    await flush();
    expect(button(renderer, 'Invite Fahim Rahman').props.disabled).toBe(false);
  });

  test.each([
    [400, 'Player is already invited or in the team.'],
    [404, 'Player not found'],
    [409, 'Team is full (15/15).'],
  ])(
    'a %i: "Something changed", then the list and the team reload',
    async (code, message) => {
      const { renderer } = await render();
      api.post.mockRejectedValue(httpError(code, message));
      server.players = [ARIF];
      server.team = FULL_TEAM;
      await press(renderer, 'Invite Fahim Rahman');
      expect(Alert.alert).toHaveBeenCalledWith('Something changed', message);
      expect(asked()).toEqual([{ page: 1 }, { page: 1 }]);
      expect(ids(renderer)).toEqual([6]);
      expect(shownText(renderer)).toContain('Team is full (15/15)');
      expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(
        true,
      );
    },
  );

  test('another error is a plain alert, and nothing reloads', async () => {
    const { renderer } = await render();
    api.post.mockRejectedValue(
      httpError(403, 'Only the team captain can invite players.'),
    );
    await press(renderer, 'Invite Fahim Rahman');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Only the team captain can invite players.',
    );
    expect(asked()).toHaveLength(1);
    expect(button(renderer, 'Invite Fahim Rahman').props.disabled).toBe(false);
  });
});

describe('Pages', () => {
  const many = count =>
    Array.from({ length: count }, (_, i) =>
      player(100 + i, `Player ${100 + i}`, 'Any'),
    );
  const allIds = count => many(count).map(p => p.id);

  test('scrolling loads the next page, until everyone is there', async () => {
    const { renderer } = await render({ players: many(45) });
    await scrollToEnd(renderer);
    await scrollToEnd(renderer);
    await scrollToEnd(renderer);
    expect(asked().map(params => params.page)).toEqual([1, 2, 3]);
    expect(ids(renderer)).toEqual(allIds(45));
  });

  test('inviting between two pages misses nobody, and the invited rows stay', async () => {
    const { renderer } = await render({ players: many(45) });
    await pressRow(renderer, 103);
    await pressRow(renderer, 107);
    await scrollToEnd(renderer);
    await pressRow(renderer, 115);
    for (let i = 0; i < 4; i += 1) await scrollToEnd(renderer);
    expect(ids(renderer)).toEqual(allIds(45));
    expect(
      list(renderer)
        .props.data.filter(p => p.inviteLabel)
        .map(p => p.id),
    ).toEqual([103, 107, 115]);
  });

  test('also after inviting a whole page and more', async () => {
    const { renderer } = await render({ players: many(60) });
    await scrollToEnd(renderer);
    for (let id = 100; id < 125; id += 1) await pressRow(renderer, id);
    for (let i = 0; i < 6; i += 1) await scrollToEnd(renderer);
    expect(ids(renderer)).toEqual(allIds(60));
  });

  test('also when a player is invited while the next page is on its way', async () => {
    const { renderer } = await render({ players: many(45) });
    const works = api.get.getMockImplementation();
    let finish;
    api.get.mockImplementationOnce(
      () => new Promise(resolve => (finish = resolve)),
    );
    await act(async () => list(renderer).props.onEndReached());
    const pageBefore = listPage({ page: 2 }); // read before the invite
    await pressRow(renderer, 100);
    await act(async () => finish(pageBefore));
    await flush();
    api.get.mockImplementation(works);
    for (let i = 0; i < 3; i += 1) await scrollToEnd(renderer);
    expect(ids(renderer)).toEqual(allIds(45));
    expect(list(renderer).props.data[0].inviteLabel).toBe('Invited');
  });
});

describe('A full team', () => {
  test('"Team is full (15/15)" and every Invite disabled; the search and rows still work', async () => {
    const { renderer, navigation } = await render({ team: FULL_TEAM });
    expect(shownText(renderer)).toContain('Team is full (15/15)');
    expect(shownText(renderer)).not.toContain('15 / 15 members');
    for (const name of ['Fahim Rahman', 'Arif Chowdhury']) {
      expect(button(renderer, `Invite ${name}`).props.disabled).toBe(true);
    }
    expect(renderer.root.findByType(OptionGroup).props.value).toBe('');
    await press(renderer, 'Arif Chowdhury, Any');
    expect(navigation.push).toHaveBeenCalled();
  });
});
