/* eslint-env jest */
// Tests for the development-only "Quick login" row on the Login screen
// (src/screens/Dev/QuickLogin.js; temporary, removed before release: ROADMAP.md,
// Phase 5). Jest runs with __DEV__ true, so the row is there. That it's left out of
// release builds is checked by bundling, not here (docs/TECHNICAL.md, 8.8).

import React from 'react';
import { Alert, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import LoginScreen from '../src/screens/Auth/LoginScreen';
import { QUICK_LOGINS } from '../src/screens/Dev/QuickLogin';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);

async function render(login) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ login, resendVerification: jest.fn() }}>
          <LoginScreen navigation={{ navigate: jest.fn() }} />
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  return renderer;
}

const button = (renderer, label) =>
  renderer.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('four buttons, under a "development only" line', async () => {
  const renderer = await render(jest.fn());
  const texts = renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''));

  expect(texts).toContain('Quick login (development only)');
  expect(QUICK_LOGINS.map(account => account.label)).toEqual([
    'Player A',
    'Player B',
    'Venue owner',
    'Admin',
  ]);
  for (const { label } of QUICK_LOGINS) {
    expect(button(renderer, `Quick login as ${label}`)).toBeTruthy();
  }
});

test.each([
  ['Player A', 'aa'],
  ['Player B', 'ab'],
  ['Venue owner', 'bb'],
  ['Admin', 'ad'],
])(
  '%s logs in as "%s" with the same password, once on a double tap',
  async (label, email) => {
    let finish;
    const login = jest.fn(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const renderer = await render(login);
    const tap = button(renderer, `Quick login as ${label}`);

    await act(async () => {
      tap.props.onPress();
      tap.props.onPress();
    });
    await act(async () => finish({ success: true }));

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith(email, email);
    expect(Alert.alert).not.toHaveBeenCalled();
  },
);

test('a refusal (the accounts were never created) says so, with the script to run', async () => {
  const login = jest
    .fn()
    .mockResolvedValue({ success: false, error: 'Invalid email or password' });
  const renderer = await render(login);

  await act(async () =>
    button(renderer, 'Quick login as Player A').props.onPress(),
  );

  expect(Alert.alert).toHaveBeenCalledWith(
    'Quick login failed',
    'Invalid email or password\n\nRun node scripts/seedDevAccounts.js in backend/.',
  );
});
