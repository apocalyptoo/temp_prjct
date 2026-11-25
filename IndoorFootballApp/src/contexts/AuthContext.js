import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Alert } from 'react-native';
import api, { setSessionExpiredHandler } from '../api/api';
import { saveToken, getToken, removeToken } from '../utils/storage';

export const AuthContext = createContext();

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please log in again.';
export const ACCOUNT_DELETED_MESSAGE = 'Your account was deleted.';
const DELETE_ACCOUNT_URL = '/auth/delete-account';

// How long the start-up check may take before we show "Can't reach the server".
const STARTUP_TIMEOUT_MS = 15000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // true while the app checks a saved login at start-up (AppNavigator shows a loading view)
  const [loading, setLoading] = useState(true);
  // true when that check failed because the server couldn't be reached (not a logout)
  const [serverUnreachable, setServerUnreachable] = useState(false);
  // stops several failed requests at once from showing the expired message several times
  const sessionExpiredShown = useRef(false);
  // true while this phone's own account deletion runs
  const deletingAccount = useRef(false);

  // 🔹 Expired or invalid login while using the app: api.js calls this when a request
  // that carried the token gets a 401. Clearing the user swaps to the login screen.
  // While this phone's own deletion runs, a 401 on another request is ignored (P18): the
  // account is gone on the server a moment before this phone hears so, and "Your session
  // has expired" would clash with "Your account was deleted." A 401 on the deletion itself
  // still counts.
  useEffect(() => {
    setSessionExpiredHandler(async config => {
      if (deletingAccount.current && config?.url !== DELETE_ACCOUNT_URL) return;
      if (sessionExpiredShown.current) return;
      sessionExpiredShown.current = true;
      await removeToken();
      setUser(null);
      Alert.alert('Session expired', SESSION_EXPIRED_MESSAGE);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // 🔹 Restore the login when the app starts: if a token is saved, ask the backend who
  // it belongs to. 401 means the token is no good: forget it and show the login screen.
  // Any other failure (no connection, ngrok down, server error) keeps the token and
  // shows "Can't reach the server" with a Retry button.
  const restoreSession = useCallback(async () => {
    setLoading(true);
    setServerUnreachable(false);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await api.get('/auth/me', { timeout: STARTUP_TIMEOUT_MS });
      sessionExpiredShown.current = false;
      setUser(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        await removeToken();
        setUser(null);
      } else {
        setServerUnreachable(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // 🔹 LOGIN
  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });

      if (res.data?.token) {
        await saveToken(res.data.token);
        sessionExpiredShown.current = false;
        setUser(res.data.user);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Login failed',
        // 403 means the password was right but the email isn't verified yet.
        needsVerification: err.response?.status === 403,
      };
    }
  };

  // 🔹 RESEND VERIFICATION EMAIL
  // The backend gives the same reply whatever the account's state, so just show it.
  const resendVerification = async email => {
    try {
      const res = await api.post('/auth/resend-verification', { email });
      return { success: true, message: res.data?.message };
    } catch (err) {
      return {
        success: false,
        error:
          err.response?.data?.error ||
          'Could not send the email. Please try again later.',
      };
    }
  };

  // 🔹 REGISTER: the short sign-up forms (docs/features/profiles-and-registration.md).
  // acceptedTerms is passed on exactly as the form gives it (true only when the Terms box
  // is ticked): it's never filled in here. Returns the backend's reply ({ message,
  // userId }); a refusal throws an Error with the backend's message (for example "Email
  // already registered"), or a plain one when the server couldn't be reached.
  const register = async ({
    name,
    email,
    password,
    role,
    profileData,
    acceptedTerms,
  }) => {
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        role,
        profileData,
        acceptedTerms,
      });
      return res.data;
    } catch (err) {
      throw new Error(
        err.response?.data?.error ||
          "Couldn't reach the server. Please check your connection and try again.",
      );
    }
  };

  // 🔹 CHANGE PASSWORD while logged in (POST /auth/change-password). The backend logs out
  // every other phone and replies with a fresh token for this one, which is saved before
  // anything else, so this phone stays logged in (requests still in flight with the old
  // token can't log it out: see api.js). A refusal is thrown as axios gave it, so the
  // screen can tell "Current password is incorrect" (400) from the rest.
  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    await saveToken(res.data.token);
    return res.data;
  };

  // 🔹 DELETE MY ACCOUNT (POST /auth/delete-account), with the password and the code of the
  // preview the user saw. On success the saved login goes first, which shows the Login
  // screen, and then one alert (P17). A refusal is thrown as axios gave it, with the user
  // still logged in, so the screen can tell "Password is incorrect" (400) and "Something
  // changed" (409) from the rest.
  const deleteAccount = async (password, previewCode) => {
    deletingAccount.current = true;
    try {
      await api.post(DELETE_ACCOUNT_URL, { password, previewCode });
      await removeToken();
      setUser(null);
      Alert.alert('Account deleted', ACCOUNT_DELETED_MESSAGE);
    } finally {
      deletingAccount.current = false;
    }
  };

  // 🔹 LOGOUT: forget the saved token as well as the user, so the next app start
  // shows the login screen. No server call, so it also works from the
  // "Can't reach the server" screen (which it closes).
  const logout = async () => {
    await removeToken();
    setUser(null);
    setServerUnreachable(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        serverUnreachable,
        retryRestoreSession: restoreSession,
        login,
        logout,
        register,
        resendVerification,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
