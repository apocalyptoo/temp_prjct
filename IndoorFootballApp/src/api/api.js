import axios from 'axios';
import { getToken } from '../utils/storage';

// The backend's address. Also used to open its web pages (the Terms of Use and Privacy
// Policy) in the phone's browser.
export const API_URL =
  process.env.API_URL ||
  'https://demonstrational-nonfatal-judson.ngrok-free.dev';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// request interceptor to add token
api.interceptors.request.use(
  async config => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  error => Promise.reject(error),
);

// What to do when the backend says the saved login is no longer valid. AuthContext sets
// this (it clears the token and the user, which shows the login screen). This file can't
// reach the login state itself, so it just calls whatever was registered here, with the
// refused request's config (AuthContext looks at its url).
let onSessionExpired = null;
export const setSessionExpiredHandler = handler => {
  onSessionExpired = handler;
};

// response interceptor: a 401 on a request that carried a token means the login has
// expired or is invalid. Only 401: a 403 means "not allowed", not "logged out". The login
// request is never treated this way (a failed login is handled by the login screen).
// And only when the request carried the token that's saved now (P30): after a password
// change the app saves a fresh token, and a request sent with the old one just before
// must not log out the very phone that changed the password. With no token saved, the
// user is already logged out, so there's nothing to do either.
api.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error;
    const sentWith = config?.headers?.Authorization;
    const isLoginRequest = config?.url === '/auth/login';
    if (
      response?.status === 401 &&
      sentWith &&
      !isLoginRequest &&
      onSessionExpired
    ) {
      const saved = await getToken();
      if (saved && sentWith === `Bearer ${saved}`) onSessionExpired(config);
    }
    return Promise.reject(error);
  },
);

// What to do after a request that may have changed the Notifications badge's number
// (docs/features/notifications.md, P32): every request to /teams… other than a GET that
// ends with 2xx, 404 or 409 (a 404 or 409 means the screen was out of date, so the
// number may be too). The NotificationsProvider sets this while a player or venue owner
// is logged in. Returns a function that removes it again (only if it's still the one set).
let onTeamChange = null;
export const setTeamChangeListener = listener => {
  onTeamChange = listener;
  return () => {
    if (onTeamChange === listener) onTeamChange = null;
  };
};
const TEAMS_PATH = /^\/teams(\/|\?|$)/;
const changesTeams = config =>
  Boolean(config) &&
  (config.method ?? 'get').toLowerCase() !== 'get' &&
  TEAMS_PATH.test(config.url ?? '');

// After every reply: tell the badge when a team action went through.
api.interceptors.response.use(
  response => {
    if (changesTeams(response.config)) onTeamChange?.();
    return response;
  },
  error => {
    const status = error?.response?.status;
    if ((status === 404 || status === 409) && changesTeams(error.config)) {
      onTeamChange?.();
    }
    return Promise.reject(error);
  },
);

export default api;
