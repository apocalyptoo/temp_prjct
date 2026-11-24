/* eslint-env jest */
// Tests for every "Try again" (TeamLoadState, and "Couldn't load more." under Explore's
// lists) when the request fails at once, as it does while the backend is off: the spinner
// must stay long enough to be seen, or the button looks dead. Fake timers.

import React from 'react';
import { ActivityIndicator, FlatList, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { AuthContext } from '../src/contexts/AuthContext';
import { TRY_AGAIN_MS } from '../src/hooks/useTryAgain';
import { TeamLoadState } from '../src/screens/Team/teamCommon';
import TeamList from '../src/screens/Team/TeamList';
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
const wait = ms =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

async function render(element) {
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <AuthContext.Provider value={{ user: { id: 1, role: 'PLAYER' } }}>
          {element}
        </AuthContext.Provider>
      </ThemeProvider>,
    );
  });
  await flush();
  return renderer;
}
const text = renderer =>
  renderer.root
    .findAllByType(NativeText)
    .map(node => [].concat(node.props.children).join(''))
    .join(' | ');
const spins = renderer =>
  renderer.root
    .findAllByType(ActivityIndicator)
    .map(node => node.props.accessibilityLabel);
const buttons = renderer =>
  renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Try again' &&
      typeof n.props.style === 'function' &&
      typeof n.props.onPress === 'function',
  );
const tryAgain = async renderer => {
  await act(async () => buttons(renderer)[0].props.onPress());
  await flush();
};

const TEAM = {
  id: 1,
  name: 'Dhanmondi Strikers',
  captain: { id: 2, name: 'Tanvir Ahmed' },
  memberCount: 4,
  maxMembers: 15,
  viewerState: 'none',
};
const page = (items, number, total) => ({
  data: { items, page: number, limit: 1, total },
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('Try again when the request fails at once', () => {
  test('the spinner shows for a moment, then the error is back', async () => {
    api.get.mockRejectedValue(new Error('backend off'));
    const renderer = await render(<TeamList navigation={{}} />);
    expect(text(renderer)).toContain("Couldn't load teams.");

    await tryAgain(renderer);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(spins(renderer)).toEqual(['Loading']);
    expect(text(renderer)).not.toContain("Couldn't load teams.");

    await wait(TRY_AGAIN_MS - 1);
    expect(spins(renderer)).toEqual(['Loading']);
    await wait(1);
    expect(spins(renderer)).toEqual([]);
    expect(text(renderer)).toContain("Couldn't load teams.");
  });

  test('it can be tapped again, and sends again', async () => {
    api.get.mockRejectedValue(new Error('backend off'));
    const renderer = await render(<TeamList navigation={{}} />);
    await tryAgain(renderer);
    await wait(TRY_AGAIN_MS);
    await tryAgain(renderer);
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(spins(renderer)).toEqual(['Loading']);
  });

  test('two taps in the same instant send one request', async () => {
    const onRetry = jest.fn();
    const renderer = await render(
      <TeamLoadState status="error" onRetry={onRetry} />,
    );
    const { onPress } = buttons(renderer)[0].props;
    await act(async () => {
      onPress();
      onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('a success shows at once, without waiting', async () => {
    api.get.mockRejectedValueOnce(new Error('backend off'));
    const renderer = await render(<TeamList navigation={{}} />);
    api.get.mockResolvedValue(page([TEAM], 1, 1));
    await tryAgain(renderer);
    expect(spins(renderer)).toEqual([]);
    expect(text(renderer)).toContain('Dhanmondi Strikers');
  });

  test('a first load that fails shows the error at once', async () => {
    const renderer = await render(
      <TeamLoadState status="error" onRetry={() => {}} />,
    );
    expect(spins(renderer)).toEqual([]);
    expect(text(renderer)).toContain("Couldn't load this team.");
  });

  test('leaving the screen meanwhile is fine', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const renderer = await render(
      <TeamLoadState status="error" onRetry={() => {}} />,
    );
    await tryAgain(renderer);
    await act(async () => renderer.unmount());
    await wait(TRY_AGAIN_MS);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('the same under the rows, for "Couldn\'t load more."', async () => {
    api.get.mockResolvedValueOnce(page([TEAM], 1, 2));
    const renderer = await render(<TeamList navigation={{}} />);
    api.get.mockRejectedValue(new Error('backend off'));
    await act(async () =>
      renderer.root.findByType(FlatList).props.onEndReached(),
    );
    await flush();
    expect(text(renderer)).toContain("Couldn't load more.");

    await tryAgain(renderer);
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(spins(renderer)).toEqual(['Loading more']);
    expect(text(renderer)).toContain('Dhanmondi Strikers');
    await wait(TRY_AGAIN_MS);
    expect(spins(renderer)).toEqual([]);
    expect(text(renderer)).toContain("Couldn't load more.");

    api.get.mockResolvedValue(page([{ ...TEAM, id: 2, name: 'B' }], 2, 2));
    await tryAgain(renderer);
    expect(spins(renderer)).toEqual([]);
    expect(text(renderer)).not.toContain("Couldn't load more.");
  });
});
