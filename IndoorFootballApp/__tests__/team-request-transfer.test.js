/* eslint-env jest */
// Tests for the Request to join and Transfer captaincy screens (feature 1,
// docs/features/team-membership.md, section e). Each renders the screen alone with a
// fake API and a fake navigation object.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import RequestToJoinScreen from '../src/screens/Team/RequestToJoinScreen';
import TransferCaptaincyScreen from '../src/screens/Team/TransferCaptaincyScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

// A navigation object with what the screens use. 'focus' fires once, as when a screen
// first opens.
function fakeNavigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    addListener: jest.fn((event, callback) => {
      if (event === 'focus') callback();
      return () => {};
    }),
  };
}

async function render(Screen, params) {
  const navigation = fakeNavigation();
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <Screen route={{ params }} navigation={navigation} />
      </ThemeProvider>,
    );
  });
  await settle();
  return { renderer, navigation };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

// Tappable things (Pressable): a role and a style that depends on being pressed.
const tappable = (renderer, label) =>
  renderer.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );
const press = (renderer, label) =>
  act(async () => {
    tappable(renderer, label).props.onPress();
  });

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('Request to join', () => {
  const PARAMS = { teamId: 7, teamName: 'Dhanmondi Strikers' };

  test('shows the team name, the optional message field and the count', async () => {
    const { renderer } = await render(RequestToJoinScreen, PARAMS);

    const text = shownText(renderer);
    expect(text).toContain('Ask to join Dhanmondi Strikers');
    expect(text).toContain('Message to the captain (optional)');
    expect(text).toContain('Up to 150 characters (0/150)');
    expect(tappable(renderer, 'Back to Dhanmondi Strikers')).toBeTruthy();
  });

  test('the field stops at 150 characters, counting an emoji once', async () => {
    const { renderer } = await render(RequestToJoinScreen, PARAMS);
    const input = renderer.root.findByType(TextInput);

    await act(async () => input.props.onChangeText('\u{1F600}'.repeat(160)));

    expect([...renderer.root.findByType(TextInput).props.value]).toHaveLength(
      150,
    );
    expect(shownText(renderer)).toContain('(150/150)');
  });

  test('Send request posts the message and goes back', async () => {
    api.post.mockResolvedValue({ status: 201, data: {} });
    const { renderer, navigation } = await render(RequestToJoinScreen, PARAMS);
    await act(async () =>
      renderer.root
        .findByType(TextInput)
        .props.onChangeText('I play Thursdays'),
    );

    await press(renderer, 'Send request');
    await settle();

    expect(api.post).toHaveBeenCalledWith('/teams/7/requests', {
      message: 'I play Thursdays',
    });
    expect(navigation.goBack).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('a 409 (for example the team is full) shows the message and goes back', async () => {
    api.post.mockRejectedValue(httpError(409, 'Team is full (15/15).'));
    const { renderer, navigation } = await render(RequestToJoinScreen, PARAMS);

    await press(renderer, 'Send request');
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Team is full (15/15).',
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('any other error shows "Error" and stays on the screen', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    const { renderer, navigation } = await render(RequestToJoinScreen, PARAMS);

    await press(renderer, 'Send request');
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Something went wrong. Please try again.',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(tappable(renderer, 'Send request').props.disabled).toBe(false);
  });
});

describe('Transfer captaincy', () => {
  const PARAMS = { teamId: 7, teamName: 'Dhanmondi Strikers' };
  const member = (userId, name, position) => ({
    id: userId * 10,
    userId,
    status: 'accepted',
    user: { id: userId, name, playerProfile: { name, position } },
  });
  const TEAM = {
    id: 7,
    name: 'Dhanmondi Strikers',
    captainId: 1,
    members: [
      member(1, 'Rahim Uddin', 'Forward'),
      member(2, 'Tanvir Ahmed', 'Goalkeeper'),
      member(3, 'Sakib Hasan', 'Defender'),
    ],
  };

  test('each row reads "Position · Area" when the member has an area', async () => {
    const withArea = {
      ...TEAM,
      members: TEAM.members.map(row =>
        row.userId === 2
          ? {
              ...row,
              user: {
                ...row.user,
                playerProfile: { ...row.user.playerProfile, area: 'Mirpur 10' },
              },
            }
          : row,
      ),
    };
    api.get.mockResolvedValue({ data: withArea });
    const { renderer } = await render(TransferCaptaincyScreen, PARAMS);

    const text = shownText(renderer);
    expect(text).toContain('Goalkeeper · Mirpur 10');
    expect(text).toContain('Defender');
    expect(text).not.toContain('Defender · ');
  });

  test('lists every member except the captain', async () => {
    api.get.mockResolvedValue({ data: TEAM });
    const { renderer } = await render(TransferCaptaincyScreen, PARAMS);

    expect(api.get).toHaveBeenCalledWith('/teams/7');
    const text = shownText(renderer);
    expect(text).toContain('Transfer captaincy');
    expect(text).toContain('Tanvir Ahmed');
    expect(text).toContain('Sakib Hasan');
    expect(text).not.toContain('Rahim Uddin');
  });

  test('picking a member asks with the exact wording; confirming transfers and goes back', async () => {
    api.get.mockResolvedValue({ data: TEAM });
    api.post.mockResolvedValue({ data: { captainId: 2 } });
    const { renderer, navigation } = await render(
      TransferCaptaincyScreen,
      PARAMS,
    );

    await press(renderer, 'Tanvir Ahmed, Goalkeeper');
    const text = shownText(renderer);
    expect(text).toContain('Make Tanvir Ahmed captain?');
    expect(text).toContain(
      "You'll stay in Dhanmondi Strikers as a player. Tanvir Ahmed will manage invites, requests and the team's details.",
    );

    await press(renderer, 'Make captain');
    await settle();

    expect(api.post).toHaveBeenCalledWith('/teams/7/transfer', { userId: 2 });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('Cancel closes the dialog without a request', async () => {
    api.get.mockResolvedValue({ data: TEAM });
    const { renderer } = await render(TransferCaptaincyScreen, PARAMS);

    await press(renderer, 'Sakib Hasan, Defender');
    await press(renderer, 'Cancel');

    expect(shownText(renderer)).not.toContain('Make Sakib Hasan captain?');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('a 404 on confirm (they just left) shows the message and reloads', async () => {
    api.get.mockResolvedValue({ data: TEAM });
    api.post.mockRejectedValue(
      httpError(404, 'Player not found in this team.'),
    );
    const { renderer, navigation } = await render(
      TransferCaptaincyScreen,
      PARAMS,
    );

    await press(renderer, 'Tanvir Ahmed, Goalkeeper');
    await press(renderer, 'Make captain');
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Something changed',
      'Player not found in this team.',
    );
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('alone in the team: "No other members yet."', async () => {
    api.get.mockResolvedValue({
      data: { ...TEAM, members: [TEAM.members[0]] },
    });
    const { renderer } = await render(TransferCaptaincyScreen, PARAMS);

    expect(shownText(renderer)).toContain('No other members yet.');
  });

  test('the team is gone: an alert, then back', async () => {
    api.get.mockRejectedValue(httpError(404, 'Team not found'));
    const { navigation } = await render(TransferCaptaincyScreen, PARAMS);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Team not found',
      'This team no longer exists.',
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a failed first load offers Try again, which loads again', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error'));
    api.get.mockResolvedValueOnce({ data: TEAM });
    const { renderer } = await render(TransferCaptaincyScreen, PARAMS);
    expect(shownText(renderer)).toContain("Couldn't load this team.");

    await press(renderer, 'Try again');
    await settle();

    expect(shownText(renderer)).toContain('Tanvir Ahmed');
  });
});
