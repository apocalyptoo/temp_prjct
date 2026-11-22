/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are never opened */
// Tests for the venue owner's My Venue, Edit venue and Profile tab (feature 2,
// docs/features/profiles-and-registration.md, section e): what My Venue shows (with "Not
// added", and the website as a link only when it passes isWebLink), and Edit venue's
// checks and request (every field each time, empty ones as null).

import React from 'react';
import { Alert, Linking, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import MyVenueScreen from '../src/screens/Owner/MyVenueScreen';
import EditVenueScreen from '../src/screens/Owner/EditVenueScreen';
import OwnerProfileScreen, {
  LISTING_ROW,
  OWNER_ROLE_LABEL,
} from '../src/screens/Owner/OwnerProfileScreen';
import {
  checkVenueEdit,
  descriptionCount,
} from '../src/screens/Owner/venueChecks';
import { NOT_ADDED } from '../src/screens/Player/PlayerProfileScreen';
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

const PHONE_RULE =
  'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
const WEBSITE_RULE = 'Website must start with http:// or https://';

// A new owner after the short sign-up: only the venue name.
const NEW_OWNER = {
  id: 20,
  email: 'arena@gmail.com',
  role: 'OWNER',
  createdAt: '2026-11-22T10:00:00.000Z',
  ownerProfile: {
    indoorName: 'Floodlight Arena',
    phone: null,
    address: null,
    website: null,
    description: null,
  },
};

const FILLED = {
  ...NEW_OWNER,
  ownerProfile: {
    indoorName: 'Floodlight Arena',
    phone: '01712345678',
    address: 'Road 5, Dhanmondi',
    website: 'https://floodlight.example.com',
    description: 'Two indoor pitches.',
  },
};

const withVenue = fields => ({
  ...FILLED,
  ownerProfile: { ...FILLED.ownerProfile, ...fields },
});

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

const tappables = (renderer, label) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function' &&
      typeof node.props.onPress === 'function',
  );
const tappable = (renderer, label) => tappables(renderer, label)[0];
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
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('My Venue', () => {
  async function showMyVenue(me = FILLED) {
    api.get.mockResolvedValue({ data: me });
    const navigation = navigationMock();
    const renderer = await render(<MyVenueScreen navigation={navigation} />);
    await act(async () => navigation.focus());
    await settle();
    return { renderer, navigation };
  }

  test('loads GET /owners/me and shows the venue name and every listing row', async () => {
    const { renderer } = await showMyVenue();
    expect(api.get).toHaveBeenCalledWith('/owners/me');
    const text = shownText(renderer);
    for (const shown of [
      'My Venue',
      'Floodlight Arena',
      'Listing',
      'Phone',
      '01712345678',
      'Address',
      'Road 5, Dhanmondi',
      'Website',
      'https://floodlight.example.com',
      'Description',
      'Two indoor pitches.',
    ]) {
      expect(text).toContain(shown);
    }
    expect(text).not.toContain(NOT_ADDED);
  });

  test('a new owner (short sign-up) sees "Not added" on all four rows', async () => {
    const { renderer } = await showMyVenue(NEW_OWNER);
    const text = shownText(renderer);
    expect(text).toContain('Floodlight Arena');
    expect(text.split(NOT_ADDED).length - 1).toBe(4);
  });

  test('a valid website is a link that opens in the browser', async () => {
    const { renderer } = await showMyVenue();
    const link = tappable(renderer, 'Website, https://floodlight.example.com');
    expect(link.props.accessibilityRole).toBe('link');
    await act(async () => link.props.onPress());
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://floodlight.example.com',
    );
  });

  test('a stored website that fails isWebLink is plain text, never opened', async () => {
    const { renderer } = await showMyVenue(
      withVenue({ website: 'javascript:alert(1)' }),
    );
    expect(shownText(renderer)).toContain('javascript:alert(1)');
    expect(
      renderer.root.findAll(node => node.props.accessibilityRole === 'link'),
    ).toHaveLength(0);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test('Edit venue opens the form', async () => {
    const { renderer, navigation } = await showMyVenue();
    await press(renderer, 'Edit venue');
    expect(navigation.navigate).toHaveBeenCalledWith('EditVenue');
  });

  test('a failed first load shows the error with Try again, which loads again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const navigation = navigationMock();
    api.get.mockResolvedValue({ data: FILLED });
    const renderer = await render(<MyVenueScreen navigation={navigation} />);
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load your venue.");
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('Road 5, Dhanmondi');
  });

  test('a failed reload keeps what is shown', async () => {
    const { renderer, navigation } = await showMyVenue();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain('Road 5, Dhanmondi');
    expect(shownText(renderer)).not.toContain("Couldn't load your venue.");
  });
});

describe('Edit venue', () => {
  async function showForm(me = FILLED, params) {
    api.get.mockResolvedValue({ data: me });
    const navigation = navigationMock();
    const setUser = jest.fn();
    const renderer = await render(
      <EditVenueScreen navigation={navigation} route={{ params }} />,
      { setUser },
    );
    await settle();
    return { renderer, navigation, setUser };
  }

  test('filled in from GET /owners/me, with the description count', async () => {
    const { renderer } = await showForm();
    expect(api.get).toHaveBeenCalledWith('/owners/me');
    expect(input(renderer, 'Venue name').props.value).toBe('Floodlight Arena');
    expect(input(renderer, 'Phone (optional)').props.value).toBe('01712345678');
    expect(input(renderer, 'Address (optional)').props.value).toBe(
      'Road 5, Dhanmondi',
    );
    expect(input(renderer, 'Website (optional)').props.value).toBe(
      'https://floodlight.example.com',
    );
    expect(input(renderer, 'Description (optional)').props.value).toBe(
      'Two indoor pitches.',
    );
    expect(shownText(renderer)).toContain('19 / 500 characters');
    await type(renderer, 'Description (optional)', 'ঢাকা');
    expect(shownText(renderer)).toContain('4 / 500 characters');
  });

  test('the back link says where it goes: My Venue, or Settings when opened from there', async () => {
    const fromMyVenue = await showForm();
    expect(tappable(fromMyVenue.renderer, 'Back to My Venue')).toBeDefined();
    await press(fromMyVenue.renderer, 'Back to My Venue');
    expect(fromMyVenue.navigation.goBack).toHaveBeenCalled();

    const fromSettings = await showForm(FILLED, { from: 'Settings' });
    expect(tappable(fromSettings.renderer, 'Back to Settings')).toBeDefined();
  });

  test('sends every field, tidied: a +88 phone with spaces, trimmed texts', async () => {
    api.patch.mockResolvedValue({
      data: withVenue({ indoorName: 'New Arena' }),
    });
    const { renderer, navigation, setUser } = await showForm(NEW_OWNER);
    await type(renderer, 'Venue name', '  New Arena ');
    await type(renderer, 'Phone (optional)', '+88 01712-345 678');
    await type(renderer, 'Address (optional)', '  Road 5  ');
    await type(renderer, 'Website (optional)', ' HTTPS://Arena.example.com ');
    await type(renderer, 'Description (optional)', ' Hi ');
    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/owners/me', {
      indoorName: 'New Arena',
      phone: '01712345678',
      address: 'Road 5',
      website: 'HTTPS://Arena.example.com',
      description: 'Hi',
    });
    expect(navigation.goBack).toHaveBeenCalled();
    // The app's user name (the venue name) is updated.
    const update = setUser.mock.calls[0][0];
    expect(update({ id: 20, name: 'Floodlight Arena' })).toEqual({
      id: 20,
      name: 'New Arena',
    });
    expect(update(null)).toBeNull();
  });

  test('clearing the optional fields sends them as null', async () => {
    api.patch.mockResolvedValue({ data: NEW_OWNER });
    const { renderer } = await showForm();
    for (const label of [
      'Phone (optional)',
      'Address (optional)',
      'Website (optional)',
      'Description (optional)',
    ]) {
      await type(renderer, label, '   ');
    }
    await press(renderer, 'Save changes');
    expect(api.patch).toHaveBeenCalledWith('/owners/me', {
      indoorName: 'Floodlight Arena',
      phone: null,
      address: null,
      website: null,
      description: null,
    });
  });

  test('a wrong phone, a website without http(s) and a blank name are caught before sending', async () => {
    const { renderer, navigation } = await showForm();
    await type(renderer, 'Venue name', ' ');
    await type(renderer, 'Phone (optional)', '01212345678');
    await type(renderer, 'Website (optional)', 'arena.com');
    await press(renderer, 'Save changes');
    expect(api.patch).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    const text = shownText(renderer);
    expect(text).toContain('Venue name is required');
    expect(text).toContain(PHONE_RULE);
    expect(text).toContain(WEBSITE_RULE);

    // Changing a field clears its error.
    await type(renderer, 'Website (optional)', 'https://arena.com');
    expect(shownText(renderer)).not.toContain(WEBSITE_RULE);
  });

  test("the backend's refusal shows in an alert and the form stays", async () => {
    api.patch.mockRejectedValue(
      httpError(400, 'Address must be at most 200 characters'),
    );
    const { renderer, navigation } = await showForm();
    await press(renderer, 'Save changes');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not saved',
      'Address must be at most 200 characters',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
    // The button works again for another try.
    api.patch.mockResolvedValue({ data: FILLED });
    await press(renderer, 'Save changes');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('Save changes shows its loading state, and a double tap sends one request', async () => {
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
    expect(
      renderer.root.findAll(
        node =>
          node.props.accessibilityLabel === 'Save changes' &&
          node.props.accessibilityState?.busy === true,
      ).length,
    ).toBeGreaterThan(0);
    await act(async () => finish({ data: FILLED }));
  });

  test('a failed load shows the error with Try again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const renderer = await render(
      <EditVenueScreen navigation={navigationMock()} route={{}} />,
      { setUser: jest.fn() },
    );
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load your venue.");
    api.get.mockResolvedValue({ data: FILLED });
    await press(renderer, 'Try again');
    expect(input(renderer, 'Venue name').props.value).toBe('Floodlight Arena');
  });
});

describe('Owner Profile tab', () => {
  async function showProfile(me = NEW_OWNER) {
    api.get.mockResolvedValue({ data: me });
    const navigation = navigationMock();
    const renderer = await render(
      <OwnerProfileScreen navigation={navigation} />,
    );
    await act(async () => navigation.focus());
    await settle();
    return { renderer, navigation };
  }

  test('shows the account: venue name, "Venue owner", and the email with its hints', async () => {
    const { renderer } = await showProfile();
    expect(api.get).toHaveBeenCalledWith('/owners/me');
    const text = shownText(renderer);
    for (const shown of [
      'Profile',
      'Floodlight Arena',
      OWNER_ROLE_LABEL,
      'Email',
      'arena@gmail.com',
      "Only you can see this. Email can't be changed yet.",
      LISTING_ROW,
    ]) {
      expect(text).toContain(shown);
    }
    // The initials of the venue name.
    expect(text).toContain('FA');
    // The listing itself lives on My Venue, not here.
    expect(text).not.toContain('Not added');
  });

  test('the gear opens Settings; "Your venue listing" opens the My Venue tab', async () => {
    const { renderer, navigation } = await showProfile();
    await press(renderer, 'Settings');
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
    await press(renderer, LISTING_ROW);
    expect(navigation.navigate).toHaveBeenCalledWith('MyVenueTab', {
      screen: 'MyVenue',
    });
  });

  test('a failed first load shows the error with Try again, which loads again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const navigation = navigationMock();
    api.get.mockResolvedValue({ data: NEW_OWNER });
    const renderer = await render(
      <OwnerProfileScreen navigation={navigation} />,
    );
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain("Couldn't load your profile.");
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('arena@gmail.com');
  });

  test('a renamed venue shows when the tab comes back into view', async () => {
    const { renderer, navigation } = await showProfile();
    api.get.mockResolvedValue({
      data: {
        ...NEW_OWNER,
        ownerProfile: { ...NEW_OWNER.ownerProfile, indoorName: 'New Name' },
      },
    });
    await act(async () => navigation.focus());
    await settle();
    expect(shownText(renderer)).toContain('New Name');
  });
});

describe('checkVenueEdit', () => {
  const good = {
    indoorName: 'Arena',
    phone: '',
    address: '',
    website: '',
    description: '',
  };

  test('only the venue name is required', () => {
    expect(checkVenueEdit(good).ok).toBe(true);
    expect(checkVenueEdit({ ...good, indoorName: '' }).errors.indoorName).toBe(
      'Venue name is required',
    );
    expect(checkVenueEdit({ ...good, indoorName: 'A' }).errors.indoorName).toBe(
      'Venue name must be between 2 and 60 characters',
    );
    expect(
      checkVenueEdit({ ...good, indoorName: 'v'.repeat(61) }).errors.indoorName,
    ).toBe('Venue name must be between 2 and 60 characters');
  });

  test('the phone rule applies only when a phone is given; +88 and dashes are tidied', () => {
    for (const phone of ['01712345678', '+8801712345678', '01712-345 678']) {
      const { ok, body } = checkVenueEdit({ ...good, phone });
      expect([phone, ok, body.phone]).toEqual([phone, true, '01712345678']);
    }
    for (const phone of [
      '01212345678',
      '0171234567',
      '+8801212345678',
      'abc',
    ]) {
      expect([phone, checkVenueEdit({ ...good, phone }).errors.phone]).toEqual([
        phone,
        PHONE_RULE,
      ]);
    }
  });

  test('the website must pass isWebLink, and be at most 200 characters', () => {
    for (const website of [
      'arena.com',
      'www.arena.com',
      'javascript:alert(1)',
      'mailto:a@b.com',
      'https://',
    ]) {
      expect([
        website,
        checkVenueEdit({ ...good, website }).errors.website,
      ]).toEqual([website, WEBSITE_RULE]);
    }
    expect(
      checkVenueEdit({ ...good, website: 'https://' + 'w'.repeat(193) }).errors
        .website,
    ).toBe('Website must be at most 200 characters');
    expect(
      checkVenueEdit({ ...good, website: 'https://' + 'w'.repeat(192) }).ok,
    ).toBe(true);
  });

  test('address 200 and description 500 at most, Bangla counted as one each', () => {
    expect(
      checkVenueEdit({
        ...good,
        address: 'ঢ'.repeat(200),
        description: 'd'.repeat(500),
      }).ok,
    ).toBe(true);
    const over = checkVenueEdit({
      ...good,
      address: 'a'.repeat(201),
      description: 'd'.repeat(501),
    }).errors;
    expect(over.address).toBe('Address must be at most 200 characters');
    expect(over.description).toBe('Description must be at most 500 characters');
  });

  test('descriptionCount counts the trimmed text in characters', () => {
    expect(descriptionCount('')).toBe('0 / 500 characters');
    expect(descriptionCount('  hi  ')).toBe('2 / 500 characters');
    expect(descriptionCount('😀')).toBe('1 / 500 characters');
  });
});
