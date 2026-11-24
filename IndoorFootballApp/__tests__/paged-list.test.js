/* eslint-env jest */
// Tests for the usePagedList hook (docs/features/explore.md, P17, P18): the typing pause
// (fake timers), dropped late replies, pages, repeated rows, refresh and every failure.
// And for PagedList, the list it's shown in: the states under and instead of the rows.

import React from 'react';
import { ActivityIndicator, FlatList, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { SEARCH_DELAY_MS, usePagedList } from '../src/hooks/usePagedList';
import PagedList, {
  MORE_FAILED,
  NO_FILTERS,
  toParams,
} from '../src/screens/Shared/PagedList';
import { Text } from '../src/components/ui';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
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

// Rows with these ids, as one page of a reply.
const rows = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: from + i,
    name: `Row ${from + i}`,
  }));
const reply = (items, page, total) => ({
  data: { items, page, limit: 20, total },
});
const PAGE_1 = reply(rows(1, 20), 1, 45);
const PAGE_2 = reply(rows(21, 40), 2, 45);
const PAGE_3 = reply(rows(41, 45), 3, 45);

// A promise to answer by hand.
function later() {
  const handle = {};
  handle.promise = new Promise((resolve, reject) => {
    handle.resolve = resolve;
    handle.reject = reject;
  });
  return handle;
}

const keyOf = row => row.id;

// Renders the hook alone; `hook.current` is what it returned last.
async function renderHook() {
  const hook = {};
  function Probe() {
    hook.current = usePagedList({
      path: '/things',
      initialFilters: NO_FILTERS,
      toParams,
      keyOf,
    });
    return null;
  }
  await act(async () => {
    hook.renderer = ReactTestRenderer.create(<Probe />);
  });
  await flush();
  return hook;
}
const doIt = async fn => {
  await act(async () => {
    fn();
  });
  await flush();
};
const ids = hook => hook.current.rows.map(keyOf);
const sent = () => api.get.mock.calls.map(([, options]) => options.params);

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('toParams', () => {
  test('search trimmed, area tidied, blank ones left out', () => {
    expect(
      toParams({ search: '  FC ', area: ' dhanmondi   27 ', position: 'Any' }),
    ).toEqual({ search: 'FC', area: 'dhanmondi 27', position: 'Any' });
    expect(toParams({ search: '  ', area: ' ', position: '' })).toEqual({});
    expect(toParams(NO_FILTERS)).toEqual({});
  });
});

describe('The first page', () => {
  test('loads once, as page 1 of the given path', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const hook = await renderHook();
    expect(api.get.mock.calls).toEqual([['/things', { params: { page: 1 } }]]);
    expect(hook.current.status).toBe('ready');
    expect(ids(hook)).toHaveLength(20);
    expect(hook.current.filtered).toBe(false);
  });

  test('a failed first load is an error; Try again loads', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook();
    expect(hook.current.status).toBe('error');

    const answer = later();
    api.get.mockReturnValueOnce(answer.promise);
    await doIt(() => hook.current.retry());
    expect(hook.current.status).toBe('loading');
    await act(async () => answer.resolve(PAGE_1));
    await flush();
    expect(hook.current.status).toBe('ready');
    expect(ids(hook)).toHaveLength(20);
  });

  test('a reply after the list is gone changes nothing', async () => {
    const answer = later();
    api.get.mockReturnValueOnce(answer.promise);
    const hook = await renderHook();
    await act(async () => hook.renderer.unmount());
    await act(async () => answer.resolve(PAGE_1));
    expect(hook.current.status).toBe('loading');
  });
});

describe('Searching', () => {
  test('is sent 400 ms after the last change, not on every keystroke', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const hook = await renderHook();
    await doIt(() => hook.current.change({ search: 'a' }));
    await wait(300);
    await doIt(() => hook.current.change({ search: 'ar' }));
    await doIt(() => hook.current.change({ area: ' Mirpur ' }));
    await wait(SEARCH_DELAY_MS - 1);
    expect(sent()).toHaveLength(1);

    api.get.mockResolvedValue(reply(rows(7, 8), 1, 2));
    await wait(1);
    expect(SEARCH_DELAY_MS).toBe(400);
    expect(sent()[1]).toEqual({ search: 'ar', area: 'Mirpur', page: 1 });
    expect(ids(hook)).toEqual([7, 8]);
    expect(hook.current.filtered).toBe(true);
    expect(hook.current.filters).toEqual({ search: 'ar', area: ' Mirpur ' });
  });

  test('searchNow sends at once and drops the pending pause', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const hook = await renderHook();
    await doIt(() => {
      hook.current.change({ area: 'dhan' });
      hook.current.searchNow({ area: 'Dhanmondi' });
    });
    expect(sent()[1]).toEqual({ area: 'Dhanmondi', page: 1 });
    await wait(SEARCH_DELAY_MS * 2);
    expect(sent()).toHaveLength(2);
  });

  test('clear empties every filter and loads at once', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const hook = await renderHook();
    await doIt(() => hook.current.searchNow({ search: 'x', area: 'y' }));
    await doIt(() => hook.current.clear());
    expect(hook.current.filters).toEqual(NO_FILTERS);
    expect(sent()[2]).toEqual({ page: 1 });
    expect(hook.current.filtered).toBe(false);
  });

  test('a change that comes to the same search sends nothing and keeps the pages', async () => {
    api.get.mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    await doIt(() => hook.current.change({ search: '   ' }));
    await wait(SEARCH_DELAY_MS);
    await doIt(() => hook.current.change({ search: 'a' }));
    await doIt(() => hook.current.change({ search: '' }));
    await wait(SEARCH_DELAY_MS);
    await doIt(() => hook.current.searchNow());
    expect(sent()).toHaveLength(2);
    expect(ids(hook)).toHaveLength(40);
  });

  test('a reply that arrives after a newer search is dropped', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    const slow = later();
    api.get.mockReturnValueOnce(slow.promise);
    await doIt(() => hook.current.searchNow({ search: 'old' }));
    api.get.mockResolvedValueOnce(reply(rows(7, 7), 1, 1));
    await doIt(() => hook.current.searchNow({ search: 'new' }));
    expect(ids(hook)).toEqual([7]);
    await act(async () => slow.resolve(reply(rows(3, 3), 1, 1)));
    await flush();
    expect(ids(hook)).toEqual([7]);
  });

  test('going back to the first search while another is under way asks again', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    const slow = later();
    api.get.mockReturnValueOnce(slow.promise);
    await doIt(() => hook.current.searchNow({ search: 'x' }));
    api.get.mockResolvedValueOnce(PAGE_1);
    await doIt(() => hook.current.searchNow({ search: '' }));
    await act(async () => slow.resolve(reply([], 1, 0)));
    await flush();
    expect(ids(hook)).toHaveLength(20);
    expect(hook.current.filtered).toBe(false);
  });

  test('a failed search is an error, so the rows never disagree with it; the same search can be sent again', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.searchNow({ search: 'x' }));
    expect(hook.current.status).toBe('error');
    // No next page of the old rows either.
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(2);

    api.get.mockResolvedValueOnce(reply(rows(7, 7), 1, 1));
    await doIt(() => hook.current.searchNow());
    expect(sent()[2]).toEqual({ search: 'x', page: 1 });
    expect(hook.current.status).toBe('ready');
    expect(ids(hook)).toEqual([7]);
  });

  test('Try again after a failed search repeats that search', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.searchNow({ search: 'x' }));
    api.get.mockResolvedValueOnce(reply(rows(7, 7), 1, 1));
    await doIt(() => hook.current.retry());
    expect(sent()[2]).toEqual({ search: 'x', page: 1 });
    expect(ids(hook)).toEqual([7]);
  });
});

describe('More pages', () => {
  test('loads page after page with the same search, and stops at total', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    api.get.mockResolvedValueOnce(PAGE_1);
    await doIt(() => hook.current.searchNow({ search: 'x' }));
    api.get.mockResolvedValueOnce(PAGE_2).mockResolvedValueOnce(PAGE_3);
    await doIt(() => hook.current.loadMore());
    await doIt(() => hook.current.loadMore());
    expect(ids(hook)).toEqual(rows(1, 45).map(keyOf));
    await doIt(() => hook.current.loadMore());
    expect(sent().slice(1)).toEqual([
      { search: 'x', page: 1 },
      { search: 'x', page: 2 },
      { search: 'x', page: 3 },
    ]);
  });

  test('exactly one full page: nothing more is asked', async () => {
    api.get.mockResolvedValue(reply(rows(1, 20), 1, 20));
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(1);
  });

  test('one request at a time', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    const answer = later();
    api.get.mockReturnValueOnce(answer.promise);
    await doIt(() => {
      hook.current.loadMore();
      hook.current.loadMore();
    });
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(2);
    expect(hook.current.loadingMore).toBe(true);
    await act(async () => answer.resolve(PAGE_2));
    await flush();
    expect(hook.current.loadingMore).toBe(false);
    expect(ids(hook)).toHaveLength(40);
  });

  test('nothing while the first page is still loading', async () => {
    const answer = later();
    api.get.mockReturnValueOnce(answer.promise);
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(1);
  });

  test('a row that came before is skipped', async () => {
    api.get
      .mockResolvedValueOnce(PAGE_1)
      .mockResolvedValueOnce(reply([...rows(20, 20), ...rows(21, 39)], 2, 46));
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    expect(ids(hook)).toEqual(rows(1, 39).map(keyOf));
  });

  test('a failed next page keeps the rows and waits for Try again', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.loadMore());
    expect(hook.current.moreFailed).toBe(true);
    expect(hook.current.status).toBe('ready');
    expect(ids(hook)).toHaveLength(20);
    // Scrolling doesn't keep trying.
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(2);

    api.get.mockResolvedValueOnce(PAGE_2);
    await doIt(() => hook.current.retryMore());
    expect(sent()[2]).toEqual({ page: 2 });
    expect(hook.current.moreFailed).toBe(false);
    expect(ids(hook)).toHaveLength(40);
  });

  test('a next page that arrives after a new search is dropped, and paging still works', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    const slow = later();
    api.get.mockReturnValueOnce(slow.promise);
    await doIt(() => hook.current.loadMore());
    api.get.mockResolvedValueOnce(reply(rows(101, 120), 1, 25));
    await doIt(() => hook.current.searchNow({ search: 'x' }));
    expect(hook.current.loadingMore).toBe(false);
    await act(async () => slow.resolve(PAGE_2));
    await flush();
    expect(ids(hook)).toEqual(rows(101, 120).map(keyOf));

    api.get.mockResolvedValueOnce(reply(rows(121, 125), 2, 25));
    await doIt(() => hook.current.loadMore());
    expect(ids(hook)).toHaveLength(25);
  });
});

describe("leave: a row that left the server's list but stays on screen", () => {
  test('is patched, and the next page is asked from further back', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    await doIt(() => hook.current.leave(3, { label: 'Invited' }));
    expect(hook.current.rows[2]).toEqual({
      id: 3,
      name: 'Row 3',
      label: 'Invited',
    });
    // The server's page 1 is now 1, 2, 4 … 21.
    api.get.mockResolvedValueOnce(
      reply([...rows(1, 2), ...rows(4, 21)], 1, 44),
    );
    await doIt(() => hook.current.loadMore());
    api.get.mockResolvedValueOnce(reply(rows(22, 41), 2, 44));
    await doIt(() => hook.current.loadMore());
    expect(sent().map(params => params.page)).toEqual([1, 1, 2]);
    expect(ids(hook)).toEqual(rows(1, 41).map(keyOf));
    expect(hook.current.rows[2].label).toBe('Invited');
  });

  test('a row that is not in the list changes nothing', async () => {
    api.get.mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);
    const hook = await renderHook();
    await doIt(() => hook.current.leave(99, { label: 'Invited' }));
    await doIt(() => hook.current.loadMore());
    expect(sent()[1]).toEqual({ page: 2 });
  });

  test('nothing more is asked when everything was loaded', async () => {
    api.get.mockResolvedValue(reply(rows(1, 20), 1, 20));
    const hook = await renderHook();
    await doIt(() => hook.current.leave(1, {}));
    await doIt(() => hook.current.loadMore());
    expect(sent()).toHaveLength(1);
  });

  test('a fresh first page starts counting again; a failed one keeps the count and the patch', async () => {
    api.get.mockResolvedValueOnce(PAGE_1);
    const hook = await renderHook();
    await doIt(() => hook.current.leave(3, { label: 'Invited' }));
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.refresh());
    expect(hook.current.rows[2].label).toBe('Invited');
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.loadMore());
    expect(sent()[2]).toEqual({ page: 1 });

    api.get.mockResolvedValueOnce(reply(rows(4, 23), 1, 42));
    await doIt(() => hook.current.refresh());
    api.get.mockResolvedValueOnce(reply(rows(24, 43), 2, 42));
    await doIt(() => hook.current.loadMore());
    expect(sent()[4]).toEqual({ page: 2 });
  });
});

describe('Pull to refresh', () => {
  test('goes back to page 1 with the search as it is now, dropping a pending pause', async () => {
    api.get.mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    await doIt(() => hook.current.change({ search: 'x' }));
    const answer = later();
    api.get.mockReturnValueOnce(answer.promise);
    await doIt(() => hook.current.refresh());
    expect(hook.current.refreshing).toBe(true);
    expect(ids(hook)).toHaveLength(40); // the rows stay while it loads
    await act(async () => answer.resolve(reply(rows(7, 8), 1, 2)));
    await flush();
    expect(hook.current.refreshing).toBe(false);
    expect(sent()[2]).toEqual({ search: 'x', page: 1 });
    expect(ids(hook)).toEqual([7, 8]);
    await wait(SEARCH_DELAY_MS * 2);
    expect(sent()).toHaveLength(3);
  });

  test('always asks, even for the same search; a failure keeps the rows', async () => {
    api.get.mockResolvedValueOnce(PAGE_1).mockResolvedValueOnce(PAGE_2);
    const hook = await renderHook();
    await doIt(() => hook.current.loadMore());
    api.get.mockRejectedValueOnce(new Error('offline'));
    await doIt(() => hook.current.refresh());
    expect(sent()).toHaveLength(3);
    expect(hook.current.status).toBe('ready');
    expect(hook.current.refreshing).toBe(false);
    expect(ids(hook)).toHaveLength(40);
  });
});

describe('PagedList', () => {
  const base = {
    filters: NO_FILTERS,
    rows: rows(1, 2),
    filtered: false,
    status: 'ready',
    refreshing: false,
    loadingMore: false,
    moreFailed: false,
    refresh: jest.fn(),
    retry: jest.fn(),
    clear: jest.fn(),
    loadMore: jest.fn(),
    retryMore: jest.fn(),
  };
  async function renderList(list, props) {
    let renderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <PagedList
            list={{ ...base, ...list }}
            keyOf={keyOf}
            renderItem={({ item }) => <Text>{item.name}</Text>}
            errorMessage="Couldn't load things."
            emptyMessage="No things yet."
            noMatchMessage="No things match your search."
            {...props}
          />
        </ThemeProvider>,
      );
    });
    return renderer;
  }
  const text = renderer =>
    renderer.root
      .findAllByType(NativeText)
      .map(node => [].concat(node.props.children).join(''))
      .join(' | ');
  const press = (renderer, label) =>
    act(async () =>
      renderer.root
        .findAll(
          n =>
            n.props.accessibilityLabel === label &&
            typeof n.props.onPress === 'function',
        )[0]
        .props.onPress(),
    );

  test('the end of the list asks for more, and pulling refreshes', async () => {
    const loadMore = jest.fn();
    const refresh = jest.fn();
    const renderer = await renderList({ loadMore, refresh });
    expect(text(renderer)).toContain('Row 2');
    const list = renderer.root.findByType(FlatList);
    await act(async () => list.props.onEndReached());
    await act(async () => list.props.refreshControl.props.onRefresh());
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('a spinner under the rows while the next page loads', async () => {
    const renderer = await renderList({ loadingMore: true });
    expect(
      renderer.root.findByType(ActivityIndicator).props.accessibilityLabel,
    ).toBe('Loading more');
    expect(text(renderer)).toContain('Row 1');
  });

  test('"Couldn\'t load more." with Try again; the rows stay', async () => {
    const retryMore = jest.fn();
    const renderer = await renderList({ moreFailed: true, retryMore });
    expect(MORE_FAILED).toBe("Couldn't load more.");
    expect(text(renderer)).toContain(MORE_FAILED);
    expect(text(renderer)).toContain('Row 1');
    await press(renderer, 'Try again');
    expect(retryMore).toHaveBeenCalledTimes(1);
  });

  test('an error replaces the rows', async () => {
    const retry = jest.fn();
    const renderer = await renderList({ status: 'error', retry });
    expect(text(renderer)).toContain("Couldn't load things.");
    expect(text(renderer)).not.toContain('Row 1');
    await press(renderer, 'Try again');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('nothing at all, with and without an action; nothing matching, with Clear search', async () => {
    const onPress = jest.fn();
    const withAction = await renderList(
      { rows: [] },
      { emptyAction: { title: 'Create thing', icon: 'add', onPress } },
    );
    expect(text(withAction)).toContain('No things yet.');
    expect(text(withAction)).not.toContain('Clear search');
    await press(withAction, 'Create thing');
    expect(onPress).toHaveBeenCalledTimes(1);

    const without = await renderList({ rows: [] });
    expect(text(without)).not.toContain('Create thing');

    const clear = jest.fn();
    const noMatch = await renderList({ rows: [], filtered: true, clear });
    expect(text(noMatch)).toContain('No things match your search.');
    await press(noMatch, 'Clear search');
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
