/* eslint-env jest */
// Tests for Player detail (docs/features/explore.md, section e, "Player detail"): what a
// stranger, a teammate, the player themselves and a venue owner see; the "Invite to my
// team" card in each state, the invite request, "Invited"/"Joined" and "Something
// changed"; the teams opening Team detail; the 404 state. Rendered alone with a fake API
// and a fake navigation object.

import React from 'react';
import { Alert, Linking, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import PlayerDetailScreen, {
  GONE_MESSAGE,
  NO_TEAMS,
  OWN_PROFILE_LINE,
  TEAMMATE_PHONE_HINT,
  inviteReason,
} from '../src/screens/Player/PlayerDetailScreen';
import { PHONE_HINT } from '../src/screens/Player/PlayerProfileScreen';
import { Button } from '../src/components/ui';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

const ME = { id: 1, name: 'Rahim Uddin', role: 'PLAYER' };
const OWNER = { id: 50, name: 'Arena One', role: 'OWNER' };

// GET /players/19 as a stranger sees it: no phone, no height or weight (not set).
const STRANGER_VIEW = {
  id: 19,
  role: 'PLAYER',
  createdAt: '2026-11-20T10:00:00.000Z',
  name: 'Nayeem Islam',
  playerProfile: {
    name: 'Nayeem Islam',
    position: 'Goalkeeper',
    area: 'Mirpur 10',
  },
  teams: [
    {
      id: 7,
      name: 'Dhanmondi Strikers',
      area: 'Dhanmondi',
      memberCount: 11,
      maxMembers: 15,
      isCaptain: true,
    },
    {
      id: 8,
      name: 'Uttara United',
      area: null,
      memberCount: 4,
      maxMembers: 15,
      isCaptain: false,
    },
  ],
  inviteOptions: [],
};

// A teammate also gets the phone; this player filled in height and weight.
const TEAMMATE_VIEW = {
  ...STRANGER_VIEW,
  playerProfile: {
    ...STRANGER_VIEW.playerProfile,
    height: 178,
    weight: 72.5,
    phone: '01712345678',
  },
};

const option = (teamId, name, state, memberCount = 8) => ({
  teamId,
  name,
  memberCount,
  maxMembers: 15,
  state,
});
const ALL_STATES = [
  option(30, 'Banani Blasters', 'canInvite'),
  option(31, 'Farmgate FC', 'member'),
  option(32, 'Gulshan Giants', 'invited'),
  option(33, 'Mirpur Mavericks', 'requested'),
  option(34, 'Uttara Kings', 'full', 15),
];

function fakeNavigation(below = 'TeamDetail') {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    getState: () => ({
      index: 1,
      routes: [{ name: below }, { name: 'PlayerDetail' }],
    }),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') callback();
      return () => {};
    }),
  };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

async function render(reply, { user = ME, userId = 19, below } = {}) {
  if (reply instanceof Error) api.get.mockRejectedValue(reply);
  else api.get.mockResolvedValue({ data: reply });
  const navigation = fakeNavigation(below);
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user }}>
          <PlayerDetailScreen
            route={{ params: { userId, playerName: 'Nayeem Islam' } }}
            navigation={navigation}
          />
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
    node =>
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel,
  );
const labels = renderer =>
  tappables(renderer).map(n => n.props.accessibilityLabel);
const button = (renderer, label) =>
  tappables(renderer).find(n => n.props.accessibilityLabel === label);
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
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('Loading', () => {
  test('loads GET /players/:id; the name shows from the params while it loads', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const navigation = fakeNavigation();
    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <AuthContext.Provider value={{ user: ME }}>
            <PlayerDetailScreen
              route={{ params: { userId: 19, playerName: 'Nayeem Islam' } }}
              navigation={navigation}
            />
          </AuthContext.Provider>
        </ThemeProvider>,
      );
    });

    expect(api.get).toHaveBeenCalledWith('/players/19');
    expect(shownText(renderer)).toContain('Nayeem Islam');
    await act(async () => renderer.unmount());
  });

  test('the back link names the screen underneath, or says Back', async () => {
    const fromTeam = await render(STRANGER_VIEW);
    expect(button(fromTeam.renderer, 'Back')).toBeTruthy();
    expect(labels(fromTeam.renderer)).not.toContain('Back to Back');

    const fromExplore = await render(STRANGER_VIEW, { below: 'Explore' });
    expect(button(fromExplore.renderer, 'Back to Explore')).toBeTruthy();
  });

  test('a 404: "This player isn\'t available any more." and a Back button', async () => {
    const { renderer, navigation } = await render(
      httpError(404, 'Player not found'),
    );

    expect(shownText(renderer)).toContain(GONE_MESSAGE);
    expect(GONE_MESSAGE).toBe("This player isn't available any more.");
    // Two ways back, both reading "Back": the link at the top and the button.
    const ways = tappables(renderer).filter(
      n => n.props.accessibilityLabel === 'Back',
    );
    expect(ways).toHaveLength(2);
    for (const way of ways) await act(async () => way.props.onPress());
    expect(navigation.goBack).toHaveBeenCalledTimes(2);
  });

  test('another failure: "Couldn\'t load this player." with Try again', async () => {
    const { renderer } = await render(httpError(500, 'Boom'));
    expect(shownText(renderer)).toContain("Couldn't load this player.");

    api.get.mockResolvedValue({ data: STRANGER_VIEW });
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('Goalkeeper');
  });
});

describe('What each viewer sees', () => {
  test('a stranger: name, position, area and teams; no Details card, no phone', async () => {
    const { renderer } = await render(STRANGER_VIEW);
    const text = shownText(renderer);

    for (const shown of [
      'Nayeem Islam',
      'Goalkeeper',
      'Mirpur 10',
      'Teams',
      'Dhanmondi Strikers',
      '11 / 15 members',
      'Captain',
      'Uttara United',
      '4 / 15 members',
    ]) {
      expect(text).toContain(shown);
    }
    for (const hidden of [
      'Details',
      'Phone',
      'Height',
      'Weight',
      'Invite to my team',
      'Not added',
      OWN_PROFILE_LINE,
    ]) {
      expect(text).not.toContain(hidden);
    }
  });

  test('a teammate: Height, Weight and the Phone with its hint; tapping it calls', async () => {
    const { renderer } = await render(TEAMMATE_VIEW);
    const text = shownText(renderer);

    expect(text).toContain('Details');
    expect(text).toContain('178 cm');
    expect(text).toContain('72.5 kg');
    expect(text).toContain('01712345678');
    expect(text).toContain(TEAMMATE_PHONE_HINT);
    expect(TEAMMATE_PHONE_HINT).toBe(
      "You can see this because you're teammates.",
    );

    await press(renderer, 'Call Nayeem Islam');
    expect(Linking.openURL).toHaveBeenCalledWith('tel:01712345678');
  });

  test('only the rows with a value: a height alone shows just Height', async () => {
    const { renderer } = await render({
      ...STRANGER_VIEW,
      playerProfile: { ...STRANGER_VIEW.playerProfile, height: 170 },
    });
    const text = shownText(renderer);

    expect(text).toContain('170 cm');
    expect(text).not.toContain('Weight');
    expect(text).not.toContain('Phone');
  });

  test('no area: no area line', async () => {
    const { renderer } = await render({
      ...STRANGER_VIEW,
      playerProfile: { name: 'Nayeem Islam', position: 'Goalkeeper' },
    });
    expect(shownText(renderer)).not.toContain('Mirpur 10');
  });

  test('your own profile: the line saying so, your phone not tappable, no Invite card', async () => {
    const { renderer } = await render(
      {
        id: ME.id,
        role: 'PLAYER',
        name: ME.name,
        playerProfile: {
          name: ME.name,
          position: 'Forward',
          area: null,
          height: null,
          weight: null,
          phone: '01799999999',
        },
        teams: [],
      },
      { userId: ME.id },
    );
    const text = shownText(renderer);

    expect(text).toContain(OWN_PROFILE_LINE);
    expect(OWN_PROFILE_LINE).toBe(
      'This is how other players see you. Only your teammates see your phone.',
    );
    expect(text).toContain('01799999999');
    expect(text).toContain(PHONE_HINT);
    expect(text).not.toContain(TEAMMATE_PHONE_HINT);
    expect(text).not.toContain('Height');
    expect(labels(renderer)).not.toContain(`Call ${ME.name}`);
    expect(text).not.toContain('Invite to my team');
    expect(text).toContain(NO_TEAMS);
  });

  test('a venue owner: the profile and teams, no Invite card', async () => {
    const { inviteOptions, ...ownerView } = STRANGER_VIEW;
    const { renderer } = await render(ownerView, { user: OWNER });
    const text = shownText(renderer);

    expect(text).toContain('Dhanmondi Strikers');
    expect(text).not.toContain('Invite to my team');
    expect(text).not.toContain(OWN_PROFILE_LINE);
  });

  test('no teams: "Not in a team yet."', async () => {
    const { renderer } = await render({ ...STRANGER_VIEW, teams: [] });
    expect(shownText(renderer)).toContain('Not in a team yet.');
  });
});

describe('Teams', () => {
  test('a team opens Team detail, pushed on top', async () => {
    const { renderer, navigation } = await render(STRANGER_VIEW);

    await press(renderer, 'Open Uttara United');

    expect(navigation.push).toHaveBeenCalledWith('TeamDetail', {
      teamId: 8,
    });
  });
});

describe('Invite to my team (P24)', () => {
  test("the reasons, in the spec's words", () => {
    expect(ALL_STATES.map(inviteReason)).toEqual([
      null,
      'Already a member',
      'Already invited',
      'Asked to join',
      'Team is full (15/15)',
    ]);
  });

  test('one row per captained team: Invite only where it can be sent, the reason elsewhere', async () => {
    const { renderer } = await render({
      ...STRANGER_VIEW,
      inviteOptions: ALL_STATES,
    });
    const text = shownText(renderer);

    expect(text).toContain('Invite to my team');
    for (const shown of [
      'Banani Blasters',
      'Farmgate FC',
      'Already a member',
      'Gulshan Giants',
      'Already invited',
      'Mirpur Mavericks',
      'Asked to join',
      'Uttara Kings',
      'Team is full (15/15)',
      '15 / 15 members',
    ]) {
      expect(text).toContain(shown);
    }
    const inviteButtons = labels(renderer).filter(label =>
      label.startsWith('Invite to '),
    );
    expect(inviteButtons).toEqual(['Invite to Banani Blasters']);
  });

  test('a captain of no team (an empty list) sees no card', async () => {
    const { renderer } = await render({ ...STRANGER_VIEW, inviteOptions: [] });
    expect(shownText(renderer)).not.toContain('Invite to my team');
  });

  test('Invite sends the invite; the row then says "Invited" and stays', async () => {
    api.post.mockResolvedValue({ data: { id: 900 } });
    const { renderer } = await render({
      ...STRANGER_VIEW,
      inviteOptions: [ALL_STATES[0]],
    });

    const look = () => renderer.root.findByType(Button).props.variant;
    expect(look()).toBe('primary'); // lime until it's used
    await press(renderer, 'Invite to Banani Blasters');

    expect(api.post).toHaveBeenCalledWith('/teams/30/invite', { userId: 19 });
    const invited = button(renderer, 'Invited to Banani Blasters');
    expect(invited).toBeTruthy();
    expect(look()).toBe('secondary');
    expect(invited.props.disabled).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(1); // no reload
  });

  // The player had just asked to join, so the invite approved the request.
  const JOINED = { data: { message: 'Request approved', joined: true } };

  test('an invite that comes back as "Joined" reloads: the Teams card, the Invite card and the phone are up to date', async () => {
    api.post.mockResolvedValue(JOINED);
    const { renderer } = await render({
      ...STRANGER_VIEW,
      teams: [],
      inviteOptions: [ALL_STATES[0]],
    });
    expect(shownText(renderer)).toContain(NO_TEAMS);
    // What the backend answers once they are in the team (and so a teammate).
    api.get.mockResolvedValue({
      data: {
        ...TEAMMATE_VIEW,
        teams: [
          {
            id: 30,
            name: 'Banani Blasters',
            area: null,
            memberCount: 9,
            maxMembers: 15,
            isCaptain: false,
          },
        ],
        inviteOptions: [option(30, 'Banani Blasters', 'member', 9)],
      },
    });

    await press(renderer, 'Invite to Banani Blasters');

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith('/players/19');
    const text = shownText(renderer);
    expect(text).not.toContain(NO_TEAMS);
    expect(button(renderer, 'Open Banani Blasters')).toBeTruthy();
    expect(text).toContain('9 / 15 members');
    expect(text).toContain('Already a member');
    expect(text).toContain('01712345678');
    expect(
      labels(renderer).filter(label => /^(Invite|Joined) to /.test(label)),
    ).toEqual([]);
  });

  test('"Joined", but the reload fails: the row still says "Joined" and no error shows', async () => {
    api.post.mockResolvedValue(JOINED);
    const { renderer } = await render({
      ...STRANGER_VIEW,
      inviteOptions: [ALL_STATES[0]],
    });
    api.get.mockRejectedValue(httpError(500, 'Boom'));

    await press(renderer, 'Invite to Banani Blasters');

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(button(renderer, 'Joined to Banani Blasters').props.disabled).toBe(
      true,
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('a second tap while the invite runs sends nothing more; other Invite buttons wait', async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => (finish = resolve)));
    const { renderer } = await render({
      ...STRANGER_VIEW,
      inviteOptions: [ALL_STATES[0], option(35, 'Kafrul Kickers', 'canInvite')],
    });

    await act(async () => {
      button(renderer, 'Invite to Banani Blasters').props.onPress();
      button(renderer, 'Invite to Banani Blasters').props.onPress();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(button(renderer, 'Invite to Kafrul Kickers').props.disabled).toBe(
      true,
    );

    await act(async () => finish({ data: {} }));
    await settle();
    expect(button(renderer, 'Invite to Kafrul Kickers').props.disabled).toBe(
      false,
    );
  });

  test.each([400, 404, 409])(
    'a %i: "Something changed" with the message, then the card reloads',
    async code => {
      api.post.mockRejectedValue(httpError(code, 'This team is full.'));
      const { renderer } = await render({
        ...STRANGER_VIEW,
        inviteOptions: [ALL_STATES[0]],
      });
      api.get.mockResolvedValue({
        data: {
          ...STRANGER_VIEW,
          inviteOptions: [option(30, 'Banani Blasters', 'full', 15)],
        },
      });

      await press(renderer, 'Invite to Banani Blasters');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Something changed',
        'This team is full.',
      );
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(shownText(renderer)).toContain('Team is full (15/15)');
      expect(labels(renderer)).not.toContain('Invite to Banani Blasters');
    },
  );

  test('another error (no longer the captain) shows "Error" and does not reload', async () => {
    api.post.mockRejectedValue(
      httpError(403, 'Only the team captain can invite players.'),
    );
    const { renderer } = await render({
      ...STRANGER_VIEW,
      inviteOptions: [ALL_STATES[0]],
    });

    await press(renderer, 'Invite to Banani Blasters');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Only the team captain can invite players.',
    );
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  test('a fresh load shows the backend\'s state instead of "Invited"', async () => {
    api.post.mockResolvedValue({ data: {} });
    const navigation = fakeNavigation();
    const listeners = [];
    navigation.addListener = jest.fn((event, callback) => {
      if (event === 'focus') {
        listeners.push(callback);
        callback();
      }
      return () => {};
    });
    api.get.mockResolvedValue({
      data: { ...STRANGER_VIEW, inviteOptions: [ALL_STATES[0]] },
    });
    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <AuthContext.Provider value={{ user: ME }}>
            <PlayerDetailScreen
              route={{ params: { userId: 19, playerName: 'Nayeem Islam' } }}
              navigation={navigation}
            />
          </AuthContext.Provider>
        </ThemeProvider>,
      );
    });
    await settle();
    await press(renderer, 'Invite to Banani Blasters');

    api.get.mockResolvedValue({
      data: {
        ...STRANGER_VIEW,
        inviteOptions: [option(30, 'Banani Blasters', 'invited')],
      },
    });
    await act(async () => listeners.forEach(fn => fn()));
    await settle();

    expect(shownText(renderer)).toContain('Already invited');
    expect(labels(renderer)).not.toContain('Invited to Banani Blasters');
  });
});
