/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are never opened */
// Tests for venue discovery (docs/features/venues.md, sections e and h): the venue list
// (VenueList, Explore's Venues section; docs/features/explore.md), with the search and
// area filter sent to the backend 400 ms after typing stops (fake timers), its pages, and
// Venue detail.

import React from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Text as NativeText,
  TextInput,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import VenueList, { NO_MATCH, NO_VENUES } from '../src/screens/Venue/VenueList';
import { AREA_FILTER_MAX, SEARCH_MAX } from '../src/screens/Shared/PagedList';
import { SEARCH_DELAY_MS } from '../src/hooks/usePagedList';
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
const wait = ms =>
  act(async () => {
    jest.advanceTimersByTime(ms);
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
  await flush();
};

const httpError = (status, error) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { error } },
  });

// A GET /owners reply: one page of the paged list (docs/features/explore.md, d.1).
const page = venues => ({
  data: { items: venues, page: 1, limit: 20, total: venues.length },
});

// The params of every GET /owners so far.
const listRequests = () =>
  api.get.mock.calls
    .filter(([path]) => path === '/owners')
    .map(([, options]) => options?.params);

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

describe('The venue list (Explore → Venues)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function showList(venues = [FLOODLIGHT, KICKOFF]) {
    api.get.mockResolvedValue(page(venues));
    const navigation = navigationMock();
    const renderer = await render(<VenueList navigation={navigation} />);
    await flush();
    return { renderer, navigation };
  }

  // The cards' accessibility labels, in order.
  const cards = renderer =>
    renderer.root
      .findAll(
        node =>
          typeof node.props.onPress === 'function' &&
          typeof node.props.style === 'function' &&
          node.props.accessibilityRole === 'button' &&
          node.findAll(child => child.props.variant === 'cardTitle').length > 0,
      )
      .map(node => node.props.accessibilityLabel);

  test('loads every live venue with GET /owners, in the order the backend sends (A to Z)', async () => {
    const { renderer } = await showList();
    expect(listRequests()).toEqual([{ page: 1 }]);
    const text = shownText(renderer);
    for (const shown of [
      'Search venues',
      'Area',
      'Floodlight Arena',
      'Dhanmondi 27',
      'Sat–Thu 8am–2am · Fri 2pm–2am',
      'Kickoff Hub',
      'Mirpur 10',
    ]) {
      expect(text).toContain(shown);
    }
    expect(cards(renderer)).toEqual([
      'Floodlight Arena, Dhanmondi 27',
      'Kickoff Hub, Mirpur 10',
    ]);
    // The card shows no more than the name, the area and the hours.
    expect(text).not.toContain('01712345678');
  });

  test('the search is sent 400 ms after typing stops, not on every keystroke', async () => {
    const { renderer } = await showList();
    await type(renderer, 'Search venues', 'a');
    await wait(300);
    await type(renderer, 'Search venues', 'ar');
    await wait(SEARCH_DELAY_MS - 1);
    expect(listRequests()).toEqual([{ page: 1 }]);
    api.get.mockResolvedValue(page([KICKOFF]));
    await wait(1);
    await flush();
    expect(listRequests()).toEqual([{ page: 1 }, { search: 'ar', page: 1 }]);
    expect(cards(renderer)).toEqual(['Kickoff Hub, Mirpur 10']);
  });

  test('search and area are sent together, the search trimmed and the area tidied', async () => {
    const { renderer } = await showList();
    await type(renderer, 'Search venues', '  FLOOD ');
    await type(renderer, 'Area', '  dhanmondi   27 ');
    await wait(SEARCH_DELAY_MS);
    await flush();
    expect(listRequests()).toEqual([
      { page: 1 },
      { search: 'FLOOD', area: 'dhanmondi 27', page: 1 },
    ]);
  });

  test('a tapped area suggestion searches at once', async () => {
    const { renderer } = await showList();
    await act(async () => input(renderer, 'Area').props.onFocus());
    await type(renderer, 'Area', 'dhan');
    await press(renderer, 'Suggestion: Dhanmondi');
    expect(input(renderer, 'Area').props.value).toBe('Dhanmondi');
    expect(listRequests()).toEqual([
      { page: 1 },
      { area: 'Dhanmondi', page: 1 },
    ]);
    // The pending search from typing was dropped: nothing more is sent.
    await wait(SEARCH_DELAY_MS * 2);
    await flush();
    expect(listRequests()).toHaveLength(2);
  });

  test('only-spaces filters are no search at all: nothing is sent', async () => {
    const { renderer } = await showList();
    await type(renderer, 'Search venues', '   ');
    await type(renderer, 'Area', ' ');
    await wait(SEARCH_DELAY_MS);
    await flush();
    expect(listRequests()).toEqual([{ page: 1 }]);
  });

  test('the fields stop at the backend limits: search 60, area 40', async () => {
    const { renderer } = await showList();
    expect(input(renderer, 'Search venues').props.maxLength).toBe(SEARCH_MAX);
    expect(input(renderer, 'Area').props.maxLength).toBe(AREA_FILTER_MAX);
    expect([SEARCH_MAX, AREA_FILTER_MAX]).toEqual([60, 40]);
  });

  test('no live venues at all: "No venues yet." without Clear search', async () => {
    const { renderer } = await showList([]);
    expect(shownText(renderer)).toContain(NO_VENUES);
    expect(shownText(renderer)).not.toContain(NO_MATCH);
    expect(tappables(renderer, 'Clear search')).toHaveLength(0);
  });

  test('nothing matches: "No venues match your search." and Clear search, which empties both fields and loads at once', async () => {
    const { renderer } = await showList();
    api.get.mockResolvedValue(page([]));
    await type(renderer, 'Search venues', 'zzz');
    await type(renderer, 'Area', 'Uttara');
    await wait(SEARCH_DELAY_MS);
    await flush();
    expect(shownText(renderer)).toContain(NO_MATCH);
    expect(shownText(renderer)).not.toContain(NO_VENUES);

    api.get.mockResolvedValue(page([FLOODLIGHT, KICKOFF]));
    await press(renderer, 'Clear search');
    expect(input(renderer, 'Search venues').props.value).toBe('');
    expect(input(renderer, 'Area').props.value).toBe('');
    expect(listRequests()).toEqual([
      { page: 1 },
      { search: 'zzz', area: 'Uttara', page: 1 },
      { page: 1 },
    ]);
    expect(cards(renderer)).toHaveLength(2);
  });

  test('a slower earlier reply never replaces a newer one', async () => {
    const { renderer } = await showList();
    let finishOld;
    api.get.mockReturnValueOnce(
      new Promise(resolve => {
        finishOld = resolve;
      }),
    );
    await type(renderer, 'Search venues', 'flood');
    await wait(SEARCH_DELAY_MS);
    api.get.mockResolvedValueOnce(page([KICKOFF]));
    await type(renderer, 'Search venues', 'kick');
    await wait(SEARCH_DELAY_MS);
    await flush();
    expect(cards(renderer)).toEqual(['Kickoff Hub, Mirpur 10']);
    await act(async () => finishOld(page([FLOODLIGHT])));
    await flush();
    expect(cards(renderer)).toEqual(['Kickoff Hub, Mirpur 10']);
  });

  test('tapping a venue opens Venue detail with its id and name', async () => {
    const { renderer, navigation } = await showList();
    await press(renderer, 'Kickoff Hub, Mirpur 10');
    expect(navigation.navigate).toHaveBeenCalledWith('VenueDetail', {
      userId: 6,
      venueName: 'Kickoff Hub',
    });
  });

  test('pull to refresh reloads with the current filter; coming back into view reloads nothing (P18)', async () => {
    const { renderer, navigation } = await showList();
    await type(renderer, 'Search venues', 'hub');
    await wait(SEARCH_DELAY_MS);
    await flush();
    const list = renderer.root.find(
      node => typeof node.props.onRefresh === 'function',
    );
    await act(async () => list.props.onRefresh());
    await flush();
    await act(async () => navigation.focus());
    await flush();
    expect(listRequests()).toEqual([
      { page: 1 },
      { search: 'hub', page: 1 },
      { search: 'hub', page: 1 },
    ]);
  });

  test('scrolling to the end loads the next page with the same search', async () => {
    const { renderer } = await showList([]);
    api.get.mockResolvedValueOnce({
      data: { items: [FLOODLIGHT], page: 1, limit: 1, total: 2 },
    });
    await type(renderer, 'Search venues', 'o');
    await wait(SEARCH_DELAY_MS);
    await flush();
    api.get.mockResolvedValueOnce({
      data: { items: [KICKOFF], page: 2, limit: 1, total: 2 },
    });
    await act(async () =>
      renderer.root.findByType(FlatList).props.onEndReached(),
    );
    await flush();
    expect(listRequests().slice(1)).toEqual([
      { search: 'o', page: 1 },
      { search: 'o', page: 2 },
    ]);
    expect(cards(renderer)).toEqual([
      'Floodlight Arena, Dhanmondi 27',
      'Kickoff Hub, Mirpur 10',
    ]);
  });

  test('a failed first load shows the error with Try again; a failed reload keeps the list', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const navigation = navigationMock();
    const renderer = await render(<VenueList navigation={navigation} />);
    await flush();
    expect(shownText(renderer)).toContain("Couldn't load venues.");

    api.get.mockResolvedValue(page([FLOODLIGHT]));
    await press(renderer, 'Try again');
    expect(cards(renderer)).toEqual(['Floodlight Arena, Dhanmondi 27']);

    api.get.mockRejectedValueOnce(new Error('offline'));
    const list = renderer.root.find(
      node => typeof node.props.onRefresh === 'function',
    );
    await act(async () => list.props.onRefresh());
    await flush();
    expect(cards(renderer)).toEqual(['Floodlight Arena, Dhanmondi 27']);
    expect(shownText(renderer)).not.toContain("Couldn't load venues.");
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
    expect(tappable(renderer, 'Back to Explore')).toBeDefined();
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
