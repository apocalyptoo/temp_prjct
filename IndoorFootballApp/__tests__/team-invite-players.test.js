/* eslint-env jest */
// Tests for the Invite players screen (feature 1, docs/features/team-membership.md,
// section e): who is listed, the search, inviting without leaving, the full team and
// the empty states.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import InvitePlayersScreen from '../src/screens/Team/InvitePlayersScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

const row = (userId, status = 'accepted') => ({
  id: userId * 10,
  userId,
  status,
});
const player = (id, name, position) => ({
  id,
  name,
  playerProfile: { name, position },
});

// The team as its captain (id 1) gets it: a member (2), an invitee (3), a requester (4).
const TEAM = {
  id: 7,
  name: 'Dhanmondi Strikers',
  captainId: 1,
  memberCount: 2,
  maxMembers: 15,
  viewerState: 'captain',
  members: [row(1), row(2)],
  pendingInvites: [row(3, 'pending')],
  joinRequests: [row(4, 'pending')],
};

const PLAYERS = [
  player(1, 'Rahim Uddin', 'Forward'),
  player(2, 'Tanvir Ahmed', 'Goalkeeper'),
  player(3, 'Sakib Hasan', 'Defender'),
  player(4, 'Nayeem Islam', 'Midfielder'),
  player(5, 'Fahim Rahman', 'Defender'),
  player(6, 'Arif Chowdhury', 'Any'),
];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

function serve({ team = TEAM, players = PLAYERS } = {}) {
  api.get.mockImplementation(path =>
    path === '/players'
      ? Promise.resolve({ data: players })
      : Promise.resolve({ data: team }),
  );
}

async function render() {
  const navigation = {
    goBack: jest.fn(),
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
        <InvitePlayersScreen
          route={{ params: { teamId: 7, teamName: 'Dhanmondi Strikers' } }}
          navigation={navigation}
        />
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

const button = (renderer, label) =>
  renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  )[0];
const press = async (renderer, label) => {
  await act(async () => button(renderer, label).props.onPress());
  await settle();
};

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('Who is listed', () => {
  test('everyone but the captain, members, invitees and requesters, with positions', async () => {
    serve();
    const { renderer } = await render();
    const text = shownText(renderer);

    expect(api.get).toHaveBeenCalledWith('/teams/7');
    expect(api.get).toHaveBeenCalledWith('/players');
    expect(text).toContain('Invite players');
    expect(text).toContain('2 / 15 members');
    expect(text).toContain('Fahim Rahman');
    expect(text).toContain('Arif Chowdhury');
    expect(text).toContain('Any');
    for (const hidden of [
      'Rahim Uddin',
      'Tanvir Ahmed',
      'Sakib Hasan',
      'Nayeem Islam',
    ]) {
      expect(text).not.toContain(hidden);
    }
    expect(button(renderer, 'Invite Fahim Rahman')).toBeTruthy();
  });

  test('the search filters by name on the phone, ignoring case', async () => {
    serve();
    const { renderer } = await render();

    await act(async () =>
      renderer.root.findByType(TextInput).props.onChangeText('  faHIM '),
    );

    expect(shownText(renderer)).toContain('Fahim Rahman');
    expect(shownText(renderer)).not.toContain('Arif Chowdhury');

    await act(async () =>
      renderer.root.findByType(TextInput).props.onChangeText('zzz'),
    );
    expect(shownText(renderer)).toContain('No players match your search.');
  });

  test('nobody left to invite: "No players to invite right now."', async () => {
    serve({ players: PLAYERS.slice(0, 4) });
    const { renderer } = await render();

    expect(shownText(renderer)).toContain('No players to invite right now.');
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

describe('Inviting', () => {
  test('Invite sends the invite and the button turns into a disabled "Invited"; the screen stays', async () => {
    serve();
    api.post.mockResolvedValue({ status: 201, data: { id: 99 } });
    const { renderer, navigation } = await render();

    await press(renderer, 'Invite Fahim Rahman');

    expect(api.post).toHaveBeenCalledWith('/teams/7/invite', { userId: 5 });
    const invited = button(renderer, 'Invited: Fahim Rahman');
    expect(invited.props.disabled).toBe(true);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(
      false,
    );
  });

  test('an invite that approved a request that had just come in reads "Joined"', async () => {
    serve();
    api.post.mockResolvedValue({
      status: 200,
      data: { message: 'Request approved', joined: true },
    });
    const { renderer } = await render();

    await press(renderer, 'Invite Arif Chowdhury');

    expect(button(renderer, 'Joined: Arif Chowdhury').props.disabled).toBe(
      true,
    );
  });

  test('a 409 (the team filled up) says so and reloads into the full state', async () => {
    serve();
    api.post.mockRejectedValue(httpError(409, 'Team is full (15/15).'));
    const { renderer } = await render();
    serve({ team: { ...TEAM, memberCount: 15 } });

    await press(renderer, 'Invite Fahim Rahman');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Team is full (15/15).',
    );
    expect(shownText(renderer)).toContain('Team is full (15/15)');
  });

  test('a 400 (already invited) says so and reloads, which drops that player', async () => {
    serve();
    api.post.mockRejectedValue(
      httpError(400, 'Player is already invited or in the team.'),
    );
    const { renderer } = await render();
    serve({
      team: {
        ...TEAM,
        pendingInvites: [...TEAM.pendingInvites, row(5, 'pending')],
      },
    });

    await press(renderer, 'Invite Fahim Rahman');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Player is already invited or in the team.',
    );
    expect(shownText(renderer)).not.toContain('Fahim Rahman');
  });
});

describe('A full team', () => {
  test('"Team is full (15/15)" and every Invite button disabled', async () => {
    serve({ team: { ...TEAM, memberCount: 15 } });
    const { renderer } = await render();

    expect(shownText(renderer)).toContain('Team is full (15/15)');
    expect(shownText(renderer)).not.toContain('15 / 15 members');
    expect(button(renderer, 'Invite Fahim Rahman').props.disabled).toBe(true);
    expect(button(renderer, 'Invite Arif Chowdhury').props.disabled).toBe(true);
  });
});
