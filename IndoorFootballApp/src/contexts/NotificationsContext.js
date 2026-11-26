// The Notifications tab's badge (docs/features/notifications.md, section e, "The badge",
// P31–P33): the number of pending invites and join requests plus unread updates.
//
// NotificationsProvider sits inside the player's and the venue owner's navigators, so it
// starts at login and ends at logout: one account's number can never show for the next,
// and the admin (who has no Notifications tab) never asks for it.
//
// When the number refreshes (GET /notifications/count):
// - when a tab other than Notifications comes into view, which includes the first tab
//   when the app opens or someone logs in (the navigators call `refresh`; switching to
//   Notifications loads the whole screen instead, which brings the number);
// - when the app comes back to the foreground (AppState);
// - after any team action that may change it: one listener in api.js (P32).
// The Notifications screen reports the number from its own replies (GET /notifications
// and POST /notifications/read) through `follow`.
//
// Requests are numbered when they're sent: a number from a request sent before the one
// shown is ignored, and a failed refresh keeps the last number (P33). After logout a late
// reply only reaches the old provider, which is gone: the next account's provider starts
// from nothing.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import api, { setTeamChangeListener } from '../api/api';

// Outside a provider (the admin, screen tests): no number, and nothing to report to.
const NotificationsContext = createContext({
  count: 0,
  refresh: () => {},
  follow: () => () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }) {
  const [count, setCount] = useState(0);
  const sent = useRef(0);
  const shown = useRef(0);

  // Call just before sending a request whose reply carries the number; call what it
  // returns with that number when the reply arrives.
  const follow = useCallback(() => {
    sent.current += 1;
    const number = sent.current;
    return value => {
      if (!Number.isFinite(value)) return;
      if (number < shown.current) return; // a newer reply is already shown
      shown.current = number;
      setCount(value);
    };
  }, []);

  const refresh = useCallback(async () => {
    const apply = follow();
    try {
      const res = await api.get('/notifications/count');
      apply(res.data?.count);
    } catch {
      // Keep the last number (P33): a bad connection mustn't hide the badge.
    }
  }, [follow]);

  // After team actions (api.js); removed again at logout.
  useEffect(() => setTeamChangeListener(refresh), [refresh]);

  // Back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({ count, refresh, follow }),
    [count, refresh, follow],
  );
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
