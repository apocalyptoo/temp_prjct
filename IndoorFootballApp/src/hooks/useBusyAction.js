// Double-tap protection for buttons that send a request (docs/TECHNICAL.md 8.8). Every
// such button runs its action through this hook, so one action runs at a time:
//   const { run, isBusy } = useBusyAction();
//   <Button title="Save" onPress={() => run(save)} loading={isBusy()} />
// With several buttons on one screen, give each a key, so only the tapped one spins
// while all of them are blocked:
//   onPress={() => run(() => accept(invite), `accept-${invite.id}`)}
//   loading={isBusy(`accept-${invite.id}`)}  disabled={busy && !isBusy(`accept-${invite.id}`)}
//
// A ref blocks a second tap at once (a state only changes after the next render, so two
// taps in the same instant would both get through); the state makes the Button show
// its spinner. Both are reset when the action finishes, whether it succeeded or failed.
// An error from the action is passed on to the caller unchanged.
import { useCallback, useEffect, useRef, useState } from 'react';

const NO_KEY = 'action';

export function useBusyAction() {
  const running = useRef(false);
  const mounted = useRef(true);
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Runs action() unless another action is still running (then does nothing and
  // returns undefined). Returns what action() returns.
  const run = useCallback(async (action, key = NO_KEY) => {
    if (running.current) return undefined;
    running.current = true;
    setBusyKey(key);
    try {
      return await action();
    } finally {
      running.current = false;
      // The screen may have gone (for example after goBack on success).
      if (mounted.current) setBusyKey(null);
    }
  }, []);

  // With a key: is that action the one running? Without: is the unkeyed one running?
  const isBusy = useCallback(
    (key = NO_KEY) => busyKey !== null && busyKey === key,
    [busyKey],
  );

  return { run, busy: busyKey !== null, busyKey, isBusy };
}
