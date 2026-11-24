/* eslint-env jest */
// Tests for the Explore screen (docs/features/explore.md, section e): the section tabs,
// each section keeping its search and rows, the `section` param, and what the Teams and
// Players sections send and show, for players and for venue owners. The Venues section's
// own tests are in venue-discovery.test.js, and paging in paged-list.test.js.

import React from 'react';
import { FlatList, Text as NativeText, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import ExploreScreen from '../src/screens/Shared/ExploreScreen';
import { SEARCH_DELAY_MS } from '../src/hooks/usePagedList';
import { OptionGroup, Pill } from '../src/components/ui';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

const act = fn => ReactTestRenderer.act(fn);
const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
const wait = async ms => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const PLAYER = { id: 1, name: 'Rahim Uddin', role: 'PLAYER' };
const OWNER = { id: 50, name: 'Arena One', role: 'OWNER' };

const team = (id, name, extra = {}) => ({
  id,
  name,
  description: null,
  area: null,
  captainId: 90 + id,
  captain: { id: 90 + id, name: `Captain ${id}` },
  memberCount: 4,
  maxMembers: 15,
  viewerState: 'none',
  ...extra,
});
const STRIKERS = team(1, 'Dhanmondi Strikers', {
  description: 'Weekend 5-a-side crew.',
  area: 'Dhanmondi',
  captain: { id: 1, name: 'Rahim Uddin' },
  memberCount: 11,
  viewerState: 'captain',
});
const FULL = team(2, 'Uttara Kings', { memberCount: 15 });

const NAYEEM = {
  id: 19,
  name: 'Nayeem Islam',
  playerProfile: {
    name: 'Nayeem Islam',
    position: 'Goalkeeper',
    area: 'Mirpur 10',
  },
};
const FAHIM = {
  id: 20,
  name: 'Fahim Rahman',
  playerProfile: { name: 'Fahim Rahman', position: 'Forward' },
};
const VENUE = {
  userId: 5,
  indoorName: 'Floodlight Arena',
  area: 'Dhanmondi 27',
  openingHours: null,
};

const page = (items, total = items.length) => ({
  data: { items, page: 1, limit: 20, total },
});

let lists; // what each endpoint answers now
const sent = path =>
  api.get.mock.calls
    .filter(([called]) => called === path)
    .map(([, options]) => options.params);

async function render({ user = PLAYER, params } = {}) {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  let renderer;
  const element = nextParams => (
    <ThemeProvider>
      <AuthContext.Provider value={{ user }}>
        <ExploreScreen navigation={navigation} route={{ params: nextParams }} />
      </AuthContext.Provider>
    </ThemeProvider>
  );
  await act(async () => {
    renderer = ReactTestRenderer.create(element(params));
  });
  await flush();
  const setRoute = async nextParams => {
    await act(async () => renderer.update(element(nextParams)));
    await flush();
  };
  return { renderer, navigation, setRoute };
}

const shownText = node =>
  node
    .findAllByType(NativeText)
    .map(text => [].concat(text.props.children).join(''))
    .join(' | ');
// One section's part of the screen (undefined until it has been opened).
const sectionOf = (renderer, name) =>
  renderer.root.findAll(
    node =>
      typeof node.type === 'string' && node.props.testID === `explore-${name}`,
  )[0];
const isHidden = node =>
  node.props.pointerEvents === 'none' &&
  node.props.importantForAccessibility === 'no-hide-descendants' &&
  node.props.accessibilityElementsHidden === true;

const pressables = (node, label) =>
  node.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  );
const press = async (node, label) => {
  await act(async () => pressables(node, label)[0].props.onPress());
  await flush();
};
const tab = (renderer, label) =>
  renderer.root.find(
    n =>
      n.props.accessibilityRole === 'tab' &&
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
const openTab = async (renderer, label) => {
  await act(async () => tab(renderer, label).props.onPress());
  await flush();
};
const input = (node, label) =>
  node.find(n => n.type === TextInput && n.props.accessibilityLabel === label);
const type = (node, label, text) =>
  act(async () => input(node, label).props.onChangeText(text));
const cards = node =>
  node
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.style === 'function' &&
        n.props.accessibilityRole === 'button',
    )
    .map(n => n.props.accessibilityLabel);

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  lists = {
    '/teams': page([STRIKERS, FULL]),
    '/players': page([FAHIM, NAYEEM]),
    '/owners': page([VENUE]),
  };
  api.get.mockImplementation(path => Promise.resolve(lists[path]));
});
afterEach(() => jest.useRealTimers());

describe('Sections', () => {
  test('opens on Teams; each section loads the first time it is shown', async () => {
    const { renderer } = await render();
    expect(shownText(renderer.root)).toContain('Explore');
    expect(
      ['Teams', 'Players', 'Venues'].map(
        label => tab(renderer, label).props.accessibilityState.selected,
      ),
    ).toEqual([true, false, false]);
    expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/teams']);
    expect(sectionOf(renderer, 'players')).toBeUndefined();

    await openTab(renderer, 'Players');
    await openTab(renderer, 'Venues');
    expect(api.get.mock.calls.map(([path]) => path)).toEqual([
      '/teams',
      '/players',
      '/owners',
    ]);
    expect(shownText(sectionOf(renderer, 'venues'))).toContain(
      'Floodlight Arena',
    );
  });

  test('switching hides the other sections from touches and screen readers, and shows the chosen one', async () => {
    const { renderer } = await render();
    await openTab(renderer, 'Players');
    expect(isHidden(sectionOf(renderer, 'teams'))).toBe(true);
    expect(isHidden(sectionOf(renderer, 'players'))).toBe(false);
    await openTab(renderer, 'Teams');
    expect(isHidden(sectionOf(renderer, 'teams'))).toBe(false);
    expect(isHidden(sectionOf(renderer, 'players'))).toBe(true);
  });

  test('each section keeps its search, rows and pages while the others are shown', async () => {
    const { renderer } = await render();
    lists['/teams'] = page([STRIKERS], 21);
    await type(sectionOf(renderer, 'teams'), 'Search teams', 'strik');
    await wait(SEARCH_DELAY_MS);
    api.get.mockResolvedValueOnce({
      data: { items: [team(9, 'Strike Nine')], page: 2, limit: 20, total: 21 },
    });
    await act(async () =>
      sectionOf(renderer, 'teams').findByType(FlatList).props.onEndReached(),
    );
    await flush();
    const before = sent('/teams').length;

    await openTab(renderer, 'Players');
    await act(async () =>
      sectionOf(renderer, 'players')
        .findByType(OptionGroup)
        .props.onChange('Goalkeeper'),
    );
    await flush();
    await openTab(renderer, 'Venues');
    await openTab(renderer, 'Teams');

    const teams = sectionOf(renderer, 'teams');
    expect(input(teams, 'Search teams').props.value).toBe('strik');
    expect(shownText(teams)).toContain('Strike Nine');
    expect(sent('/teams')).toHaveLength(before); // nothing was loaded again

    await openTab(renderer, 'Players');
    expect(
      sectionOf(renderer, 'players').findByType(OptionGroup).props.value,
    ).toBe('Goalkeeper');
    expect(sent('/players')).toHaveLength(2);
  });

  test('the section param opens that section, also when Explore is already open, and is used once', async () => {
    const { renderer, navigation, setRoute } = await render({
      params: { section: 'players' },
    });
    expect(sent('/teams')).toEqual([]);
    expect(isHidden(sectionOf(renderer, 'players'))).toBe(false);
    expect(navigation.setParams).toHaveBeenCalledWith({ section: undefined });
    await setRoute({ section: undefined });

    await setRoute({ section: 'teams' });
    expect(isHidden(sectionOf(renderer, 'teams'))).toBe(false);
    expect(isHidden(sectionOf(renderer, 'players'))).toBe(true);
    await setRoute({ section: undefined });

    await openTab(renderer, 'Venues');
    await setRoute({ section: 'teams' });
    expect(isHidden(sectionOf(renderer, 'teams'))).toBe(false);
  });

  test('an unknown section is ignored', async () => {
    const { renderer } = await render({ params: { section: 'matches' } });
    expect(isHidden(sectionOf(renderer, 'teams'))).toBe(false);
  });
});

describe('Teams', () => {
  test('the first request, and the cards: captain, members, area, description and pills', async () => {
    const { renderer } = await render();
    expect(sent('/teams')).toEqual([{ page: 1 }]);
    const text = shownText(renderer.root);
    for (const shown of [
      'Dhanmondi Strikers',
      'Captain: Rahim Uddin',
      '11 / 15 members',
      'Dhanmondi',
      'Weekend 5-a-side crew.',
      'Uttara Kings',
      'Captain: Captain 2',
      '15 / 15 members',
    ]) {
      expect(text.split(' | ')).toContain(shown);
    }
    expect(text).not.toContain('Create');
  });

  test('"Full" only on a full team; the backend order is kept', async () => {
    const { renderer } = await render();
    expect(cards(sectionOf(renderer, 'teams'))).toEqual([
      'Dhanmondi Strikers, Captain: Rahim Uddin, 11 / 15 members, Dhanmondi, Captain',
      'Uttara Kings, Captain: Captain 2, 15 / 15 members, Full',
    ]);
    expect(
      renderer.root.findAllByType(Pill).map(pill => pill.props.label),
    ).toEqual(['Captain', 'Full']);
  });

  test.each([
    ['captain', 'Captain', 'strong'],
    ['member', 'Player', 'soft'],
    ['invited', 'Invited', 'soft'],
    ['requested', 'Request sent', 'soft'],
  ])('viewerState %s: the pill "%s"', async (viewerState, label, variant) => {
    lists['/teams'] = page([team(3, 'Banani FC', { viewerState })]);
    const { renderer } = await render();
    const pills = renderer.root.findAllByType(Pill);
    expect(pills).toHaveLength(1);
    expect(pills[0].props).toMatchObject({ label, variant });
  });

  test('viewerState none: no pill; a full team of mine has both', async () => {
    lists['/teams'] = page([team(3, 'Banani FC')]);
    const none = await render();
    expect(none.renderer.root.findAllByType(Pill)).toHaveLength(0);

    lists['/teams'] = page([
      team(4, 'Gulshan FC', { viewerState: 'member', memberCount: 15 }),
    ]);
    const both = await render();
    expect(
      both.renderer.root.findAllByType(Pill).map(pill => pill.props.label),
    ).toEqual(['Player', 'Full']);
  });

  test('search and area are sent together after the pause; a tapped suggestion at once', async () => {
    const { renderer } = await render();
    const teams = sectionOf(renderer, 'teams');
    await type(teams, 'Search teams', ' FC ');
    await type(teams, 'Area', 'dhanmondi   27');
    await wait(SEARCH_DELAY_MS);
    await act(async () => input(teams, 'Area').props.onFocus());
    await type(teams, 'Area', 'mirp');
    await press(teams, 'Suggestion: Mirpur');
    expect(sent('/teams')).toEqual([
      { page: 1 },
      { search: 'FC', area: 'dhanmondi 27', page: 1 },
      { search: 'FC', area: 'Mirpur', page: 1 },
    ]);
  });

  test('a team opens Team detail', async () => {
    const { renderer, navigation } = await render();
    await press(
      renderer.root,
      'Uttara Kings, Captain: Captain 2, 15 / 15 members, Full',
    );
    expect(navigation.navigate).toHaveBeenCalledWith('TeamDetail', {
      teamId: 2,
    });
  });

  test('no match: the line and Clear search, which brings the list back', async () => {
    const { renderer } = await render();
    lists['/teams'] = page([]);
    await type(renderer.root, 'Search teams', 'zzz');
    await wait(SEARCH_DELAY_MS);
    expect(shownText(renderer.root)).toContain('No teams match your search.');
    expect(shownText(renderer.root)).not.toContain('Create team');
    lists['/teams'] = page([STRIKERS]);
    await press(renderer.root, 'Clear search');
    expect(input(renderer.root, 'Search teams').props.value).toBe('');
    expect(shownText(renderer.root)).toContain('Dhanmondi Strikers');
  });

  test('no teams at all: a player gets Create team, which opens the form in My Teams', async () => {
    lists['/teams'] = page([]);
    const { renderer, navigation } = await render();
    expect(shownText(renderer.root)).toContain('No teams yet.');
    await press(renderer.root, 'Create team');
    expect(navigation.navigate).toHaveBeenCalledWith('MyTeamsTab', {
      screen: 'CreateTeam',
      initial: false,
    });
  });

  test('no teams at all: a venue owner gets no Create team', async () => {
    lists['/teams'] = page([]);
    const { renderer } = await render({ user: OWNER });
    expect(shownText(renderer.root)).toContain('No teams yet.');
    expect(shownText(renderer.root)).not.toContain('Create team');
  });

  test('a failed first load: "Couldn\'t load teams." with Try again', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const { renderer } = await render();
    expect(shownText(renderer.root)).toContain("Couldn't load teams.");
    await press(renderer.root, 'Try again');
    expect(shownText(renderer.root)).toContain('Dhanmondi Strikers');
  });

  test("a failed search never leaves rows that don't match it", async () => {
    const { renderer } = await render();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await type(renderer.root, 'Search teams', 'kings');
    await wait(SEARCH_DELAY_MS);
    expect(shownText(renderer.root)).toContain("Couldn't load teams.");
    expect(shownText(renderer.root)).not.toContain('Dhanmondi Strikers');
    lists['/teams'] = page([FULL]);
    await press(renderer.root, 'Try again');
    expect(shownText(renderer.root)).toContain('Uttara Kings');
    expect(sent('/teams')[2]).toEqual({ search: 'kings', page: 1 });
  });
});

describe('Players', () => {
  async function renderPlayers(options) {
    const result = await render(options);
    await openTab(result.renderer, 'Players');
    return { ...result, players: sectionOf(result.renderer, 'players') };
  }

  test('rows with "Position · Area", or the position alone; no email', async () => {
    const { players } = await renderPlayers();
    expect(sent('/players')).toEqual([{ page: 1 }]);
    expect(cards(players)).toEqual([
      'Fahim Rahman, Forward',
      'Nayeem Islam, Goalkeeper · Mirpur 10',
    ]);
    expect(shownText(players)).not.toContain('@');
  });

  test('the position filter: All first, then the five; All by default', async () => {
    const { players } = await renderPlayers();
    expect(
      players
        .findAll(
          n =>
            n.props.accessibilityRole === 'radio' &&
            typeof n.props.onPress === 'function' &&
            typeof n.props.style === 'function',
        )
        .map(n => [
          n.props.accessibilityLabel,
          n.props.accessibilityState.selected,
        ]),
    ).toEqual([
      ['All', true],
      ['Goalkeeper', false],
      ['Defender', false],
      ['Midfielder', false],
      ['Forward', false],
      ['Any', false],
    ]);
  });

  test('a position is sent at once; "Any" is a position; All sends none', async () => {
    const { players } = await renderPlayers();
    await press(players, 'Goalkeeper');
    await press(players, 'Any');
    await press(players, 'All');
    expect(sent('/players')).toEqual([
      { page: 1 },
      { position: 'Goalkeeper', page: 1 },
      { position: 'Any', page: 1 },
      { page: 1 },
    ]);
  });

  test('name, area and position are all sent together', async () => {
    const { players } = await renderPlayers();
    await type(players, 'Search players', 'nay');
    await type(players, 'Area', 'mirpur');
    await press(players, 'Goalkeeper');
    await wait(SEARCH_DELAY_MS);
    expect(sent('/players')).toEqual([
      { page: 1 },
      { search: 'nay', area: 'mirpur', position: 'Goalkeeper', page: 1 },
    ]);
  });

  test('no match: Clear search empties the search and every filter', async () => {
    const { players } = await renderPlayers();
    lists['/players'] = page([]);
    await type(players, 'Search players', 'zzz');
    await type(players, 'Area', 'Uttara');
    await press(players, 'Defender');
    expect(shownText(players)).toContain('No players match your search.');
    await press(players, 'Clear search');
    expect(input(players, 'Search players').props.value).toBe('');
    expect(input(players, 'Area').props.value).toBe('');
    expect(players.findByType(OptionGroup).props.value).toBe('');
    expect(sent('/players').pop()).toEqual({ page: 1 });
    expect(shownText(players)).toContain('No players yet.');
  });

  test('a position alone with no players counts as a search', async () => {
    const { players } = await renderPlayers();
    lists['/players'] = page([]);
    await press(players, 'Defender');
    expect(shownText(players)).toContain('No players match your search.');
  });

  test('a player opens Player detail', async () => {
    const { players, navigation } = await renderPlayers();
    await press(players, 'Nayeem Islam, Goalkeeper · Mirpur 10');
    expect(navigation.navigate).toHaveBeenCalledWith('PlayerDetail', {
      userId: 19,
      playerName: 'Nayeem Islam',
    });
  });

  test('a failed first load: "Couldn\'t load players."', async () => {
    lists['/players'] = undefined;
    const { players } = await renderPlayers();
    expect(shownText(players)).toContain("Couldn't load players.");
  });
});

describe('A venue owner', () => {
  test('sees the same three sections, and Explore sends nothing but the lists', async () => {
    const { renderer } = await render({ user: OWNER });
    for (const label of ['Players', 'Venues', 'Teams']) {
      await openTab(renderer, label);
    }
    expect(shownText(renderer.root)).toContain('Dhanmondi Strikers');
    expect(api.get.mock.calls.map(([path]) => path)).toEqual([
      '/teams',
      '/players',
      '/owners',
    ]);
    expect(api.post).not.toHaveBeenCalled();
    for (const label of ['Create team', 'Request to join', 'Invite']) {
      expect(shownText(renderer.root)).not.toContain(label);
    }
  });
});
