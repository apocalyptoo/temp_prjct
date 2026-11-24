// A list that comes from the backend in pages, with a search and filters that run on the
// backend (docs/features/explore.md, P17 and P18). Shared by Explore's Teams, Players and
// Venues.
//   const list = usePagedList({ path: '/teams', initialFilters, toParams, keyOf });
// path: the endpoint. Its reply is { items, page, limit, total }.
// initialFilters: the empty search and filters, like { search: '', area: '' }.
// toParams(filters): what's sent, with blank filters left out ({} means nothing filtered).
// keyOf(row): the row's id. These four must not change between renders (define them
// outside the component).
//
// - The first page loads when the list first shows, then again only on refresh() and
//   when the search or a filter really changes; never just because the screen came back
//   into view (P18).
// - change() waits SEARCH_DELAY_MS after the last change; searchNow() and clear() send at
//   once. The same search is never sent twice in a row, unless it failed.
// - A reply that arrives after a newer search was sent is dropped.
// - loadMore() asks for the next page, one request at a time, until everything that
//   matches is loaded. A row that's already there is skipped (the list on the server can
//   shift between two pages).
// - A failed refresh keeps the rows. A failed first load or a failed new search shows the
//   error state instead, so the rows never disagree with the search above them. A failed
//   next page keeps the rows and offers to try again.
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/api';

export const SEARCH_DELAY_MS = 400; // spec D2

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function usePagedList({ path, initialFilters, toParams, keyOf }) {
  const [filters, setFilters] = useState(initialFilters);
  // The rows shown, the search they were loaded with, and how far they go.
  const [shown, setShown] = useState(null); // { rows, params, page, limit, total }
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState('idle'); // idle | loading | failed

  // The same facts in refs, so two events in the same instant see the latest ones.
  const filtersRef = useRef(initialFilters);
  const shownRef = useRef(null);
  const askedRef = useRef(null); // the params of the latest first-page request
  const requestRef = useRef(0); // only the latest first-page request counts
  const firstPageRef = useRef('idle'); // idle | loading | failed
  const loadingMoreRef = useRef(false);
  const timerRef = useRef(null);

  const show = next => {
    shownRef.current = next;
    setShown(next);
  };

  const loadFirstPage = useCallback(
    async params => {
      clearTimeout(timerRef.current);
      const request = ++requestRef.current; // also drops a next page under way
      askedRef.current = params;
      firstPageRef.current = 'loading';
      loadingMoreRef.current = false;
      setMore('idle');
      setStatus(current => (current === 'error' ? 'loading' : current));
      try {
        const res = await api.get(path, { params: { ...params, page: 1 } });
        if (request !== requestRef.current) return;
        const { items, page, limit, total } = res.data;
        firstPageRef.current = 'idle';
        show({ rows: items, params, page, limit, total });
        setStatus('ready');
      } catch {
        if (request !== requestRef.current) return;
        firstPageRef.current = 'failed';
        const rowsStillFit =
          shownRef.current !== null && same(shownRef.current.params, params);
        setStatus(rowsStillFit ? 'ready' : 'error');
      }
    },
    [path],
  );

  useEffect(() => {
    loadFirstPage(toParams(filtersRef.current));
    return () => {
      clearTimeout(timerRef.current);
      requestRef.current += 1; // a reply still on its way is dropped
    };
  }, [loadFirstPage, toParams]);

  const setPart = useCallback(part => {
    filtersRef.current = { ...filtersRef.current, ...part };
    setFilters(filtersRef.current);
  }, []);

  const search = useCallback(() => {
    clearTimeout(timerRef.current);
    const params = toParams(filtersRef.current);
    if (same(params, askedRef.current) && firstPageRef.current !== 'failed') {
      return;
    }
    loadFirstPage(params);
  }, [loadFirstPage, toParams]);

  // Changes part of the search, like { area: 'Mirpur' }; sent when typing stops.
  const change = useCallback(
    part => {
      setPart(part);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(search, SEARCH_DELAY_MS);
    },
    [setPart, search],
  );

  // The same, sent at once (a tapped suggestion or position, the Search key).
  const searchNow = useCallback(
    (part = {}) => {
      setPart(part);
      search();
    },
    [setPart, search],
  );

  const clear = useCallback(
    () => searchNow(initialFilters),
    [searchNow, initialFilters],
  );

  // Pull to refresh: back to the first page, with the search as it is now.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage(toParams(filtersRef.current));
    setRefreshing(false);
  }, [loadFirstPage, toParams]);

  // Try again, after a failed first load or a failed search.
  const retry = useCallback(() => {
    loadFirstPage(toParams(filtersRef.current));
  }, [loadFirstPage, toParams]);

  const fetchNextPage = useCallback(async () => {
    const current = shownRef.current;
    if (
      current === null ||
      loadingMoreRef.current ||
      firstPageRef.current === 'loading' ||
      // A failed new search: the rows aren't shown.
      !same(askedRef.current, current.params) ||
      current.page * current.limit >= current.total
    ) {
      return;
    }
    const request = requestRef.current;
    loadingMoreRef.current = true;
    setMore('loading');
    try {
      const res = await api.get(path, {
        params: { ...current.params, page: current.page + 1 },
      });
      if (request !== requestRef.current) return;
      const { items, page, limit, total } = res.data;
      const known = new Set(current.rows.map(keyOf));
      const fresh = items.filter(row => !known.has(keyOf(row)));
      loadingMoreRef.current = false;
      show({
        rows: [...current.rows, ...fresh],
        params: current.params,
        page,
        limit,
        total,
      });
      setMore('idle');
    } catch {
      if (request !== requestRef.current) return;
      loadingMoreRef.current = false;
      setMore('failed');
    }
  }, [path, keyOf]);

  // Near the end of the list. After a failed next page only retryMore() asks again, so
  // a list without a connection doesn't keep trying by itself.
  const loadMore = useCallback(() => {
    if (more !== 'failed') fetchNextPage();
  }, [more, fetchNextPage]);

  return {
    filters,
    change,
    searchNow,
    clear,
    rows: shown?.rows ?? [],
    // Whether the rows shown come from a search or filter (decides the empty state).
    filtered: shown !== null && Object.keys(shown.params).length > 0,
    status,
    refreshing,
    refresh,
    retry,
    loadMore,
    retryMore: fetchNextPage,
    loadingMore: more === 'loading',
    moreFailed: more === 'failed',
  };
}
