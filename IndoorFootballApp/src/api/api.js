import axios from 'axios';
import { getToken } from '../utils/storage';

const API_URL =
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
// reach the login state itself, so it just calls whatever was registered here.
let onSessionExpired = null;
export const setSessionExpiredHandler = handler => {
  onSessionExpired = handler;
};

// response interceptor: a 401 on a request that carried a token means the login has
// expired or is invalid. Only 401: a 403 means "not allowed", not "logged out". The login
// request is never treated this way (a failed login is handled by the login screen).
api.interceptors.response.use(
  response => response,
  error => {
    const { config, response } = error;
    const sentToken = Boolean(config?.headers?.Authorization);
    const isLoginRequest = config?.url === '/auth/login';
    if (
      response?.status === 401 &&
      sentToken &&
      !isLoginRequest &&
      onSessionExpired
    ) {
      onSessionExpired();
    }
    return Promise.reject(error);
  },
);

export default api;
