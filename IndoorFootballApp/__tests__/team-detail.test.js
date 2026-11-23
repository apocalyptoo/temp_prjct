/* eslint-env jest */
// Tests for the Team detail screen (feature 1, docs/features/team-membership.md,
// sections c and e): what each kind of viewer sees, the buttons that are disabled when
// the team is full, and what the actions send. Rendered alone with a fake API and a fake
// navigation object.

import React from 'react';
import { Alert, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import TeamDetailScreen from '../src/screens/Team/TeamDetailScreen';
import { personMeta } from '../src/screens/Team/teamCommon';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

const PLAYER = { id: 1, name: 'Rahim Uddin', role: 'PLAYER' };
const OWNER = { id: 50, name: 'Arena One', role: 'OWNER' };

// area: left out when not given, as the backend leaves out an area that isn't set.
const person = (userId, name, position, area) => ({
  id: userId * 10,
  userId,
  status: 'accepted',
  createdAt: '2026-11-20T10:00:00.000Z',
  user: {
    id: userId,
    name,
    playerProfile: area ? { name, position, area } : { name, position },
  },
});

// The team as GET /teams/:teamId sends it to the captain (Rahim, id 1).
const CAPTAIN_VIEW = {
  id: 7,
  name: 'Dhanmondi Strikers',
  description: 'Weekend 5-a-side crew.',
  area: 'Dhanmondi',
  captainId: 1,
  memberCount: 2,
  maxMembers: 15,
  viewerState: 'captain',
  members: [
    person(1, 'Rahim Uddin', 'Forward'),
    person(2, 'Tanvir Ahmed', 'Goalkeeper', 'Mirpur 10'),
  ],
  joinRequests: [
    {
      ...person(3, 'Nayeem Islam', 'Midfielder', 'Uttara'),
      status: 'pending',
      message: 'I play Thursdays',
    },
  ],
  pendingInvites: [
    { ...person(4, 'Sakib Hasan', 'Defender', 'Banani'), status: 'pending' },
  ],
};

// The same team as anyone else sees it (no requests or invites).
const viewAs = (viewerState, extra = {}) => {
  // joinRequests and pendingInvites are left out on purpose, as the backend does.
  const { joinRequests, pendingInvites, ...rest } = CAPTAIN_VIEW;
  return { ...rest, viewerState, ...extra };
};

// Fifteen accepted members.
const FULL = {
  memberCount: 15,
  members: Array.from({ length: 15 }, (_, i) =>
    person(i + 1, `Player ${i + 1}`, 'Any'),
  ),
};

function fakeNavigation(below = 'MyTeams') {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    getState: () => ({
      index: 1,
      routes: [{ name: below }, { name: 'TeamDetail' }],
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

async function render(team, { user = PLAYER, below } = {}) {
  api.get.mockResolvedValue({ data: team });
  const navigation = fakeNavigation(below);
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user }}>
          <TeamDetailScreen
            route={{ params: { teamId: 7 } }}
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

// Buttons and other tappable things, by their accessibility label.
const tappables = renderer =>
  renderer.root.findAll(
    node =>
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel,
  );
const labels = renderer =>
  tappables(renderer).map(n => n.props.accessibilityLabel);
// The last match: a dialog renders after the screen, and its confirm button can share
// the label of the button that opened it ("Leave team", "Delete team").
const button = (renderer, label) =>
  tappables(renderer)
    .filter(n => n.props.accessibilityLabel === label)
    .pop();
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

describe('Loading', () => {
  test('loads the team by id; the back link names the screen underneath', async () => {
    const { renderer } = await render(CAPTAIN_VIEW);
    expect(api.get).toHaveBeenCalledWith('/teams/7');
    expect(button(renderer, 'Back to My Teams')).toBeTruthy();

    const fromExplore = await render(CAPTAIN_VIEW, { below: 'Teams' });
    expect(button(fromExplore.renderer, 'Back to All Teams')).toBeTruthy();
  });

  test('the team is gone: "This team no longer exists.", then back', async () => {
    api.get.mockRejectedValue(httpError(404, 'Team not found'));
    const navigation = fakeNavigation();
    await act(async () => {
      ReactTestRenderer.create(
        <ThemeProvider>
          <AuthContext.Provider value={{ user: PLAYER }}>
            <TeamDetailScreen
              route={{ params: { teamId: 7 } }}
              navigation={navigation}
            />
          </AuthContext.Provider>
        </ThemeProvider>,
      );
    });
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Team not found',
      'This team no longer exists.',
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('What each viewer sees', () => {
  test('the captain: pills, Invite and Transfer, join requests with messages, invites, members', async () => {
    const { renderer } = await render(CAPTAIN_VIEW);
    const text = shownText(renderer);

    for (const shown of [
      'Captain',
      '2 / 15 members',
      'Dhanmondi Strikers',
      'Weekend 5-a-side crew.',
      'Join requests',
      'Nayeem Islam',
      '“I play Thursdays”',
      'Invited',
      'Sakib Hasan',
      'Members',
      'Tanvir Ahmed',
      'Goalkeeper',
    ]) {
      expect(text).toContain(shown);
    }
    expect(labels(renderer)).toEqual(
      expect.arrayContaining([
        'Invite players',
        'Transfer captaincy',
        'Approve Nayeem Islam',
      ]),
    );
    expect(labels(renderer)).not.toContain('Request to join');
    expect(labels(renderer)).toContain('Edit team');
  });

  test('the captain of a full team: Invite players is disabled with "Team is full (15/15)"', async () => {
    const { renderer } = await render({ ...CAPTAIN_VIEW, ...FULL });

    const invite = button(renderer, 'Team is full (15/15)');
    expect(invite.props.disabled).toBe(true);
    expect(labels(renderer)).not.toContain('Invite players');
  });

  test('the captain alone: no Transfer captaincy', async () => {
    const { renderer } = await render({
      ...CAPTAIN_VIEW,
      memberCount: 1,
      members: [CAPTAIN_VIEW.members[0]],
    });

    expect(labels(renderer)).toContain('Invite players');
    expect(labels(renderer)).not.toContain('Transfer captaincy');
  });

  test('an accepted member: "Player", the members, no captain or join buttons', async () => {
    const { renderer } = await render(viewAs('member'), {
      user: { ...PLAYER, id: 2 },
    });
    const text = shownText(renderer);

    expect(text).toContain('Player');
    expect(text).toContain('Tanvir Ahmed');
    expect(text).not.toContain('Join requests');
    for (const label of [
      'Invite players',
      'Transfer captaincy',
      'Request to join',
      'Accept invite',
    ]) {
      expect(labels(renderer)).not.toContain(label);
    }
  });

  test('an invited player: who invited them, Accept invite and Decline', async () => {
    const { renderer } = await render(viewAs('invited'), {
      user: { ...PLAYER, id: 4 },
    });

    expect(shownText(renderer)).toContain('Rahim Uddin invited you');
    expect(shownText(renderer)).toContain('Invited');
    expect(labels(renderer)).toEqual(
      expect.arrayContaining(['Accept invite', 'Decline']),
    );
  });

  test('an invited player, team full: Accept is disabled with "Team is full (15/15)"', async () => {
    const { renderer } = await render(viewAs('invited', FULL), {
      user: { ...PLAYER, id: 40 },
    });

    expect(button(renderer, 'Team is full (15/15)').props.disabled).toBe(true);
    expect(labels(renderer)).not.toContain('Accept invite');
    expect(labels(renderer)).toContain('Decline');
  });

  test('a player with a pending request: "Request sent", their message and Cancel request', async () => {
    const { renderer } = await render(
      viewAs('requested', {
        myRequest: { createdAt: 'x', message: 'Hello captain' },
      }),
      { user: { ...PLAYER, id: 3 } },
    );
    const text = shownText(renderer);

    expect(text).toContain('Request sent');
    expect(text).toContain('Your request');
    expect(text).toContain('Waiting for the captain');
    expect(text).toContain('“Hello captain”');
    expect(labels(renderer)).toContain('Cancel request');
  });

  test('any other player: Request to join, which opens the Request to join screen', async () => {
    const { renderer, navigation } = await render(viewAs('none'), {
      user: { ...PLAYER, id: 9 },
    });

    await press(renderer, 'Request to join');

    expect(navigation.navigate).toHaveBeenCalledWith('RequestToJoin', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
    });
  });

  test('any other player, team full: Request to join is disabled with "Team is full (15/15)"', async () => {
    const { renderer } = await render(viewAs('none', FULL), {
      user: { ...PLAYER, id: 99 },
    });

    expect(button(renderer, 'Team is full (15/15)').props.disabled).toBe(true);
    expect(labels(renderer)).not.toContain('Request to join');
  });

  test('a venue owner: read-only, no buttons but the back link', async () => {
    const { renderer } = await render(viewAs('none'), {
      user: OWNER,
      below: 'Teams',
    });

    expect(shownText(renderer)).toContain('Tanvir Ahmed');
    expect(labels(renderer)).toEqual(['Back to All Teams']);
  });
});

describe('The team area (explore spec, section e)', () => {
  test('shown under the name, for every viewer', async () => {
    for (const [team, user] of [
      [CAPTAIN_VIEW, PLAYER],
      [viewAs('member'), { ...PLAYER, id: 2 }],
      [viewAs('none'), { ...PLAYER, id: 9 }],
      [viewAs('none'), OWNER],
    ]) {
      const { renderer } = await render(team, { user });
      const text = shownText(renderer);
      expect(text).toContain('Dhanmondi');
      expect(text).not.toContain('No area yet.');
      expect(labels(renderer)).not.toContain('Add area');
    }
  });

  test('the captain of a team without an area: "No area yet." and Add area, which opens Edit team', async () => {
    const { renderer, navigation } = await render({
      ...CAPTAIN_VIEW,
      area: null,
    });

    expect(shownText(renderer)).toContain('No area yet.');
    await press(renderer, 'Add area');

    expect(navigation.navigate).toHaveBeenCalledWith('EditTeam', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
      description: 'Weekend 5-a-side crew.',
      area: null,
    });
  });

  test('anyone else, team without an area: nothing about the area', async () => {
    for (const [team, user] of [
      [viewAs('member', { area: null }), { ...PLAYER, id: 2 }],
      [viewAs('none', { area: null }), { ...PLAYER, id: 9 }],
      [viewAs('none', { area: null }), OWNER],
    ]) {
      const { renderer } = await render(team, { user });
      expect(shownText(renderer)).not.toContain('No area yet.');
      expect(labels(renderer)).not.toContain('Add area');
    }
  });
});

describe('Person rows: "Position · Area" (personMeta)', () => {
  test('personMeta joins the position and the area, or gives the position alone', () => {
    expect(personMeta(person(2, 'T', 'Goalkeeper', 'Mirpur 10'))).toBe(
      'Goalkeeper · Mirpur 10',
    );
    expect(personMeta(person(1, 'R', 'Forward'))).toBe('Forward');
    expect(personMeta({ user: { name: 'Gone' } })).toBe('');
    expect(personMeta(undefined)).toBe('');
  });

  test('Members, Join requests and Invited rows show it', async () => {
    const { renderer } = await render(CAPTAIN_VIEW);
    const text = shownText(renderer);

    expect(text).toContain('Forward'); // the captain, no area
    expect(text).not.toContain('Forward · ');
    expect(text).toContain('Goalkeeper · Mirpur 10'); // a member
    expect(text).toContain('Midfielder · Uttara'); // a join request
    expect(text).toContain('Defender · Banani'); // an invite
    // The Invited card's title says "Invited"; its rows no longer repeat it.
    expect(text.split(' | ').filter(t => t === 'Invited')).toHaveLength(1);
  });

  test('members see the rows the same way', async () => {
    const { renderer } = await render(viewAs('member'), {
      user: { ...PLAYER, id: 2 },
    });
    expect(shownText(renderer)).toContain('Goalkeeper · Mirpur 10');
  });
});

describe('Actions', () => {
  test('Edit team opens the form with the current name, description and area', async () => {
    const { renderer, navigation } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Edit team');

    expect(navigation.navigate).toHaveBeenCalledWith('EditTeam', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
      description: 'Weekend 5-a-side crew.',
      area: 'Dhanmondi',
    });
  });

  test('Invite players and Transfer captaincy open their screens', async () => {
    const { renderer, navigation } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Invite players');
    await press(renderer, 'Transfer captaincy');

    expect(navigation.navigate).toHaveBeenCalledWith('InvitePlayers', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
    });
    expect(navigation.navigate).toHaveBeenCalledWith('TransferCaptaincy', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
    });
  });

  test('Approve sends the approval, then reloads the team', async () => {
    api.post.mockResolvedValue({ data: {} });
    const { renderer } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Approve Nayeem Islam');

    expect(api.post).toHaveBeenCalledWith('/teams/7/requests/3/approve');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('Accept invite and Decline call the invite routes', async () => {
    api.post.mockResolvedValue({ data: {} });
    const { renderer } = await render(viewAs('invited'), {
      user: { ...PLAYER, id: 4 },
    });

    await press(renderer, 'Accept invite');
    expect(api.post).toHaveBeenCalledWith('/teams/7/accept');

    await press(renderer, 'Decline');
    expect(api.post).toHaveBeenCalledWith('/teams/7/reject');
  });

  test('Cancel request deletes the request', async () => {
    api.delete.mockResolvedValue({ data: {} });
    const { renderer } = await render(
      viewAs('requested', { myRequest: { createdAt: 'x', message: null } }),
      { user: { ...PLAYER, id: 3 } },
    );

    await press(renderer, 'Cancel request');

    expect(api.delete).toHaveBeenCalledWith('/teams/7/requests/me');
  });

  test('a 409 (the team filled up) shows the message and reloads', async () => {
    api.post.mockRejectedValue(httpError(409, 'Team is full (15/15).'));
    const { renderer } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Approve Nayeem Islam');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Team is full (15/15).',
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('a 404 (the request was cancelled) shows the message and reloads', async () => {
    api.post.mockRejectedValue(httpError(404, 'Join request not found'));
    const { renderer } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Approve Nayeem Islam');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Join request not found',
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('another error shows "Error" and does not reload', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    const { renderer } = await render(viewAs('invited'), {
      user: { ...PLAYER, id: 4 },
    });

    await press(renderer, 'Accept invite');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Something went wrong. Please try again.',
    );
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('Confirmation dialogs (exact wording, then the request)', () => {
  // Opens the dialog with `opener`, checks its words and buttons, confirms, and
  // returns what happened.
  async function confirmDialog(team, opener, expected, options) {
    const { renderer, navigation } = await render(team, options);
    await press(renderer, opener);
    const text = shownText(renderer);
    expect(text).toContain(expected.title);
    expect(text).toContain(expected.message);
    expect(labels(renderer)).toEqual(
      expect.arrayContaining([expected.confirm, expected.cancel ?? 'Cancel']),
    );
    await press(renderer, expected.confirm);
    return { renderer, navigation };
  }

  beforeEach(() => {
    api.post.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
  });

  test('a member leaves: "Leave Dhanmondi Strikers?", then back', async () => {
    const { navigation } = await confirmDialog(
      viewAs('member'),
      'Leave team',
      {
        title: 'Leave Dhanmondi Strikers?',
        message:
          "You'll need a new invite or an approved request to join again.",
        confirm: 'Leave team',
      },
      { user: { ...PLAYER, id: 2 } },
    );

    expect(api.post).toHaveBeenCalledWith('/teams/7/leave');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('the captain with members: "Transfer captaincy first" opens Transfer captaincy, sends nothing', async () => {
    const { navigation } = await confirmDialog(CAPTAIN_VIEW, 'Leave team', {
      title: 'Transfer captaincy first',
      message:
        "You're the captain of Dhanmondi Strikers. Make another member captain, then you can leave.",
      confirm: 'Transfer captaincy',
      cancel: 'Not now',
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('TransferCaptaincy', {
      teamId: 7,
      teamName: 'Dhanmondi Strikers',
    });
  });

  test('the captain alone: "Leave and delete Dhanmondi Strikers?", then back', async () => {
    const alone = {
      ...CAPTAIN_VIEW,
      memberCount: 1,
      members: [CAPTAIN_VIEW.members[0]],
    };
    const { navigation } = await confirmDialog(alone, 'Leave team', {
      title: 'Leave and delete Dhanmondi Strikers?',
      message:
        "You're the only member, so leaving deletes the team and cancels its pending invites and requests. This can't be undone.",
      confirm: 'Leave and delete',
    });

    expect(api.post).toHaveBeenCalledWith('/teams/7/leave');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('remove a member, then reload', async () => {
    await confirmDialog(CAPTAIN_VIEW, 'Remove Tanvir Ahmed', {
      title: 'Remove Tanvir Ahmed from Dhanmondi Strikers?',
      message: "They'll no longer be a member of this team.",
      confirm: 'Remove',
    });

    expect(api.delete).toHaveBeenCalledWith('/teams/7/members/2');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('delete the team, then back', async () => {
    const { navigation } = await confirmDialog(CAPTAIN_VIEW, 'Delete team', {
      title: 'Delete Dhanmondi Strikers?',
      message:
        "This deletes the team for all its members and cancels its pending invites and requests. This can't be undone.",
      confirm: 'Delete team',
    });

    expect(api.delete).toHaveBeenCalledWith('/teams/7');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('decline a join request, then reload', async () => {
    await confirmDialog(CAPTAIN_VIEW, 'Decline Nayeem Islam', {
      title: "Decline Nayeem Islam's request?",
      message: 'They can ask to join again later.',
      confirm: 'Decline',
    });

    expect(api.post).toHaveBeenCalledWith('/teams/7/requests/3/reject');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('cancel an invite ("Keep invite" to back out), then reload', async () => {
    await confirmDialog(CAPTAIN_VIEW, 'Cancel invite to Sakib Hasan', {
      title: 'Cancel the invite to Sakib Hasan?',
      message: "They won't be able to accept it any more.",
      confirm: 'Cancel invite',
      cancel: 'Keep invite',
    });

    expect(api.delete).toHaveBeenCalledWith('/teams/7/invites/4');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('backing out of a dialog sends nothing', async () => {
    const { renderer } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Cancel invite to Sakib Hasan');
    await press(renderer, 'Keep invite');
    await press(renderer, 'Delete team');
    await press(renderer, 'Cancel');

    expect(shownText(renderer)).not.toContain('Delete Dhanmondi Strikers?');
    expect(api.delete).not.toHaveBeenCalled();
  });

  test('a 404 on confirm (already removed) closes the dialog, says so and reloads', async () => {
    api.delete.mockRejectedValue(
      httpError(404, 'Player not found in this team.'),
    );
    const { renderer } = await render(CAPTAIN_VIEW);

    await press(renderer, 'Remove Tanvir Ahmed');
    await press(renderer, 'Remove');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Player not found in this team.',
    );
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(shownText(renderer)).not.toContain(
      'Remove Tanvir Ahmed from Dhanmondi Strikers?',
    );
  });

  test('a 409 on leave (someone joined meanwhile) says so, reloads and stays', async () => {
    api.post.mockRejectedValue(
      httpError(409, 'Transfer captaincy before leaving the team.'),
    );
    const alone = {
      ...CAPTAIN_VIEW,
      memberCount: 1,
      members: [CAPTAIN_VIEW.members[0]],
    };
    const { renderer, navigation } = await render(alone);

    await press(renderer, 'Leave team');
    await press(renderer, 'Leave and delete');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Transfer captaincy before leaving the team.',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('only the captain sees remove, cancel invite, decline and delete', async () => {
    const { renderer } = await render(viewAs('member'), {
      user: { ...PLAYER, id: 2 },
    });

    expect(labels(renderer)).toEqual(['Back to My Teams', 'Leave team']);
  });
});
