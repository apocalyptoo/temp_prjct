/* eslint-env jest */
// Tests for the rebuilt Login, Role selection and Forgot password screens (feature 2,
// docs/features/profiles-and-registration.md, section e): the checks before sending, what
// gets sent, the 403 "verify your email" notice with Resend, the links, and that a
// double tap sends only one request.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import LoginScreen from '../src/screens/Auth/LoginScreen';
import RoleSelectionScreen from '../src/screens/Auth/RoleSelectionScreen';
import ForgotPasswordScreen, {
  RESET_SENT_TEXT,
} from '../src/screens/Auth/ForgotPasswordScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
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

async function render(Screen, auth = {}) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <Screen navigation={navigation} />
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  return { renderer, navigation };
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const field = (renderer, label) =>
  renderer.root.find(
    node => node.type === TextInput && node.props.accessibilityLabel === label,
  );
const type = (renderer, label, text) =>
  act(async () => field(renderer, label).props.onChangeText(text));

// A Pressable (button, link or card) by its label.
const tappable = (renderer, label) =>
  renderer.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );
const press = async (renderer, label) => {
  await act(async () => tappable(renderer, label).props.onPress());
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

describe('Login', () => {
  const auth = () => ({
    login: jest.fn().mockResolvedValue({ success: true }),
    resendVerification: jest
      .fn()
      .mockResolvedValue({ success: true, message: 'Sent' }),
  });

  test('shows the name, slogan and links', async () => {
    const { renderer, navigation } = await render(LoginScreen, auth());
    expect(shownText(renderer)).toContain('ConnectArena');
    expect(shownText(renderer)).toContain('Unleash Your Inner Champion');
    await press(renderer, 'Forgot password?');
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
    await press(renderer, 'Create an account');
    expect(navigation.navigate).toHaveBeenCalledWith('RoleSelection');
  });

  test('empty fields show their errors and nothing is sent', async () => {
    const context = auth();
    const { renderer } = await render(LoginScreen, context);
    await press(renderer, 'Log in');
    expect(shownText(renderer)).toContain('Email is required');
    expect(shownText(renderer)).toContain('Password is required');
    expect(context.login).not.toHaveBeenCalled();
  });

  test('sends the trimmed email and the password as typed', async () => {
    const context = auth();
    const { renderer } = await render(LoginScreen, context);
    await type(renderer, 'Email', '  me+player@gmail.com ');
    await type(renderer, 'Password', ' Pass-123! ');
    await press(renderer, 'Log in');
    expect(context.login).toHaveBeenCalledWith(
      'me+player@gmail.com',
      ' Pass-123! ',
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test("a failed login shows the backend's message", async () => {
    const context = auth();
    context.login.mockResolvedValue({
      success: false,
      error: 'Invalid email or password',
    });
    const { renderer } = await render(LoginScreen, context);
    await type(renderer, 'Email', 'a@b.co');
    await type(renderer, 'Password', 'x');
    await press(renderer, 'Log in');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Login failed',
      'Invalid email or password',
    );
    expect(shownText(renderer)).not.toContain("Your email isn't verified yet.");
  });

  test('after "please verify" (403): the notice and Resend, which uses the email; changing the email hides them', async () => {
    const context = auth();
    context.login.mockResolvedValue({
      success: false,
      error: 'Please verify your email before logging in.',
      needsVerification: true,
    });
    const { renderer } = await render(LoginScreen, context);
    await type(renderer, 'Email', ' new@b.co ');
    await type(renderer, 'Password', 'x');
    await press(renderer, 'Log in');

    expect(shownText(renderer)).toContain("Your email isn't verified yet.");
    await press(renderer, 'Resend verification email');
    expect(context.resendVerification).toHaveBeenCalledWith('new@b.co');
    expect(Alert.alert).toHaveBeenLastCalledWith('Email sent', 'Sent');

    await type(renderer, 'Email', 'other@b.co');
    expect(shownText(renderer)).not.toContain("Your email isn't verified yet.");
  });

  test('a double tap on Log in sends only one request', async () => {
    const context = auth();
    let finish;
    context.login.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { renderer } = await render(LoginScreen, context);
    await type(renderer, 'Email', 'a@b.co');
    await type(renderer, 'Password', 'x');
    const button = tappable(renderer, 'Log in');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(context.login).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
  });
});

describe('Role selection', () => {
  test('each card opens its sign-up form; the back link goes back', async () => {
    const { renderer, navigation } = await render(RoleSelectionScreen);
    expect(shownText(renderer)).toContain('Create an account');
    await press(renderer, "I'm a player. Join and run teams, and find venues.");
    expect(navigation.navigate).toHaveBeenCalledWith('PlayerRegister');
    await press(
      renderer,
      'I run a venue. List your indoor venue so players can find it.',
    );
    expect(navigation.navigate).toHaveBeenCalledWith('OwnerRegister');
    await press(renderer, 'Back to Log in');
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('Forgot password', () => {
  test('an empty email shows its error and nothing is sent', async () => {
    const { renderer } = await render(ForgotPasswordScreen);
    await press(renderer, 'Send reset link');
    expect(shownText(renderer)).toContain('Email is required');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('sends the trimmed email, then shows the confirmation instead of the form (no alert)', async () => {
    api.post.mockResolvedValue({ data: { message: 'ok' } });
    const { renderer, navigation } = await render(ForgotPasswordScreen);
    await type(renderer, 'Email', ' me@gmail.com ');
    await press(renderer, 'Send reset link');

    expect(api.post).toHaveBeenCalledWith('/auth/forgot', {
      email: 'me@gmail.com',
    });
    expect(shownText(renderer)).toContain(RESET_SENT_TEXT);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(Alert.alert).not.toHaveBeenCalled();
    await press(renderer, 'Back to log in');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test("a refusal shows the backend's message and keeps the form", async () => {
    api.post.mockRejectedValue(
      httpError(
        429,
        'Too many password reset requests. Please try again in an hour.',
      ),
    );
    const { renderer } = await render(ForgotPasswordScreen);
    await type(renderer, 'Email', 'me@gmail.com');
    await press(renderer, 'Send reset link');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not sent',
      'Too many password reset requests. Please try again in an hour.',
    );
    expect(field(renderer, 'Email')).toBeDefined();
  });

  test('a double tap sends only one request', async () => {
    let finish;
    api.post.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { renderer } = await render(ForgotPasswordScreen);
    await type(renderer, 'Email', 'me@gmail.com');
    const button = tappable(renderer, 'Send reset link');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: {} }));
  });
});
