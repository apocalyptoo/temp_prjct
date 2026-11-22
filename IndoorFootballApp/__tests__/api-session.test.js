/* eslint-env jest */
// The "session expired" check in src/api/api.js (feature 2, P30): a 401 logs the user
// out only when the request carried the token that's saved now. A request sent with an
// older token (for example just before a password change saved a fresh one) doesn't.

import api, { setSessionExpiredHandler } from '../src/api/api';
import { getToken } from '../src/utils/storage';

jest.mock('../src/utils/storage', () => ({
  getToken: jest.fn(),
  saveToken: jest.fn(),
  removeToken: jest.fn(),
}));

// The response interceptor's error handler, called the way axios would.
const onError = api.interceptors.response.handlers.find(Boolean).rejected;

const failure = ({ status, token, url = '/players/me' }) =>
  Object.assign(new Error(`HTTP ${status}`), {
    config: { url, headers: token ? { Authorization: `Bearer ${token}` } : {} },
    response: { status, data: {} },
  });

let expired;
beforeEach(() => {
  jest.clearAllMocks();
  expired = jest.fn();
  setSessionExpiredHandler(expired);
});
afterAll(() => setSessionExpiredHandler(null));

const run = async error => {
  await expect(onError(error)).rejects.toBe(error); // always passed on
};

test('a 401 for the saved token: session expired', async () => {
  getToken.mockResolvedValue('current');
  await run(failure({ status: 401, token: 'current' }));
  expect(expired).toHaveBeenCalledTimes(1);
});

test('a 401 for an older token (a fresh one has been saved since): ignored', async () => {
  getToken.mockResolvedValue('fresh-after-password-change');
  await run(failure({ status: 401, token: 'old' }));
  expect(expired).not.toHaveBeenCalled();
});

test('a 401 when no token is saved any more (already logged out): ignored', async () => {
  getToken.mockResolvedValue(null);
  await run(failure({ status: 401, token: 'old' }));
  expect(expired).not.toHaveBeenCalled();
});

test('no token sent, a 403, or the login request: ignored, as before', async () => {
  getToken.mockResolvedValue('current');
  await run(failure({ status: 401 }));
  await run(failure({ status: 403, token: 'current' }));
  await run(failure({ status: 401, token: 'current', url: '/auth/login' }));
  expect(expired).not.toHaveBeenCalled();
});
