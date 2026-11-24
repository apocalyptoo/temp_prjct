/* eslint-env jest */
// Tests for the rebuilt sign-up forms and the new Check your email screen (feature 2,
// docs/features/profiles-and-registration.md, section e): errors before sending, the
// exact request (tidied phone, the position, acceptedTerms only when ticked), where the
// app goes afterwards, the Terms links, a double tap, and AuthContext's register.

import React, { useContext } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Text as NativeText,
  TextInput,
  View,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext, AuthProvider } from '../src/contexts/AuthContext';
import PlayerRegisterScreen from '../src/screens/Auth/PlayerRegisterScreen';
import OwnerRegisterScreen from '../src/screens/Auth/OwnerRegisterScreen';
import CheckEmailScreen, {
  SEND_FAILED_TEXT,
  sentText,
} from '../src/screens/Auth/CheckEmailScreen';
import { SEND_FAILED_MESSAGE } from '../src/screens/Auth/signUpCommon';
import api, { API_URL } from '../src/api/api';

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

async function render(element, auth = {}) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={auth}>{element}</AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  return renderer;
}

const navigationMock = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
});

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

const TERMS = 'I agree to the Terms of Use and Privacy Policy.';

const OK_REPLY = {
  message:
    'Registration successful. Please check your email to verify your account.',
  userId: 7,
};

async function fillPlayer(renderer, { phone = '+880 1712-345678' } = {}) {
  await type(renderer, 'Name', '  Rahim Uddin ');
  await type(renderer, 'Email', ' me+player@gmail.com ');
  await type(renderer, 'Phone', phone);
  await press(renderer, 'Forward');
  await type(renderer, 'Password', 'Valid-pass-123!');
  await type(renderer, 'Confirm password', 'Valid-pass-123!');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('Player sign-up', () => {
  test('an empty form shows every field error and sends nothing', async () => {
    const register = jest.fn();
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register },
    );
    await press(renderer, 'Create account');
    const text = shownText(renderer);
    for (const message of [
      'Name is required',
      'Email is required',
      'Phone number is required',
      'Choose a position',
      'Password is required',
      'Confirm your password',
      'Please accept the Terms of Use and Privacy Policy',
    ]) {
      expect(text).toContain(message);
    }
    expect(register).not.toHaveBeenCalled();
  });

  test('without ticking Terms nothing is sent, and ticking clears the error', async () => {
    const register = jest.fn();
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register },
    );
    await fillPlayer(renderer);
    await press(renderer, 'Create account');
    expect(register).not.toHaveBeenCalled();
    expect(shownText(renderer)).toContain(
      'Please accept the Terms of Use and Privacy Policy',
    );
    await press(renderer, TERMS);
    expect(shownText(renderer)).not.toContain(
      'Please accept the Terms of Use and Privacy Policy',
    );
  });

  test('sends the short form: trimmed name and email, tidied phone, the position, acceptedTerms true', async () => {
    const register = jest.fn().mockResolvedValue(OK_REPLY);
    const navigation = navigationMock();
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigation} />,
      { register },
    );
    await fillPlayer(renderer);
    await press(renderer, TERMS);
    await press(renderer, 'Create account');

    expect(register).toHaveBeenCalledWith({
      name: 'Rahim Uddin',
      email: 'me+player@gmail.com',
      password: 'Valid-pass-123!',
      role: 'PLAYER',
      profileData: { phone: '01712345678', position: 'Forward' },
      acceptedTerms: true,
    });
    // Check your email takes the form's place, with Log in underneath.
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Login' },
        {
          name: 'CheckEmail',
          params: { email: 'me+player@gmail.com', sendFailed: false },
        },
      ],
    });
  });

  test.each([['8801712345678'], ['017 1234 5678'], ['01712-345-678']])(
    'the phone "%s" is sent as 01712345678',
    async phone => {
      const register = jest.fn().mockResolvedValue(OK_REPLY);
      const renderer = await render(
        <PlayerRegisterScreen navigation={navigationMock()} />,
        { register },
      );
      await fillPlayer(renderer, { phone });
      await press(renderer, TERMS);
      await press(renderer, 'Create account');
      expect(register.mock.calls[0][0].profileData.phone).toBe('01712345678');
    },
  );

  test('a phone that is still wrong after tidying is caught before sending', async () => {
    const register = jest.fn();
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register },
    );
    await fillPlayer(renderer, { phone: '+88 01212 345678' });
    await press(renderer, TERMS);
    await press(renderer, 'Create account');
    expect(register).not.toHaveBeenCalled();
    expect(shownText(renderer)).toContain(
      'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678',
    );
  });

  test("the backend's refusal shows in an alert and the form stays", async () => {
    const register = jest
      .fn()
      .mockRejectedValue(new Error('Email already registered'));
    const navigation = navigationMock();
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigation} />,
      { register },
    );
    await fillPlayer(renderer);
    await press(renderer, TERMS);
    await press(renderer, 'Create account');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign-up failed',
      'Email already registered',
    );
    expect(navigation.reset).not.toHaveBeenCalled();
    // The button works again for a second try.
    await press(renderer, 'Create account');
    expect(register).toHaveBeenCalledTimes(2);
  });

  test('a double tap on Create account sends only one request', async () => {
    let finish;
    const register = jest.fn().mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register },
    );
    await fillPlayer(renderer);
    await press(renderer, TERMS);
    const button = tappable(renderer, 'Create account');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(register).toHaveBeenCalledTimes(1);
    await act(async () => finish(OK_REPLY));
  });

  test('the Terms and Privacy links open the backend pages without ticking the box', async () => {
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register: jest.fn() },
    );
    await press(renderer, 'Terms of Use');
    await press(renderer, 'Privacy Policy');
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/legal/terms`,
    );
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/legal/privacy`,
    );
    const box = renderer.root.find(
      node => node.props.accessibilityRole === 'checkbox',
    );
    expect(box.props.accessibilityState.checked).toBe(false);
  });

  test('a problem near the top scrolls the form up to that field', async () => {
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register: jest.fn() },
    );
    // Lay the fields out as a phone would: each wrapper reports where it sits.
    // (Only the field wrappers: their sole props are onLayout and the field itself.)
    const wrappers = renderer.root.findAll(
      node =>
        node.type === View &&
        Object.keys(node.props).sort().join() === 'children,onLayout',
    );
    expect(wrappers).toHaveLength(7);
    await act(async () =>
      wrappers.forEach((wrapper, index) =>
        wrapper.props.onLayout({
          nativeEvent: { layout: { y: 200 + index * 100 } },
        }),
      ),
    );
    const scrollView = renderer.root.findByType(ScrollView).instance;
    const scrollTo = jest.fn();
    scrollView.scrollTo = scrollTo;

    // Everything filled in except the email (the second field, at 300).
    await fillPlayer(renderer);
    await type(renderer, 'Email', '');
    await press(renderer, TERMS);
    await press(renderer, 'Create account');
    expect(scrollTo).toHaveBeenCalledWith({ y: 280, animated: true });
  });

  test('the password helper lists the symbols the backend counts', async () => {
    const renderer = await render(
      <PlayerRegisterScreen navigation={navigationMock()} />,
      { register: jest.fn() },
    );
    expect(shownText(renderer)).toContain('one of these symbols: ! @ # $');
  });
});

describe('Venue owner sign-up', () => {
  test('sends only the venue name, email, password and acceptedTerms', async () => {
    const register = jest
      .fn()
      .mockResolvedValue({ message: SEND_FAILED_MESSAGE });
    const navigation = navigationMock();
    const renderer = await render(
      <OwnerRegisterScreen navigation={navigation} />,
      { register },
    );
    expect(shownText(renderer)).toContain(
      "You'll add your venue's address, phone and other details after you log in.",
    );
    await type(renderer, 'Venue name', ' Floodlight Arena ');
    await type(renderer, 'Email', 'me+owner@gmail.com');
    await type(renderer, 'Password', 'Valid-pass-123!');
    await type(renderer, 'Confirm password', 'Valid-pass-123!');
    await press(renderer, TERMS);
    await press(renderer, 'Create account');

    expect(register).toHaveBeenCalledWith({
      email: 'me+owner@gmail.com',
      password: 'Valid-pass-123!',
      role: 'OWNER',
      profileData: { indoorName: 'Floodlight Arena' },
      acceptedTerms: true,
    });
    // The "couldn't send the email" reply is passed on to Check your email.
    expect(navigation.reset.mock.calls[0][0].routes[1].params).toEqual({
      email: 'me+owner@gmail.com',
      sendFailed: true,
    });
  });

  test('an empty form shows its errors and sends nothing', async () => {
    const register = jest.fn();
    const renderer = await render(
      <OwnerRegisterScreen navigation={navigationMock()} />,
      { register },
    );
    await press(renderer, 'Create account');
    expect(shownText(renderer)).toContain('Venue name is required');
    expect(shownText(renderer)).toContain(
      'Please accept the Terms of Use and Privacy Policy',
    );
    expect(register).not.toHaveBeenCalled();
  });
});

describe('The back link on both sign-up forms', () => {
  test.each([
    ['player', PlayerRegisterScreen],
    ['venue owner', OwnerRegisterScreen],
  ])('%s: reads just "Back" and goes back', async (_role, Screen) => {
    const navigation = navigationMock();
    const renderer = await render(<Screen navigation={navigation} />);

    expect(
      renderer.root.findAll(
        node => node.props.accessibilityLabel === 'Back to Back',
      ),
    ).toHaveLength(0);
    await press(renderer, 'Back');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('Check your email', () => {
  const screen = (params, navigation = navigationMock()) => (
    <CheckEmailScreen route={{ params }} navigation={navigation} />
  );

  test('says where the link went; Back to log in and the back link go to Login', async () => {
    const navigation = navigationMock();
    const renderer = await render(
      screen({ email: 'me@gmail.com', sendFailed: false }, navigation),
      { resendVerification: jest.fn() },
    );
    expect(shownText(renderer)).toContain(sentText('me@gmail.com'));
    await press(renderer, 'Back to log in');
    await press(renderer, 'Back to Log in');
    expect(navigation.navigate).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });

  test('when sending failed, it says so', async () => {
    const renderer = await render(
      screen({ email: 'me@gmail.com', sendFailed: true }),
      { resendVerification: jest.fn() },
    );
    expect(shownText(renderer)).toContain(SEND_FAILED_TEXT);
  });

  test('Resend sends to the same email and shows the reply as a line of text; an error is an alert', async () => {
    const resendVerification = jest.fn().mockResolvedValue({
      success: true,
      message: "If that account needs verifying, we've sent a new email.",
    });
    const renderer = await render(
      screen({ email: 'me@gmail.com', sendFailed: true }),
      { resendVerification },
    );
    await press(renderer, 'Resend email');
    expect(resendVerification).toHaveBeenCalledWith('me@gmail.com');
    expect(shownText(renderer)).toContain(
      "If that account needs verifying, we've sent a new email.",
    );
    expect(Alert.alert).not.toHaveBeenCalled();

    resendVerification.mockResolvedValue({
      success: false,
      error: 'Too many requests for a new verification email.',
    });
    await press(renderer, 'Resend email');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not sent',
      'Too many requests for a new verification email.',
    );
  });
});

describe("AuthContext's register", () => {
  // Renders the real provider and hands back its register function.
  async function realRegister() {
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
    return context.register;
  }

  test('passes acceptedTerms on exactly as given and returns the reply', async () => {
    api.post.mockResolvedValue({ data: OK_REPLY });
    const register = await realRegister();
    const body = {
      email: 'me@gmail.com',
      password: 'Valid-pass-123!',
      role: 'OWNER',
      profileData: { indoorName: 'Arena' },
      acceptedTerms: true,
    };
    await expect(register(body)).resolves.toEqual(OK_REPLY);
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      ...body,
      name: undefined,
    });
  });

  test("a refusal throws the backend's message", async () => {
    api.post.mockRejectedValue(
      Object.assign(new Error('HTTP 400'), {
        response: { status: 400, data: { error: 'Email already registered' } },
      }),
    );
    const register = await realRegister();
    await expect(register({ email: 'a@b.co' })).rejects.toThrow(
      'Email already registered',
    );
  });
});
