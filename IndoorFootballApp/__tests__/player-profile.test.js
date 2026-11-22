/* eslint-env jest */
// Tests for the player's Profile and Edit profile (feature 2,
// docs/features/profiles-and-registration.md, section e): what Profile shows (with "Not
// added" and the privacy hints), and Edit profile's checks, suggestions and request.

import React from 'react';
import { Alert, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import PlayerProfileScreen, {
  EMAIL_HINT,
  NOT_ADDED,
  PHONE_HINT,
} from '../src/screens/Player/PlayerProfileScreen';
import EditProfileScreen, {
  EMAIL_LOCKED,
} from '../src/screens/Player/EditProfileScreen';
import {
  checkProfileEdit,
  readMeasurement,
  tidyArea,
} from '../src/screens/Player/profileChecks';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  API_URL: 'https://api.example.test',
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });

const ME = {
  id: 10,
  email: 'rahim@gmail.com',
  role: 'PLAYER',
  createdAt: '2026-11-20T10:00:00.000Z',
  playerProfile: {
    name: 'Rahim Uddin',
    phone: '01712345678',
    position: 'Forward',
    height: null,
    weight: null,
    area: null,
  },
};

// A stand-in navigation that fires "focus" listeners on demand.
function navigationMock() {
  const listeners = [];
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((event, fn) => {
      if (event === 'focus') listeners.push(fn);
      return () => {};
    }),
    focus: () => listeners.forEach(fn => fn()),
  };
}

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

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

const input = (renderer, label) =>
  renderer.root.find(
    node => node.type === TextInput && node.props.accessibilityLabel === label,
  );
const type = (renderer, label, text) =>
  act(async () => input(renderer, label).props.onChangeText(text));

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('Profile', () => {
  async function showProfile(me = ME) {
    api.get.mockResolvedValue({ data: me });
    const navigation = navigationMock();
    const renderer = await render(
      <PlayerProfileScreen navigation={navigation} />,
    );
    await act(async () => navigation.focus());
    await settle();
    return { renderer, navigation };
  }

  test('loads GET /players/me and shows every detail; empty ones say "Not added"', async () => {
    const { renderer } = await showProfile();
    expect(api.get).toHaveBeenCalledWith('/players/me');
    const text = shownText(renderer);
    for (const shown of [
      'Rahim Uddin',
      'Forward',
      '01712345678',
      'rahim@gmail.com',
    ]) {
      expect(text).toContain(shown);
    }
    // Area, height and weight are empty after the short sign-up.
    expect(text.split(NOT_ADDED).length - 1).toBe(3);
  });

  test('filled-in details show with their units, and the area next to the name', async () => {
    const { renderer } = await showProfile({
      ...ME,
      playerProfile: {
        ...ME.playerProfile,
        height: 172.5,
        weight: 68,
        area: 'Dhanmondi 27',
      },
    });
    const text = shownText(renderer);
    expect(text).toContain('172.5 cm');
    expect(text).toContain('68 kg');
    expect(text.split('Dhanmondi 27').length - 1).toBe(2); // the card and the row
    expect(text).not.toContain(NOT_ADDED);
  });

  test('phone and email say who can see them', async () => {
    const { renderer } = await showProfile();
    expect(shownText(renderer)).toContain(PHONE_HINT);
    expect(shownText(renderer)).toContain(EMAIL_HINT);
  });

  test('the gear opens Settings and Edit profile opens the form', async () => {
    const { renderer, navigation } = await showProfile();
    await press(renderer, 'Settings');
    expect(navigation.navigate).toHaveBeenCalledWith('PlayerSettings');
    await press(renderer, 'Edit profile');
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');
  });

  test('a failed first load shows the error with Try again, which loads again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const navigation = navigationMock();
    const renderer = await render(
      <PlayerProfileScreen navigation={navigation} />,
    );
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load your profile.");

    api.get.mockResolvedValue({ data: ME });
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('Rahim Uddin');
  });

  test('a failed reload keeps what is shown', async () => {
    const { renderer, navigation } = await showProfile();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain('Rahim Uddin');
    expect(shownText(renderer)).not.toContain("Couldn't load");
  });
});

describe('Edit profile', () => {
  async function showForm(me = ME) {
    api.get.mockResolvedValue({ data: me });
    const navigation = navigationMock();
    const setUser = jest.fn();
    const renderer = await render(
      <EditProfileScreen navigation={navigation} />,
      { setUser },
    );
    await settle();
    return { renderer, navigation, setUser };
  }

  test('filled in from GET /players/me; the email is shown but locked', async () => {
    const { renderer } = await showForm({
      ...ME,
      playerProfile: { ...ME.playerProfile, height: 172.5, area: 'Mirpur' },
    });
    expect(input(renderer, 'Name').props.value).toBe('Rahim Uddin');
    expect(input(renderer, 'Phone').props.value).toBe('01712345678');
    expect(input(renderer, 'Area (optional)').props.value).toBe('Mirpur');
    expect(input(renderer, 'Height in cm (optional)').props.value).toBe(
      '172.5',
    );
    expect(input(renderer, 'Weight in kg (optional)').props.value).toBe('');
    const email = input(renderer, 'Email');
    expect(email.props.value).toBe('rahim@gmail.com');
    expect(email.props.editable).toBe(false);
    expect(shownText(renderer)).toContain(EMAIL_LOCKED);
  });

  test('"pur" in Area suggests Mirpur and Mohammadpur; tapping one fills the field', async () => {
    const { renderer } = await showForm();
    await act(async () => input(renderer, 'Area (optional)').props.onFocus());
    await type(renderer, 'Area (optional)', 'pur');
    expect(shownText(renderer)).toContain('Mirpur');
    expect(shownText(renderer)).toContain('Mohammadpur');
    await press(renderer, 'Suggestion: Mohammadpur');
    expect(input(renderer, 'Area (optional)').props.value).toBe('Mohammadpur');
  });

  test('sends every field, tidied: +88 phone, area spaces, a comma in the height, empty weight as null', async () => {
    api.patch.mockResolvedValue({
      data: {
        ...ME,
        playerProfile: { ...ME.playerProfile, name: 'Rahim U.' },
      },
    });
    const { renderer, navigation, setUser } = await showForm();
    await type(renderer, 'Name', ' Rahim U. ');
    await type(renderer, 'Phone', '+880 1812-345678');
    await press(renderer, 'Goalkeeper');
    await type(renderer, 'Area (optional)', '  Dhanmondi   27 ');
    await type(renderer, 'Height in cm (optional)', '172,5');
    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/players/me', {
      name: 'Rahim U.',
      phone: '01812345678',
      position: 'Goalkeeper',
      area: 'Dhanmondi 27',
      height: 172.5,
      weight: null,
    });
    // The logged-in user's name is updated, then back to Profile.
    const update = setUser.mock.calls[0][0];
    expect(update({ id: 10, name: 'Rahim Uddin' })).toEqual({
      id: 10,
      name: 'Rahim U.',
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('clearing the optional fields sends them as null', async () => {
    api.patch.mockResolvedValue({ data: ME });
    const { renderer } = await showForm({
      ...ME,
      playerProfile: {
        ...ME.playerProfile,
        height: 170,
        weight: 70,
        area: 'Mirpur',
      },
    });
    await type(renderer, 'Area (optional)', '   ');
    await type(renderer, 'Height in cm (optional)', '');
    await type(renderer, 'Weight in kg (optional)', '');
    await press(renderer, 'Save changes');
    expect(api.patch.mock.calls[0][1]).toMatchObject({
      area: null,
      height: null,
      weight: null,
    });
  });

  test('a wrong phone and an out-of-range height are caught before sending', async () => {
    const { renderer } = await showForm();
    await type(renderer, 'Phone', '01212345678');
    await type(renderer, 'Height in cm (optional)', '90');
    await type(renderer, 'Weight in kg (optional)', 'heavy');
    await press(renderer, 'Save changes');
    const text = shownText(renderer);
    expect(text).toContain(
      'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678',
    );
    expect(text).toContain('Height must be between 100 and 250 cm');
    expect(text).toContain('Weight must be a number');
    expect(api.patch).not.toHaveBeenCalled();
  });

  test("the backend's refusal shows in an alert and the form stays", async () => {
    api.patch.mockRejectedValue(
      Object.assign(new Error('HTTP 400'), {
        response: {
          status: 400,
          data: { error: 'Area must be between 2 and 40 characters' },
        },
      }),
    );
    const { renderer, navigation } = await showForm();
    await press(renderer, 'Save changes');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not saved',
      'Area must be between 2 and 40 characters',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('a double tap on Save changes sends one request', async () => {
    let finish;
    api.patch.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { renderer } = await showForm();
    const button = tappable(renderer, 'Save changes');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(api.patch).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: ME }));
  });

  test('a failed load shows the error with Try again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const renderer = await render(
      <EditProfileScreen navigation={navigationMock()} />,
      { setUser: jest.fn() },
    );
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load your profile.");
    api.get.mockResolvedValue({ data: ME });
    await press(renderer, 'Try again');
    expect(input(renderer, 'Name').props.value).toBe('Rahim Uddin');
  });
});

describe('profileChecks', () => {
  test('tidyArea trims and collapses spaces, keeping the letters', () => {
    expect(tidyArea('  dhanmondi \t 27\n DOHS ')).toBe('dhanmondi 27 DOHS');
  });

  test('readMeasurement: empty is null, a comma is a decimal point, range and number checks', () => {
    const height = { min: 100, max: 250, label: 'Height', unit: 'cm' };
    expect(readMeasurement(' ', height)).toEqual({
      value: null,
      problem: null,
    });
    expect(readMeasurement('172,5', height)).toEqual({
      value: 172.5,
      problem: null,
    });
    expect(readMeasurement('99.9', height).problem).toBe(
      'Height must be between 100 and 250 cm',
    );
    expect(readMeasurement('1.7m', height).problem).toBe(
      'Height must be a number',
    );
  });

  test('area must be 2–40 characters after tidying (Bangla counted as one each)', () => {
    const check = area =>
      checkProfileEdit({
        name: 'Rahim',
        phone: '01712345678',
        position: 'Any',
        area,
        height: '',
        weight: '',
      }).errors.area;
    expect(check(' A ')).toBe('Area must be between 2 and 40 characters');
    expect(check('র'.repeat(40))).toBeNull();
    expect(check('র'.repeat(41))).toBe(
      'Area must be between 2 and 40 characters',
    );
    expect(check('')).toBeNull();
  });
});
