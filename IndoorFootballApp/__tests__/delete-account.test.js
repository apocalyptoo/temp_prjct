/* eslint-env jest */
// Tests for Delete account (feature 4, docs/features/account-deletion.md, section e): the
// sentences, the screen, and AuthContext's deleteAccount with what follows it. Settings'
// own button is in settings-password.test.js.

import React, { useContext } from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import {
  ACCOUNT_DELETED_MESSAGE,
  AuthContext,
  AuthProvider,
  SESSION_EXPIRED_MESSAGE,
} from '../src/contexts/AuthContext';
import { Button } from '../src/components/ui';
import { TRY_AGAIN_MS } from '../src/hooks/useTryAgain';
import DeleteAccountScreen, {
  DELETE_FAILED,
  LOAD_FAILED,
  PASSWORD_REQUIRED,
  WRONG_PASSWORD,
} from '../src/screens/Shared/DeleteAccountScreen';
import {
  teamOutcomeText,
  teamsSummary,
  whatWillBeDeleted,
} from '../src/screens/Shared/deletionOutcomes';
import { resetSentText } from '../src/screens/Shared/ChangePasswordScreen';
import api, { setSessionExpiredHandler } from '../src/api/api';
import { getToken, saveToken } from '../src/utils/storage';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  API_URL: 'https://api.example.test',
  default: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const wait = ms => act(() => new Promise(resolve => setTimeout(resolve, ms)));
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const PLAYER = {
  id: 10,
  name: 'Karim',
  email: 'karim@gmail.com',
  role: 'PLAYER',
};
const OWNER = {
  id: 20,
  name: 'Arena 71',
  email: 'arena@gmail.com',
  role: 'OWNER',
};

const SOLO = { id: 9, name: 'Mirpur Mavericks', outcome: 'delete' };
const KEPT = {
  id: 7,
  name: 'Dhanmondi Strikers',
  outcome: 'handover',
  newCaptain: { id: 19, name: 'Rahim' },
};
const NOTHING = {
  previewCode: 'a'.repeat(64),
  captainedTeams: [],
  otherTeams: [],
  pendingCount: 0,
  venue: null,
};
const CAPTAIN = {
  ...NOTHING,
  captainedTeams: [SOLO, KEPT],
  otherTeams: [{ id: 12, name: 'Gulshan FC' }],
  pendingCount: 2,
};
const PASSWORD = 'My-pass-123!';

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });
const noConnection = () => new Error('Network Error');

// A navigation whose focus event the test can fire again.
function navigationMock() {
  const listeners = [];
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    addListener: jest.fn((event, listener) => {
      listeners.push(listener);
      listener(); // React Navigation also fires it when the screen first opens
      return () => {};
    }),
    focus: () => act(async () => listeners[listeners.length - 1]()),
  };
}

async function render({
  user = PLAYER,
  deleteAccount = jest.fn(),
  navigation = navigationMock(),
} = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user, deleteAccount }}>
          <DeleteAccountScreen navigation={navigation} />
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  await settle();
  return renderer;
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const passwordField = renderer =>
  renderer.root.find(
    node =>
      node.type === TextInput && node.props.accessibilityLabel === 'Password',
  );
const typePassword = (renderer, text) =>
  act(async () => passwordField(renderer).props.onChangeText(text));

// Pressables by label; the dialog's confirm button shares its opener's label, so "last"
// picks the dialog's.
const tappables = (renderer, label) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );
const press = async (renderer, label, { last = false } = {}) => {
  const found = tappables(renderer, label);
  const node = last ? found[found.length - 1] : found[0];
  await act(async () => node.props.onPress());
  await settle();
};
// Types the password, taps Delete account, and confirms in the dialog.
async function confirmDeletion(renderer) {
  await typePassword(renderer, PASSWORD);
  await press(renderer, 'Delete account');
  await press(renderer, 'Delete account', { last: true });
}
const dialogIsOpen = renderer =>
  shownText(renderer).includes('Delete your account?');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: NOTHING });
});

describe('The sentences', () => {
  test('each team outcome', () => {
    expect(teamOutcomeText(KEPT)).toBe(
      'Dhanmondi Strikers will be handed to Rahim',
    );
    expect(teamOutcomeText(SOLO)).toBe(
      "Mirpur Mavericks will be deleted (you're the only member)",
    );
  });

  test('the summary has only the parts that apply, singular and plural', () => {
    expect(teamsSummary([])).toBeNull();
    expect(teamsSummary([SOLO])).toBe('1 team will be deleted.');
    expect(teamsSummary([KEPT])).toBe('1 team will be handed over.');
    expect(teamsSummary([SOLO, SOLO])).toBe('2 teams will be deleted.');
    expect(teamsSummary([SOLO, KEPT, KEPT])).toBe(
      '1 team will be deleted and 2 teams will be handed over.',
    );
  });

  test('what will be deleted: a player', () => {
    const profile = {
      icon: 'profile',
      name: 'Your profile',
      meta: 'Your name, phone, position and everything else you added',
    };
    expect(whatWillBeDeleted(NOTHING, 'PLAYER')).toEqual([profile]);
    expect(whatWillBeDeleted(CAPTAIN, 'PLAYER')).toEqual([
      profile,
      { icon: 'teams', name: 'Your place in 1 team', meta: 'Gulshan FC' },
      {
        icon: 'invite',
        name: 'Your invites and join requests',
        meta: '2 waiting',
      },
    ]);
    const two = {
      ...NOTHING,
      otherTeams: [
        { id: 1, name: 'Banani Boys' },
        { id: 2, name: 'Gulshan FC' },
      ],
    };
    expect(whatWillBeDeleted(two, 'PLAYER')[1]).toMatchObject({
      name: 'Your place in 2 teams',
      meta: 'Banani Boys, Gulshan FC',
    });
  });

  test('what will be deleted: a venue owner, live or waiting for review', () => {
    const withVenue = live => ({
      ...NOTHING,
      venue: { name: 'Arena 71', live },
    });
    expect(whatWillBeDeleted(withVenue(true), 'OWNER')).toEqual([
      { icon: 'profile', name: 'Your account' },
      {
        icon: 'venue',
        name: 'Your venue listing will be removed',
        meta: 'Arena 71 disappears from Explore',
      },
    ]);
    expect(whatWillBeDeleted(withVenue(false), 'OWNER')[1].meta).toBe(
      'Arena 71 is waiting for review',
    );
  });
});

describe('The screen', () => {
  test('a captain sees the outcomes in the order they came, then the password', async () => {
    api.get.mockResolvedValue({ data: CAPTAIN });
    const renderer = await render();

    expect(api.get).toHaveBeenCalledWith('/auth/deletion-preview');
    const text = shownText(renderer);
    const inOrder = [
      'Delete account',
      "Your account will be deleted straight away. This can't be undone.",
      'What will be deleted',
      'Your profile',
      'Your place in 1 team',
      'Your invites and join requests',
      'Your teams',
      "Mirpur Mavericks will be deleted (you're the only member)",
      'Dhanmondi Strikers will be handed to Rahim',
      "We'll email karim@gmail.com to confirm that your account was deleted.",
      'Password',
      'Forgot your password?',
    ].map(line => text.indexOf(line));
    expect(inOrder).not.toContain(-1);
    expect(inOrder).toEqual([...inOrder].sort((a, b) => a - b));
    // Nothing on it is lime: the one action is the red one.
    expect(
      renderer.root
        .findAllByType(Button)
        .map(node => [node.props.title, node.props.variant]),
    ).toEqual([['Delete account', 'danger']]);
  });

  test('someone who captains no team gets no teams card', async () => {
    const renderer = await render();
    expect(shownText(renderer)).not.toContain('Your teams');
  });

  test('a venue owner sees the venue line', async () => {
    api.get.mockResolvedValue({
      data: { ...NOTHING, venue: { name: 'Arena 71', live: true } },
    });
    const text = shownText(await render({ user: OWNER }));
    expect(text).toContain('Your venue listing will be removed');
    expect(text).toContain('Arena 71 disappears from Explore');
    expect(text).not.toContain('Your profile');
    expect(text).not.toContain('Your teams');
  });

  test('a failed load shows no password field; Try again loads it', async () => {
    api.get.mockRejectedValueOnce(noConnection());
    const renderer = await render();
    expect(shownText(renderer)).toContain(LOAD_FAILED);
    expect(shownText(renderer)).not.toContain('Forgot your password?');
    expect(tappables(renderer, 'Delete account')).toHaveLength(0);

    await press(renderer, 'Try again');
    await wait(TRY_AGAIN_MS + 50);
    expect(shownText(renderer)).toContain('What will be deleted');
    expect(tappables(renderer, 'Delete account')).toHaveLength(1);
  });

  test('coming back to the screen loads it again; if that fails, what was shown stays', async () => {
    api.get.mockResolvedValueOnce({ data: CAPTAIN });
    const navigation = navigationMock();
    const renderer = await render({ navigation });
    api.get.mockResolvedValueOnce({
      data: { ...CAPTAIN, captainedTeams: [KEPT] },
    });
    await navigation.focus();
    await settle();
    expect(shownText(renderer)).not.toContain('Mirpur Mavericks');

    api.get.mockRejectedValueOnce(noConnection());
    await navigation.focus();
    await settle();
    expect(shownText(renderer)).toContain('Dhanmondi Strikers');
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  test('an empty password shows its error and asks nothing', async () => {
    const deleteAccount = jest.fn();
    const renderer = await render({ deleteAccount });
    await press(renderer, 'Delete account');
    expect(shownText(renderer)).toContain(PASSWORD_REQUIRED);
    expect(dialogIsOpen(renderer)).toBe(false);
    expect(deleteAccount).not.toHaveBeenCalled();
    await typePassword(renderer, 'x');
    expect(shownText(renderer)).not.toContain(PASSWORD_REQUIRED);
  });

  test('the final question sums up the teams; Keep account sends nothing', async () => {
    api.get.mockResolvedValue({ data: CAPTAIN });
    const deleteAccount = jest.fn();
    const renderer = await render({ deleteAccount });
    await typePassword(renderer, PASSWORD);
    await press(renderer, 'Delete account');

    const text = shownText(renderer);
    expect(text).toContain('Delete your account?');
    expect(text).toContain(
      "1 team will be deleted and 1 team will be handed over. This can't be undone.",
    );
    expect(text).not.toContain('Cancel');
    await press(renderer, 'Keep account');
    expect(dialogIsOpen(renderer)).toBe(false);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(passwordField(renderer).props.value).toBe(PASSWORD);
  });

  test('without captained teams the final question has no summary', async () => {
    const renderer = await render();
    await typePassword(renderer, PASSWORD);
    await press(renderer, 'Delete account');
    expect(shownText(renderer).split(' | ')).toContain("This can't be undone.");
  });

  test('confirming sends the password and the code once, however often it is tapped', async () => {
    let finish;
    const deleteAccount = jest.fn(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const renderer = await render({ deleteAccount });
    await typePassword(renderer, PASSWORD);
    await press(renderer, 'Delete account');
    const confirm = tappables(renderer, 'Delete account').pop();
    await act(async () => {
      confirm.props.onPress();
      confirm.props.onPress();
    });

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(deleteAccount).toHaveBeenCalledWith(PASSWORD, NOTHING.previewCode);
    // While it runs the dialog stays, and Keep account does nothing.
    expect(dialogIsOpen(renderer)).toBe(true);
    await press(renderer, 'Keep account');
    expect(dialogIsOpen(renderer)).toBe(true);
    await act(async () => finish());
  });

  test('a wrong password shows under its field: no alert, no leaving', async () => {
    const deleteAccount = jest
      .fn()
      .mockRejectedValue(httpError(400, WRONG_PASSWORD));
    const navigation = navigationMock();
    const renderer = await render({ deleteAccount, navigation });
    await confirmDeletion(renderer);

    expect(dialogIsOpen(renderer)).toBe(false);
    expect(shownText(renderer)).toContain(WRONG_PASSWORD);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    await typePassword(renderer, 'Another-pass-1!');
    expect(shownText(renderer)).not.toContain(WRONG_PASSWORD);
  });

  test('"Something changed" (409) shows the new outcome, keeps the password, and the next try sends the new code', async () => {
    const message =
      'Something changed in your teams. Check what will happen and try again.';
    api.get.mockResolvedValueOnce({ data: CAPTAIN }).mockResolvedValueOnce({
      data: {
        ...CAPTAIN,
        previewCode: 'b'.repeat(64),
        captainedTeams: [
          SOLO,
          { ...KEPT, newCaptain: { id: 30, name: 'Tanvir' } },
        ],
      },
    });
    const deleteAccount = jest.fn().mockRejectedValue(httpError(409, message));
    const renderer = await render({ deleteAccount });
    await confirmDeletion(renderer);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Something changed', message);
    expect(dialogIsOpen(renderer)).toBe(false);
    expect(shownText(renderer)).toContain(
      'Dhanmondi Strikers will be handed to Tanvir',
    );
    expect(passwordField(renderer).props.value).toBe(PASSWORD);

    await press(renderer, 'Delete account');
    await press(renderer, 'Delete account', { last: true });
    expect(deleteAccount).toHaveBeenLastCalledWith(PASSWORD, 'b'.repeat(64));
  });

  test('if the new outcome cannot be loaded, the old one is not shown as if it were true', async () => {
    api.get
      .mockResolvedValueOnce({ data: CAPTAIN })
      .mockRejectedValueOnce(noConnection())
      .mockResolvedValueOnce({ data: NOTHING });
    const deleteAccount = jest
      .fn()
      .mockRejectedValue(httpError(409, 'Something changed.'));
    const renderer = await render({ deleteAccount });
    await confirmDeletion(renderer);

    expect(shownText(renderer)).toContain(LOAD_FAILED);
    expect(shownText(renderer)).not.toContain('Dhanmondi Strikers');
    await press(renderer, 'Try again');
    await wait(TRY_AGAIN_MS + 50);
    expect(passwordField(renderer).props.value).toBe(PASSWORD);
  });

  test('too many attempts (429) shows its message', async () => {
    const message =
      'Too many attempts to delete your account. Please wait 15 minutes and try again.';
    const renderer = await render({
      deleteAccount: jest.fn().mockRejectedValue(httpError(429, message)),
    });
    await confirmDeletion(renderer);
    expect(Alert.alert).toHaveBeenCalledWith('Not deleted', message);
    expect(dialogIsOpen(renderer)).toBe(false);
  });

  test('no connection, or a server error, says to try again', async () => {
    for (const error of [
      noConnection(),
      httpError(500, 'Something went wrong'),
    ]) {
      Alert.alert.mockClear();
      const renderer = await render({
        deleteAccount: jest.fn().mockRejectedValue(error),
      });
      await confirmDeletion(renderer);
      expect(Alert.alert).toHaveBeenCalledWith('Not deleted', DELETE_FAILED);
      expect(dialogIsOpen(renderer)).toBe(false);
    }
  });

  test('a 401 on the deletion adds no alert of its own (the app has logged out)', async () => {
    const renderer = await render({
      deleteAccount: jest
        .fn()
        .mockRejectedValue(httpError(401, 'Invalid token')),
    });
    await confirmDeletion(renderer);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('"Forgot your password?" asks first, then emails a reset link and says so', async () => {
    api.post.mockResolvedValue({ data: {} });
    const renderer = await render();
    await press(renderer, 'Forgot your password?');
    expect(shownText(renderer)).toContain('Send a reset link?');
    expect(shownText(renderer)).toContain(
      "We'll email a link to karim@gmail.com to set a new password.",
    );
    expect(api.post).not.toHaveBeenCalled();
    await press(renderer, 'Send link');
    expect(api.post).toHaveBeenCalledWith('/auth/forgot', {
      email: 'karim@gmail.com',
    });
    expect(shownText(renderer)).toContain(resetSentText('karim@gmail.com'));
  });

  test('back goes to Settings', async () => {
    const navigation = navigationMock();
    const renderer = await render({ navigation });
    await press(renderer, 'Back to Settings');
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe("AuthContext's deleteAccount", () => {
  // The real AuthProvider with a saved login. `latest()` is its current value;
  // `expire(url)` is what api.js calls when a request gets a 401.
  async function loggedIn() {
    await saveToken('my-token');
    api.get.mockResolvedValue({ data: PLAYER });
    let context;
    function Grab() {
      context = useContext(AuthContext);
      return null;
    }
    await act(async () => {
      ReactTestRenderer.create(
        <AuthProvider>
          <Grab />
        </AuthProvider>,
      );
    });
    await settle();
    expect(context.user).toEqual(PLAYER);
    const handler = setSessionExpiredHandler.mock.calls
      .map(([registered]) => registered)
      .filter(Boolean)
      .pop();
    return {
      latest: () => context,
      expire: url => act(async () => handler({ url })),
    };
  }

  test('on success the saved login is gone before the one alert', async () => {
    const { latest } = await loggedIn();
    api.post.mockResolvedValue({ data: { message: ACCOUNT_DELETED_MESSAGE } });
    let tokenAtAlert = 'not asked yet';
    Alert.alert.mockImplementation(() => {
      tokenAtAlert = getToken();
    });

    await act(async () => {
      await latest().deleteAccount(PASSWORD, 'a'.repeat(64));
    });

    expect(api.post).toHaveBeenCalledWith('/auth/delete-account', {
      password: PASSWORD,
      previewCode: 'a'.repeat(64),
    });
    expect(await tokenAtAlert).toBeNull();
    expect(latest().user).toBeNull();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Account deleted',
      'Your account was deleted.',
    );
  });

  test('a refusal leaves the user logged in and is passed on as it came', async () => {
    const { latest } = await loggedIn();
    for (const error of [
      httpError(400, WRONG_PASSWORD),
      httpError(409, 'Something changed.'),
      noConnection(),
    ]) {
      api.post.mockRejectedValueOnce(error);
      await act(async () => {
        await expect(
          latest().deleteAccount(PASSWORD, 'a'.repeat(64)),
        ).rejects.toBe(error);
      });
    }
    expect(latest().user).toEqual(PLAYER);
    expect(await getToken()).toBe('my-token');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test("another request's 401 while it runs shows no Session expired (P18)", async () => {
    const { latest, expire } = await loggedIn();
    let finish;
    api.post.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    let deletion;
    await act(async () => {
      deletion = latest().deleteAccount(PASSWORD, 'a'.repeat(64));
    });
    await expire('/teams/me');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(latest().user).toEqual(PLAYER);

    await act(async () => {
      finish({ data: {} });
      await deletion;
    });
    expect(Alert.alert.mock.calls).toEqual([
      ['Account deleted', ACCOUNT_DELETED_MESSAGE],
    ]);
  });

  test('a 401 on the deletion itself logs out with Session expired, as usual', async () => {
    const { latest, expire } = await loggedIn();
    api.post.mockImplementation(async url => {
      await expire(url);
      throw httpError(401, 'Invalid token');
    });
    await act(async () => {
      await expect(
        latest().deleteAccount(PASSWORD, 'a'.repeat(64)),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
    expect(latest().user).toBeNull();
    expect(await getToken()).toBeNull();
    expect(Alert.alert.mock.calls).toEqual([
      ['Session expired', SESSION_EXPIRED_MESSAGE],
    ]);
  });

  test('after a failed deletion a 401 counts again', async () => {
    const { latest, expire } = await loggedIn();
    api.post.mockRejectedValueOnce(noConnection());
    await act(async () => {
      await latest()
        .deleteAccount(PASSWORD, 'a'.repeat(64))
        .catch(() => {});
    });
    await expire('/teams/me');
    expect(latest().user).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Session expired',
      SESSION_EXPIRED_MESSAGE,
    );
  });
});
