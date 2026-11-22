/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are never opened */
// Tests for the venue owner's My Venue, Edit venue and Profile tab (feature 2,
// docs/features/profiles-and-registration.md, section e, and the venues feature,
// docs/features/venues.md, sections e and h): what My Venue shows (the review status,
// the admin's note and the checklist while pending, "Not added", and the website as a
// link only when it passes isWebLink), and Edit venue's checks and request (every field
// each time, empty ones as null).

import React from 'react';
import { Alert, Linking, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import MyVenueScreen, {
  CHECKLIST_COMPLETE,
  CHECKLIST_TITLE,
  NOTE_TITLE,
} from '../src/screens/Owner/MyVenueScreen';
import { ListRow } from '../src/components/ui';
import EditVenueScreen, {
  OPENING_HOURS_HELPER,
  PRICING_INFO_HELPER,
  VENUE_AREA_HELPER,
} from '../src/screens/Owner/EditVenueScreen';
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

// A new owner after the short sign-up: only the venue name, pending review.
const NEW_OWNER = {
  id: 20,
  email: 'arena@gmail.com',
  role: 'OWNER',
  createdAt: '2026-11-22T10:00:00.000Z',
  ownerProfile: {
    indoorName: 'Floodlight Arena',
    phone: null,
    address: null,
    area: null,
    website: null,
    description: null,
    openingHours: null,
    pricingInfo: null,
    approvedAt: null,
    reviewNote: null,
    missingFields: ['address', 'area', 'phone'],
  },
};

// A complete venue the admin has approved (live).
const FILLED = {
  ...NEW_OWNER,
  ownerProfile: {
    indoorName: 'Floodlight Arena',
    phone: '01712345678',
    address: 'Road 5, Dhanmondi',
    area: 'Dhanmondi 27',
    website: 'https://floodlight.example.com',
    description: 'Two indoor pitches.',
    openingHours: 'Sat–Thu 8am–2am\nFri 2pm–2am',
    pricingInfo: '৳2,000 per hour',
    approvedAt: '2026-11-23T09:00:00.000Z',
    reviewNote: null,
    missingFields: [],
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

  // The listing rows as [icon, name, meta], in order (a website that is a link is drawn
  // apart, so it isn't a ListRow).
  const listingRows = renderer =>
    renderer.root
      .findAllByType(ListRow)
      .filter(row => row.props.meta !== undefined)
      .map(row => [row.props.icon, row.props.name, row.props.meta]);

  test('loads GET /owners/me and shows the venue name and every listing row', async () => {
    const { renderer } = await showMyVenue();
    expect(api.get).toHaveBeenCalledWith('/owners/me');
    const text = shownText(renderer);
    for (const shown of [
      'My Venue',
      'Floodlight Arena',
      'Listing',
      'Website',
      'https://floodlight.example.com',
    ]) {
      expect(text).toContain(shown);
    }
    expect(listingRows(renderer)).toEqual([
      ['phone', 'Phone', '01712345678'],
      ['area', 'Address', 'Road 5, Dhanmondi'],
      ['area', 'Area', 'Dhanmondi 27'],
      ['time', 'Opening hours', 'Sat–Thu 8am–2am\nFri 2pm–2am'],
      ['price', 'Pricing info', '৳2,000 per hour'],
      ['description', 'Description', 'Two indoor pitches.'],
    ]);
    expect(text).not.toContain(NOT_ADDED);
  });

  test('a new owner (short sign-up) sees "Not added" on all seven rows, in order', async () => {
    const { renderer } = await showMyVenue(NEW_OWNER);
    const text = shownText(renderer);
    expect(text).toContain('Floodlight Arena');
    expect(text.split(NOT_ADDED).length - 1).toBe(7);
    expect(listingRows(renderer).map(([, name, meta]) => [name, meta])).toEqual(
      [
        ['Phone', NOT_ADDED],
        ['Address', NOT_ADDED],
        ['Area', NOT_ADDED],
        ['Website', NOT_ADDED],
        ['Opening hours', NOT_ADDED],
        ['Pricing info', NOT_ADDED],
        ['Description', NOT_ADDED],
      ],
    );
  });

  // The checklist rows as [name, "Added" | "Missing"].
  const checklist = renderer =>
    renderer.root
      .findAllByType(ListRow)
      .filter(row => row.props.trailing)
      .map(row => {
        const words = row
          .findAllByType(NativeText)
          .map(node => [].concat(node.props.children).join(''));
        return [row.props.name, words[words.length - 1]];
      });

  const pillVariant = (renderer, label) =>
    renderer.root.find(
      node => node.props.label === label && node.props.variant !== undefined,
    ).props.variant;

  test('a live venue shows the strong "Live" pill, no checklist and no note', async () => {
    const { renderer } = await showMyVenue(
      withVenue({ reviewNote: 'An old note' }),
    );
    const text = shownText(renderer);
    expect(text).toContain('Live');
    expect(pillVariant(renderer, 'Live')).toBe('strong');
    expect(text).not.toContain('Pending review');
    expect(text).not.toContain(CHECKLIST_TITLE);
    expect(text).not.toContain(NOTE_TITLE);
    expect(text).not.toContain('An old note');
    expect(checklist(renderer)).toEqual([]);
  });

  test('a new pending venue shows the soft "Pending review" pill and three "Missing"', async () => {
    const { renderer } = await showMyVenue(NEW_OWNER);
    const text = shownText(renderer);
    expect(text).toContain('Pending review');
    expect(pillVariant(renderer, 'Pending review')).toBe('soft');
    expect(text).toContain(CHECKLIST_TITLE);
    expect(text).not.toContain(CHECKLIST_COMPLETE);
    expect(text).not.toContain(NOTE_TITLE);
    expect(checklist(renderer)).toEqual([
      ['Address', 'Missing'],
      ['Area', 'Missing'],
      ['Phone', 'Missing'],
    ]);
  });

  test('the checklist follows missingFields', async () => {
    const { renderer } = await showMyVenue(
      withVenue({ approvedAt: null, area: null, missingFields: ['area'] }),
    );
    expect(checklist(renderer)).toEqual([
      ['Address', 'Added'],
      ['Area', 'Missing'],
      ['Phone', 'Added'],
    ]);
    expect(shownText(renderer)).not.toContain(CHECKLIST_COMPLETE);
  });

  test('a complete pending venue: all three "Added" and "The admin will review it soon."', async () => {
    const { renderer } = await showMyVenue(withVenue({ approvedAt: null }));
    expect(checklist(renderer)).toEqual([
      ['Address', 'Added'],
      ['Area', 'Added'],
      ['Phone', 'Added'],
    ]);
    expect(shownText(renderer)).toContain(CHECKLIST_COMPLETE);
    expect(shownText(renderer)).toContain('Pending review');
  });

  test("the admin's note shows in its own card while pending, above the checklist", async () => {
    const { renderer } = await showMyVenue({
      ...NEW_OWNER,
      ownerProfile: {
        ...NEW_OWNER.ownerProfile,
        reviewNote: 'Please add the road number',
      },
    });
    const text = shownText(renderer);
    expect(text).toContain(NOTE_TITLE);
    expect(text).toContain('Please add the road number');
    expect(text.indexOf(NOTE_TITLE)).toBeLessThan(
      text.indexOf(CHECKLIST_TITLE),
    );
    expect(text.indexOf(CHECKLIST_TITLE)).toBeLessThan(text.indexOf('Listing'));
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

  // A complete venue still waiting for the admin: every field may be emptied.
  const PENDING_FILLED = withVenue({ approvedAt: null });

  const labels = renderer =>
    renderer.root
      .findAllByType(TextInput)
      .map(node => node.props.accessibilityLabel);

  test('filled in from GET /owners/me, in the spec order, with the helpers', async () => {
    const { renderer } = await showForm();
    expect(api.get).toHaveBeenCalledWith('/owners/me');
    // A live venue: Area, Address and Phone can't be emptied, so no "(optional)".
    expect(labels(renderer)).toEqual([
      'Venue name',
      'Area',
      'Address',
      'Phone',
      'Website (optional)',
      'Opening hours (optional)',
      'Pricing info (optional)',
      'Description (optional)',
    ]);
    const values = {
      'Venue name': 'Floodlight Arena',
      Area: 'Dhanmondi 27',
      Address: 'Road 5, Dhanmondi',
      Phone: '01712345678',
      'Website (optional)': 'https://floodlight.example.com',
      'Opening hours (optional)': 'Sat–Thu 8am–2am\nFri 2pm–2am',
      'Pricing info (optional)': '৳2,000 per hour',
      'Description (optional)': 'Two indoor pitches.',
    };
    for (const [label, value] of Object.entries(values)) {
      expect([label, input(renderer, label).props.value]).toEqual([
        label,
        value,
      ]);
    }
    expect(input(renderer, 'Opening hours (optional)').props.multiline).toBe(
      true,
    );
    expect(input(renderer, 'Pricing info (optional)').props.multiline).toBe(
      true,
    );
    const text = shownText(renderer);
    expect(text).toContain(VENUE_AREA_HELPER);
    expect(text).toContain(OPENING_HOURS_HELPER);
    expect(text).toContain(PRICING_INFO_HELPER);
    expect(text).toContain('19 / 500 characters');
    await type(renderer, 'Description (optional)', 'ঢাকা');
    expect(shownText(renderer)).toContain('4 / 500 characters');
  });

  test('a pending venue labels Area, Address and Phone "(optional)"', async () => {
    const { renderer } = await showForm(NEW_OWNER);
    expect(labels(renderer)).toEqual([
      'Venue name',
      'Area (optional)',
      'Address (optional)',
      'Phone (optional)',
      'Website (optional)',
      'Opening hours (optional)',
      'Pricing info (optional)',
      'Description (optional)',
    ]);
  });

  test('the back link says where it goes: My Venue, or Settings when opened from there', async () => {
    const fromMyVenue = await showForm();
    expect(tappable(fromMyVenue.renderer, 'Back to My Venue')).toBeDefined();
    await press(fromMyVenue.renderer, 'Back to My Venue');
    expect(fromMyVenue.navigation.goBack).toHaveBeenCalled();

    const fromSettings = await showForm(FILLED, { from: 'Settings' });
    expect(tappable(fromSettings.renderer, 'Back to Settings')).toBeDefined();
  });

  test('"dhan" in Area suggests Dhanmondi; tapping it fills the field', async () => {
    const { renderer } = await showForm(NEW_OWNER);
    await act(async () => input(renderer, 'Area (optional)').props.onFocus());
    await type(renderer, 'Area (optional)', 'dhan');
    expect(shownText(renderer)).toContain('Dhanmondi');
    await press(renderer, 'Suggestion: Dhanmondi');
    expect(input(renderer, 'Area (optional)').props.value).toBe('Dhanmondi');
  });

  test('sends every field, tidied: a +88 phone, the area spaces, trimmed texts with their line breaks', async () => {
    api.patch.mockResolvedValue({
      data: withVenue({ indoorName: 'New Arena' }),
    });
    const { renderer, navigation, setUser } = await showForm(NEW_OWNER);
    await type(renderer, 'Venue name', '  New Arena ');
    await type(renderer, 'Area (optional)', '  dhanmondi   27 ');
    await type(renderer, 'Address (optional)', '  Road 5  ');
    await type(renderer, 'Phone (optional)', '+88 01712-345 678');
    await type(renderer, 'Website (optional)', ' HTTPS://Arena.example.com ');
    await type(
      renderer,
      'Opening hours (optional)',
      ' Sat–Thu 8am–2am\nFri 2pm–2am \n',
    );
    await type(renderer, 'Pricing info (optional)', ' ৳2,000 per hour ');
    await type(renderer, 'Description (optional)', ' Hi ');
    await press(renderer, 'Save changes');

    expect(api.patch).toHaveBeenCalledWith('/owners/me', {
      indoorName: 'New Arena',
      phone: '01712345678',
      address: 'Road 5',
      area: 'dhanmondi 27',
      website: 'HTTPS://Arena.example.com',
      openingHours: 'Sat–Thu 8am–2am\nFri 2pm–2am',
      pricingInfo: '৳2,000 per hour',
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

  test('a pending venue can clear every optional field: all sent as null', async () => {
    api.patch.mockResolvedValue({ data: NEW_OWNER });
    const { renderer } = await showForm(PENDING_FILLED);
    for (const label of [
      'Area (optional)',
      'Address (optional)',
      'Phone (optional)',
      'Website (optional)',
      'Opening hours (optional)',
      'Pricing info (optional)',
      'Description (optional)',
    ]) {
      await type(renderer, label, '   ');
    }
    await press(renderer, 'Save changes');
    expect(api.patch).toHaveBeenCalledWith('/owners/me', {
      indoorName: 'Floodlight Arena',
      phone: null,
      address: null,
      area: null,
      website: null,
      openingHours: null,
      pricingInfo: null,
      description: null,
    });
  });

  test('a live venue refuses to empty its phone, before sending', async () => {
    const { renderer, navigation } = await showForm();
    await type(renderer, 'Phone', '  ');
    await press(renderer, 'Save changes');
    expect(api.patch).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    const text = shownText(renderer);
    expect(text).toContain('A live venue needs a phone number');
    expect(text).not.toContain('A live venue needs an address');
    expect(text).not.toContain('A live venue needs an area');

    // Typing in the field clears the message; another edit saves and stays live.
    await type(renderer, 'Phone', '01712345678');
    expect(shownText(renderer)).not.toContain(
      'A live venue needs a phone number',
    );
    api.patch.mockResolvedValue({ data: FILLED });
    await type(renderer, 'Opening hours (optional)', 'Every day 9am–1am');
    await press(renderer, 'Save changes');
    expect(api.patch).toHaveBeenCalledWith(
      '/owners/me',
      expect.objectContaining({
        phone: '01712345678',
        openingHours: 'Every day 9am–1am',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('a live venue emptying address, area and phone gets all three messages under the fields', async () => {
    const { renderer } = await showForm();
    await type(renderer, 'Area', ' ');
    await type(renderer, 'Address', '');
    await type(renderer, 'Phone', '');
    await press(renderer, 'Save changes');
    expect(api.patch).not.toHaveBeenCalled();
    const text = shownText(renderer);
    expect(text).toContain('A live venue needs an address');
    expect(text).toContain('A live venue needs an area');
    expect(text).toContain('A live venue needs a phone number');
  });

  test('the new limits are caught before sending: area 2–40, opening hours and pricing info 120', async () => {
    const { renderer } = await showForm();
    await type(renderer, 'Area', 'D');
    await type(renderer, 'Opening hours (optional)', 'h'.repeat(121));
    await type(renderer, 'Pricing info (optional)', '৳'.repeat(121));
    await press(renderer, 'Save changes');
    expect(api.patch).not.toHaveBeenCalled();
    const text = shownText(renderer);
    expect(text).toContain('Area must be between 2 and 40 characters');
    expect(text).toContain('Opening hours must be at most 120 characters');
    expect(text).toContain('Pricing info must be at most 120 characters');
  });

  test('a wrong phone, a website without http(s) and a blank name are caught before sending', async () => {
    const { renderer, navigation } = await showForm();
    await type(renderer, 'Venue name', ' ');
    await type(renderer, 'Phone', '01212345678');
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
    api.patch.mockRejectedValue(httpError(400, 'A live venue needs an area'));
    // The venue went live after the form was opened: the backend still refuses.
    const { renderer, navigation } = await showForm(
      withVenue({ approvedAt: null, area: null, missingFields: ['area'] }),
    );
    await press(renderer, 'Save changes');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not saved',
      'A live venue needs an area',
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
    area: '',
    website: '',
    openingHours: '',
    pricingInfo: '',
    description: '',
  };
  const complete = {
    ...good,
    phone: '01712345678',
    address: 'Road 5',
    area: 'Dhanmondi',
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

  test('the body has every field, empty optional ones as null', () => {
    expect(checkVenueEdit(good).body).toEqual({
      indoorName: 'Arena',
      phone: null,
      address: null,
      area: null,
      website: null,
      openingHours: null,
      pricingInfo: null,
      description: null,
    });
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

  test('the area follows the player Area rules: tidied, 2–40 characters, blank is null', () => {
    const tidied = checkVenueEdit({ ...good, area: '  dhanmondi \t  27 ' });
    expect(tidied.ok).toBe(true);
    expect(tidied.body.area).toBe('dhanmondi 27');
    expect(checkVenueEdit({ ...good, area: '   ' }).body.area).toBeNull();
    expect(checkVenueEdit({ ...good, area: 'ধা' }).ok).toBe(true);
    expect(checkVenueEdit({ ...good, area: 'ঢ'.repeat(40) }).ok).toBe(true);
    for (const area of ['D', ' D ', 'a'.repeat(41)]) {
      expect([area, checkVenueEdit({ ...good, area }).errors.area]).toEqual([
        area,
        'Area must be between 2 and 40 characters',
      ]);
    }
  });

  test('opening hours and pricing info: at most 120 characters, trimmed, line breaks kept', () => {
    const fine = checkVenueEdit({
      ...good,
      openingHours: ` ${'h'.repeat(60)}\n${'f'.repeat(59)} \n`,
      pricingInfo: '৳'.repeat(120),
    });
    expect(fine.ok).toBe(true);
    expect(fine.body.openingHours).toBe(`${'h'.repeat(60)}\n${'f'.repeat(59)}`);
    expect(fine.body.pricingInfo).toBe('৳'.repeat(120));
    const over = checkVenueEdit({
      ...good,
      openingHours: 'h'.repeat(121),
      pricingInfo: '৳'.repeat(121),
    }).errors;
    expect(over.openingHours).toBe(
      'Opening hours must be at most 120 characters',
    );
    expect(over.pricingInfo).toBe(
      'Pricing info must be at most 120 characters',
    );
  });

  test('a live venue can keep or change its address, area and phone', () => {
    expect(checkVenueEdit(complete, { live: true }).ok).toBe(true);
    expect(
      checkVenueEdit(
        { ...complete, phone: '+8801812345678', area: 'Mirpur 10' },
        { live: true },
      ).ok,
    ).toBe(true);
  });

  test('a live venue gets "A live venue needs…" for each field it empties (spaces count as empty)', () => {
    const one = checkVenueEdit({ ...complete, phone: ' - ' }, { live: true });
    expect(one.ok).toBe(false);
    expect(one.errors).toMatchObject({
      phone: 'A live venue needs a phone number',
      address: null,
      area: null,
    });
    const all = checkVenueEdit(
      { ...complete, address: '  ', area: ' \t ', phone: '' },
      { live: true },
    ).errors;
    expect([all.address, all.area, all.phone]).toEqual([
      'A live venue needs an address',
      'A live venue needs an area',
      'A live venue needs a phone number',
    ]);
  });

  test('a pending venue (the default) may empty them', () => {
    expect(
      checkVenueEdit({ ...complete, address: '', area: '', phone: '' }).ok,
    ).toBe(true);
    expect(
      checkVenueEdit(
        { ...complete, address: '', area: '', phone: '' },
        { live: false },
      ).ok,
    ).toBe(true);
  });

  test('descriptionCount counts the trimmed text in characters', () => {
    expect(descriptionCount('')).toBe('0 / 500 characters');
    expect(descriptionCount('  hi  ')).toBe('2 / 500 characters');
    expect(descriptionCount('😀')).toBe('1 / 500 characters');
  });
});
