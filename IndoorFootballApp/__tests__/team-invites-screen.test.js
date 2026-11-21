/* eslint-env jest */
// Tests for the Notifications tab's interim Invites screen (feature 1,
// docs/features/team-membership.md, section e): the invite cards, Accept and Decline,
// Accept disabled when the team is full, opening Team detail, and the empty state.

import React from 'react';
import { Alert, RefreshControl, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import InvitesScreen from '../src/screens/Player/InvitesScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

const invite = (teamId, name, memberCount = 11) => ({
  id: teamId * 10,
  teamId,
  status: 'pending',
  team: {
    id: teamId,
    name,
    captainId: 1,
    captain: { id: 1, name: 'Rahim Uddin' },
    memberCount,
    maxMembers: 15,
  },
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

async function render(invites) {
  api.get.mockResolvedValue({ data: invites });
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
        <InvitesScreen navigation={navigation} />
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('each invite: the team, who invited you, how full it is, Accept and Decline', async () => {
  const { renderer } = await render([invite(7, 'Dhanmondi Strikers')]);
  const text = shownText(renderer);

  expect(api.get).toHaveBeenCalledWith('/players/invites');
  expect(text).toContain('Invites');
  expect(text).toContain('Dhanmondi Strikers');
  expect(text).toContain('Rahim Uddin invited you · 11 / 15 members');
  expect(
    button(renderer, 'Accept the invite to Dhanmondi Strikers'),
  ).toBeTruthy();
  expect(
    button(renderer, 'Decline the invite to Dhanmondi Strikers'),
  ).toBeTruthy();
});

test('Accept calls the accept route and reloads', async () => {
  api.post.mockResolvedValue({ data: {} });
  const { renderer } = await render([invite(7, 'Dhanmondi Strikers')]);

  await press(renderer, 'Accept the invite to Dhanmondi Strikers');

  expect(api.post).toHaveBeenCalledWith('/teams/7/accept');
  expect(api.get).toHaveBeenCalledTimes(2);
});

test('Decline calls the reject route and reloads', async () => {
  api.post.mockResolvedValue({ data: {} });
  const { renderer } = await render([invite(7, 'Dhanmondi Strikers')]);

  await press(renderer, 'Decline the invite to Dhanmondi Strikers');

  expect(api.post).toHaveBeenCalledWith('/teams/7/reject');
  expect(api.get).toHaveBeenCalledTimes(2);
});

test('a full team: Accept is disabled with "Team is full (15/15)"; Decline still works', async () => {
  const { renderer } = await render([invite(7, 'Dhanmondi Strikers', 15)]);

  expect(button(renderer, 'Team is full (15/15)').props.disabled).toBe(true);
  expect(
    button(renderer, 'Decline the invite to Dhanmondi Strikers').props.disabled,
  ).toBe(false);
});

test('a cancelled invite (404) says so and reloads', async () => {
  api.post.mockRejectedValue(
    Object.assign(new Error('HTTP 404'), {
      response: { status: 404, data: { error: 'Invite not found' } },
    }),
  );
  const { renderer } = await render([invite(7, 'Dhanmondi Strikers')]);

  await press(renderer, 'Accept the invite to Dhanmondi Strikers');

  expect(Alert.alert).toHaveBeenCalledWith(
    'Something changed',
    'Invite not found',
  );
  expect(api.get).toHaveBeenCalledTimes(2);
});

test('tapping the card opens Team detail', async () => {
  const { renderer, navigation } = await render([
    invite(7, 'Dhanmondi Strikers'),
  ]);

  await press(renderer, 'Open Dhanmondi Strikers');

  expect(navigation.navigate).toHaveBeenCalledWith('TeamDetail', { teamId: 7 });
});

test('no invites: "No invites right now."', async () => {
  const { renderer } = await render([]);

  expect(shownText(renderer)).toContain('No invites right now.');
});

test('pull to refresh loads again', async () => {
  const { renderer } = await render([]);

  await act(async () =>
    renderer.root.findByType(RefreshControl).props.onRefresh(),
  );
  await settle();

  expect(api.get).toHaveBeenCalledTimes(2);
});

test('a failed first load offers Try again', async () => {
  api.get.mockRejectedValueOnce(new Error('Network Error'));
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
        <InvitesScreen navigation={navigation} />
      </ThemeProvider>,
    );
  });
  await settle();
  expect(shownText(renderer)).toContain("Couldn't load your invites.");

  api.get.mockResolvedValue({ data: [invite(7, 'Dhanmondi Strikers')] });
  await press(renderer, 'Try again');

  expect(shownText(renderer)).toContain('Dhanmondi Strikers');
});
