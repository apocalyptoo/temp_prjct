/* eslint-env jest */
// Tests for Settings and Change password (feature 2, docs/features/profiles-and-
// registration.md, section e), and AuthContext's changePassword, which saves the fresh
// token from the reply.

import React, { useContext } from 'react';
import { Alert, Linking, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext, AuthProvider } from '../src/contexts/AuthContext';
import SettingsScreen from '../src/screens/Shared/SettingsScreen';
import ChangePasswordScreen, {
  CHANGED_MESSAGE,
  checkPasswordChange,
  resetSentText,
  SAME_PASSWORD,
  WRONG_CURRENT,
} from '../src/screens/Shared/ChangePasswordScreen';
import api from '../src/api/api';
import { getToken, saveToken } from '../src/utils/storage';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  API_URL: 'https://api.example.test',
  default: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const USER = {
  id: 10,
  name: 'Rahim',
  email: 'rahim@gmail.com',
  role: 'PLAYER',
};

async function render(element, auth = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user: USER, ...auth }}>
          {element}
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  return renderer;
}

const navigationMock = () => ({ navigate: jest.fn(), goBack: jest.fn() });

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const type = (renderer, label, text) =>
  act(async () =>
    renderer.root
      .find(
        node =>
          node.type === TextInput && node.props.accessibilityLabel === label,
      )
      .props.onChangeText(text),
  );

// Pressables by label; a dialog's confirm button can share its opener's label, so
// "last" picks the dialog's.
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

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('Settings', () => {
  test('the rows of v1.0 so far, each going to its place', async () => {
    const navigation = navigationMock();
    const renderer = await render(<SettingsScreen navigation={navigation} />, {
      logout: jest.fn(),
    });
    await press(renderer, 'Edit profile');
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');
    await press(renderer, 'Change password');
    expect(navigation.navigate).toHaveBeenCalledWith('ChangePassword');
    await press(renderer, 'Terms of Use');
    await press(renderer, 'Privacy Policy');
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/legal/terms',
    );
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/legal/privacy',
    );
    // The old About and Support rows are gone.
    expect(shownText(renderer)).not.toContain('About');
    expect(shownText(renderer)).not.toContain('Support');
    await press(renderer, 'Back to Profile');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a venue owner gets Edit venue instead of Edit profile (Q3)', async () => {
    const navigation = navigationMock();
    const renderer = await render(<SettingsScreen navigation={navigation} />, {
      user: { ...USER, role: 'OWNER', name: 'Floodlight Arena' },
      logout: jest.fn(),
    });
    const text = shownText(renderer);
    expect(text).not.toContain('Edit profile');
    for (const row of [
      'Edit venue',
      'Change password',
      'Terms of Use',
      'Privacy Policy',
      'Log out',
    ]) {
      expect(text).toContain(row);
    }
    await press(renderer, 'Edit venue');
    expect(navigation.navigate).toHaveBeenCalledWith('EditVenue', {
      from: 'Settings',
    });
    await press(renderer, 'Change password');
    expect(navigation.navigate).toHaveBeenCalledWith('ChangePassword');
  });

  test('Log out asks first; Cancel keeps you logged in, Log out logs out', async () => {
    const logout = jest.fn();
    const renderer = await render(
      <SettingsScreen navigation={navigationMock()} />,
      { logout },
    );
    await press(renderer, 'Log out');
    expect(shownText(renderer)).toContain('Log out?');
    await press(renderer, 'Cancel');
    expect(logout).not.toHaveBeenCalled();

    await press(renderer, 'Log out');
    await press(renderer, 'Log out', { last: true });
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe('Change password: the checks before sending', () => {
  test('every field, with the sign-up password rule', () => {
    expect(
      checkPasswordChange({ current: '', next: '', confirm: '' }).errors,
    ).toEqual({
      current: 'Current password is required',
      next: 'New password is required',
      confirm: 'Confirm your password',
    });
    expect(
      checkPasswordChange({ current: 'x', next: 'weak', confirm: 'weak' })
        .errors.next,
    ).toContain('Password must be at least 8 characters');
    expect(
      checkPasswordChange({
        current: 'Old-pass-123!',
        next: 'Old-pass-123!',
        confirm: 'Old-pass-123!',
      }).errors.next,
    ).toBe(SAME_PASSWORD);
    expect(
      checkPasswordChange({
        current: 'Old-pass-123!',
        next: 'New-pass-456!',
        confirm: 'New-pass-457!',
      }).errors.confirm,
    ).toBe("Passwords don't match");
    expect(
      checkPasswordChange({
        current: 'Old-pass-123!',
        next: 'New-pass-456!',
        confirm: 'New-pass-456!',
      }).ok,
    ).toBe(true);
  });
});

describe('Change password: the screen', () => {
  async function fill(renderer, current = 'Old-pass-123!') {
    await type(renderer, 'Current password', current);
    await type(renderer, 'New password', 'New-pass-456!');
    await type(renderer, 'Confirm new password', 'New-pass-456!');
  }

  test('empty fields show their errors and nothing is sent', async () => {
    const changePassword = jest.fn();
    const renderer = await render(
      <ChangePasswordScreen navigation={navigationMock()} />,
      { changePassword },
    );
    await press(renderer, 'Change password');
    expect(shownText(renderer)).toContain('Current password is required');
    expect(changePassword).not.toHaveBeenCalled();
  });

  test('success: one "Password changed" alert, then back to Settings', async () => {
    const changePassword = jest
      .fn()
      .mockResolvedValue({ message: 'Password changed' });
    const navigation = navigationMock();
    const renderer = await render(
      <ChangePasswordScreen navigation={navigation} />,
      { changePassword },
    );
    await fill(renderer);
    await press(renderer, 'Change password');
    expect(changePassword).toHaveBeenCalledWith(
      'Old-pass-123!',
      'New-pass-456!',
    );
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Password changed',
      CHANGED_MESSAGE,
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a wrong current password shows under its field: no alert, no logout, no leaving', async () => {
    const changePassword = jest
      .fn()
      .mockRejectedValue(httpError(400, WRONG_CURRENT));
    const logout = jest.fn();
    const navigation = navigationMock();
    const renderer = await render(
      <ChangePasswordScreen navigation={navigation} />,
      { changePassword, logout },
    );
    await fill(renderer, 'Wrong-pass-1!');
    await press(renderer, 'Change password');
    expect(shownText(renderer)).toContain(WRONG_CURRENT);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    // Typing in the field clears the error.
    await type(renderer, 'Current password', 'Old-pass-123!');
    expect(shownText(renderer)).not.toContain(WRONG_CURRENT);
  });

  test('too many attempts (429) shows in an alert', async () => {
    const changePassword = jest
      .fn()
      .mockRejectedValue(
        httpError(
          429,
          'Too many attempts to change your password. Please wait 15 minutes and try again.',
        ),
      );
    const renderer = await render(
      <ChangePasswordScreen navigation={navigationMock()} />,
      { changePassword },
    );
    await fill(renderer);
    await press(renderer, 'Change password');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not changed',
      'Too many attempts to change your password. Please wait 15 minutes and try again.',
    );
  });

  test('a double tap sends one request', async () => {
    let finish;
    const changePassword = jest.fn().mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const renderer = await render(
      <ChangePasswordScreen navigation={navigationMock()} />,
      { changePassword },
    );
    await fill(renderer);
    const [button] = tappables(renderer, 'Change password');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(changePassword).toHaveBeenCalledTimes(1);
    await act(async () => finish({}));
  });

  test('"Forgot your current password?" asks first, then emails a reset link and says so', async () => {
    api.post.mockResolvedValue({ data: {} });
    const renderer = await render(
      <ChangePasswordScreen navigation={navigationMock()} />,
      { changePassword: jest.fn() },
    );
    await press(renderer, 'Forgot your current password?');
    expect(shownText(renderer)).toContain('Send a reset link?');
    expect(shownText(renderer)).toContain(
      "We'll email a link to rahim@gmail.com to set a new password.",
    );
    await press(renderer, 'Send link');
    expect(api.post).toHaveBeenCalledWith('/auth/forgot', {
      email: 'rahim@gmail.com',
    });
    expect(shownText(renderer)).toContain(resetSentText('rahim@gmail.com'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe("AuthContext's changePassword", () => {
  async function realContext() {
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
    return context;
  }

  test('sends both passwords and saves the fresh token from the reply', async () => {
    await saveToken('old-token');
    api.post.mockResolvedValue({
      data: { message: 'Password changed', token: 'fresh-token' },
    });
    const { changePassword } = await realContext();
    await act(async () => {
      await changePassword('Old-pass-123!', 'New-pass-456!');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'Old-pass-123!',
      newPassword: 'New-pass-456!',
    });
    expect(await getToken()).toBe('fresh-token');
  });

  test('a refusal keeps the old token and is passed on as it came', async () => {
    await saveToken('old-token');
    api.post.mockRejectedValue(httpError(400, WRONG_CURRENT));
    const { changePassword } = await realContext();
    await expect(
      changePassword('Wrong-pass-1!', 'New-pass-456!'),
    ).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect(await getToken()).toBe('old-token');
  });
});
