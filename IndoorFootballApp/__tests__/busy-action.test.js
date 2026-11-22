/* eslint-env jest */
// Tests for useBusyAction (src/hooks/useBusyAction.js): double-tap protection for every
// button that sends a request.

import React from 'react';
import { Pressable, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { useBusyAction } from '../src/hooks/useBusyAction';

const act = fn => ReactTestRenderer.act(fn);

// A promise the test resolves or rejects by hand.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Renders the hook and keeps its latest return value in `hook.current`.
async function renderHook() {
  const hook = {};
  function Probe() {
    hook.current = useBusyAction();
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(<Probe />);
  });
  return hook;
}

test('two taps in the same instant run the action only once', async () => {
  const hook = await renderHook();
  const pending = deferred();
  const action = jest.fn(() => pending.promise);
  await act(async () => {
    hook.current.run(action);
    hook.current.run(action); // before any re-render: the ref blocks it
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(hook.current.busy).toBe(true);
  expect(hook.current.isBusy()).toBe(true);
  await act(async () => pending.resolve('done'));
  expect(hook.current.busy).toBe(false);
});

test('it resets after a success, so the next tap runs again, and returns the result', async () => {
  const hook = await renderHook();
  const action = jest.fn(async () => 42);
  let result;
  await act(async () => {
    result = await hook.current.run(action);
  });
  expect(result).toBe(42);
  expect(hook.current.busy).toBe(false);
  await act(async () => {
    await hook.current.run(action);
  });
  expect(action).toHaveBeenCalledTimes(2);
});

test('it resets after an error and passes the error on', async () => {
  const hook = await renderHook();
  const failing = jest.fn(async () => {
    throw new Error('offline');
  });
  let caught;
  await act(async () => {
    await hook.current.run(failing).catch(error => {
      caught = error;
    });
  });
  expect(caught?.message).toBe('offline');
  expect(hook.current.busy).toBe(false);
  const next = jest.fn(async () => 'ok');
  await act(async () => {
    await hook.current.run(next);
  });
  expect(next).toHaveBeenCalledTimes(1);
});

test('with keys, only the tapped action is busy, and every other action is blocked', async () => {
  const hook = await renderHook();
  const pending = deferred();
  const accept = jest.fn(() => pending.promise);
  const decline = jest.fn(async () => {});
  await act(async () => {
    hook.current.run(accept, 'accept-1');
  });
  expect(hook.current.busyKey).toBe('accept-1');
  expect(hook.current.isBusy('accept-1')).toBe(true);
  expect(hook.current.isBusy('decline-1')).toBe(false);
  expect(hook.current.isBusy()).toBe(false);
  await act(async () => {
    await hook.current.run(decline, 'decline-1');
  });
  expect(decline).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  expect(hook.current.busyKey).toBeNull();
});

test('a real button pressed twice quickly sends one request', async () => {
  const pending = deferred();
  const send = jest.fn(() => pending.promise);
  function SendButton() {
    const { run, isBusy } = useBusyAction();
    return (
      <Pressable accessibilityLabel="Send" onPress={() => run(send)}>
        <Text>{isBusy() ? 'Sending' : 'Send'}</Text>
      </Pressable>
    );
  }
  let renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<SendButton />);
  });
  const button = renderer.root.find(
    node => node.props.accessibilityLabel === 'Send' && node.props.onPress,
  );
  await act(async () => {
    button.props.onPress();
    button.props.onPress();
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(Text).props.children).toBe('Sending');
  await act(async () => pending.resolve());
  expect(renderer.root.findByType(Text).props.children).toBe('Send');
});
