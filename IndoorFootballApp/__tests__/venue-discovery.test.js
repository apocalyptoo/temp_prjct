/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are never opened */
// Tests for venue discovery (docs/features/venues.md, sections e and h): Venue detail
// and the shared venue helpers.

import React from 'react';
import { Alert, Linking, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import VenueDetailScreen, {
  GONE_MESSAGE,
} from '../src/screens/Venue/VenueDetailScreen';
import { hoursOnOneLine } from '../src/screens/Venue/venueCommon';
import { ListRow, Pill } from '../src/components/ui';
import { NOT_ADDED } from '../src/screens/Player/PlayerProfileScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  API_URL: 'https://api.example.test',
  default: { get: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
// Lets pending replies and their state updates finish (works with fake timers too).
const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
const FLOODLIGHT = {
  userId: 5,
  indoorName: 'Floodlight Arena',
  area: 'Dhanmondi 27',
  address: 'Road 5, Dhanmondi',
  phone: '01712345678',
  website: 'https://floodlight.example.com',
  description: 'Two indoor pitches.',
  openingHours: 'Sat–Thu 8am–2am\nFri 2pm–2am',
  pricingInfo: '৳2,000 per hour',
  createdAt: '2026-11-22T10:00:00.000Z',
};
// A live venue with only what makes it complete.
const KICKOFF = {
  userId: 6,
  indoorName: 'Kickoff Hub',
  area: 'Mirpur 10',
  address: 'Road 2',
  phone: '01812345678',
  website: null,
  description: null,
  openingHours: null,
  pricingInfo: null,
  createdAt: '2026-11-22T10:00:00.000Z',
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

async function render(element) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>{element}</ThemeProvider>,
    );
  });
  return renderer;
}

const shownText = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');

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
  await flush();
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

describe('hoursOnOneLine', () => {
  test('joins the lines with " · ", dropping blank ones', () => {
    expect(hoursOnOneLine('Sat–Thu 8am–2am\nFri 2pm–2am')).toBe(
      'Sat–Thu 8am–2am · Fri 2pm–2am',
    );
    expect(hoursOnOneLine(' Daily 9am–1am ')).toBe('Daily 9am–1am');
    expect(hoursOnOneLine('A\n\n  \nB')).toBe('A · B');
    expect(hoursOnOneLine(null)).toBe('');
  });
});

describe('Venue detail', () => {
  async function showDetail(reply = { data: FLOODLIGHT }, params) {
    if (reply instanceof Error) api.get.mockRejectedValue(reply);
    else api.get.mockResolvedValue(reply);
    const navigation = navigationMock();
    const renderer = await render(
      <VenueDetailScreen
        navigation={navigation}
        route={{
          params: params ?? { userId: 5, venueName: 'Floodlight Arena' },
        }}
      />,
    );
    await act(async () => navigation.focus());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    return { renderer, navigation };
  }

  const rows = renderer =>
    renderer.root
      .findAllByType(ListRow)
      .map(row => [row.props.icon, row.props.name, row.props.meta]);

  test('loads GET /owners/:userId and shows the name, the area pill and every listing row', async () => {
    const { renderer } = await showDetail();
    expect(api.get).toHaveBeenCalledWith('/owners/5');
    const text = shownText(renderer);
    expect(text).toContain('Venues'); // the back link
    expect(text).toContain('Floodlight Arena');
    expect(text).toContain('Listing');
    expect(renderer.root.findByType(Pill).props).toMatchObject({
      label: 'Dhanmondi 27',
      variant: 'soft',
    });
    // The website is drawn as a link row, between Phone and Opening hours.
    expect(rows(renderer)).toEqual([
      ['area', 'Address', 'Road 5, Dhanmondi'],
      ['phone', 'Phone', '01712345678'],
      ['time', 'Opening hours', 'Sat–Thu 8am–2am\nFri 2pm–2am'],
      ['price', 'Pricing info', '৳2,000 per hour'],
      ['description', 'Description', 'Two indoor pitches.'],
    ]);
    expect(text.indexOf('01712345678')).toBeLessThan(text.indexOf('Website'));
    expect(text.indexOf('Website')).toBeLessThan(text.indexOf('Opening hours'));
    expect(text).not.toContain(NOT_ADDED);
  });

  test('empty optional rows are left out, without "Not added"', async () => {
    const { renderer } = await showDetail({ data: KICKOFF }, { userId: 6 });
    expect(rows(renderer)).toEqual([
      ['area', 'Address', 'Road 2'],
      ['phone', 'Phone', '01812345678'],
    ]);
    const text = shownText(renderer);
    expect(text).not.toContain('Website');
    expect(text).not.toContain(NOT_ADDED);
    // The last row draws no line under it.
    expect(renderer.root.findAllByType(ListRow)[1].props.last).toBe(true);
  });

  test('no area, no pill', async () => {
    const { renderer } = await showDetail({
      data: { ...KICKOFF, area: null },
    });
    expect(renderer.root.findAllByType(Pill)).toHaveLength(0);
  });

  test('tapping the phone opens the dialler with the number', async () => {
    const { renderer } = await showDetail();
    const call = tappable(renderer, 'Call Floodlight Arena');
    expect(call.props.accessibilityRole).toBe('button');
    await act(async () => call.props.onPress());
    expect(Linking.openURL).toHaveBeenCalledWith('tel:01712345678');
  });

  test('a dialler that fails to open shows an alert', async () => {
    Linking.openURL.mockRejectedValueOnce(new Error('no dialler'));
    const { renderer } = await showDetail();
    await act(async () =>
      tappable(renderer, 'Call Floodlight Arena').props.onPress(),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      "Couldn't open the dialler",
      'Please try again.',
    );
  });

  test('a valid website is a link that opens in the browser', async () => {
    const { renderer } = await showDetail();
    const link = tappable(renderer, 'Website, https://floodlight.example.com');
    expect(link.props.accessibilityRole).toBe('link');
    await act(async () => link.props.onPress());
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://floodlight.example.com',
    );
  });

  test('a website that fails isWebLink is plain text, never opened', async () => {
    const { renderer } = await showDetail({
      data: { ...FLOODLIGHT, website: 'javascript:alert(1)' },
    });
    expect(shownText(renderer)).toContain('javascript:alert(1)');
    expect(
      renderer.root.findAll(node => node.props.accessibilityRole === 'link'),
    ).toHaveLength(0);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test('a 404 says the venue is not available any more, with a way back', async () => {
    const { renderer, navigation } = await showDetail(
      httpError(404, 'Venue not found'),
    );
    const text = shownText(renderer);
    expect(text).toContain(GONE_MESSAGE);
    expect(text).toContain('Floodlight Arena'); // the name from the route
    expect(text).not.toContain('Listing');
    await press(renderer, 'Back to venues');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('moved back to review while open: the next refresh shows the 404 state', async () => {
    const { renderer } = await showDetail();
    expect(shownText(renderer)).toContain('Listing');
    api.get.mockRejectedValue(httpError(404, 'Venue not found'));
    const scroll = renderer.root.find(
      node => typeof node.props.onRefresh === 'function',
    );
    await act(async () => scroll.props.onRefresh());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(shownText(renderer)).toContain(GONE_MESSAGE);
    expect(shownText(renderer)).not.toContain('Listing');
  });

  test('a failed first load shows the error with Try again; a failed reload keeps the venue', async () => {
    const { renderer, navigation } = await showDetail(new Error('offline'));
    expect(shownText(renderer)).toContain("Couldn't load this venue.");
    api.get.mockResolvedValue({ data: FLOODLIGHT });
    await press(renderer, 'Try again');
    expect(shownText(renderer)).toContain('Road 5, Dhanmondi');

    api.get.mockRejectedValue(new Error('offline'));
    await act(async () => navigation.focus());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(shownText(renderer)).toContain('Road 5, Dhanmondi');
    expect(shownText(renderer)).not.toContain("Couldn't load this venue.");
  });
});
