/* eslint-env jest */
// The listener in src/api/api.js that refreshes the Notifications badge after a team
// action (docs/features/notifications.md, P32): every request to /teams… other than a
// GET that ends with 2xx, 404 or 409.

import api, { setTeamChangeListener } from '../src/api/api';

jest.mock('../src/utils/storage', () => ({
  getToken: jest.fn(),
  saveToken: jest.fn(),
  removeToken: jest.fn(),
}));

// The badge's interceptor, registered after the session one: called the way axios would.
const handler = api.interceptors.response.handlers.filter(Boolean)[1];

const config = (method, url) => ({ method, url, headers: {} });
const success = (method, url) =>
  handler.fulfilled({ config: config(method, url) });
const failure = async (method, url, status) => {
  const error = Object.assign(new Error(`HTTP ${status}`), {
    config: config(method, url),
    response: { status, data: {} },
  });
  await expect(handler.rejected(error)).rejects.toBe(error); // always passed on
};

let listener;
let remove;
beforeEach(() => {
  listener = jest.fn();
  remove = setTeamChangeListener(listener);
});
afterEach(() => remove());

test('a team action that went through: the listener runs, and the reply is passed on', () => {
  const reply = { config: config('post', '/teams/7/accept'), data: {} };
  expect(handler.fulfilled(reply)).toBe(reply);
  success('delete', '/teams/7/requests/me');
  success('patch', '/teams/7');
  success('post', '/teams/create');
  success('POST', '/teams/7/requests/19/approve');
  expect(listener).toHaveBeenCalledTimes(5);
});

test('a GET to /teams, or a request elsewhere: nothing', () => {
  success('get', '/teams/7');
  success('get', '/teams?page=2');
  success(undefined, '/teams/me'); // axios's default method is GET
  success('post', '/notifications/read');
  success('patch', '/players/me');
  success('post', '/auth/change-password');
  success('post', '/teamsomething');
  expect(listener).not.toHaveBeenCalled();
});

test('a 404 or 409 on a team action counts (the screen was out of date); other errors do not', async () => {
  await failure('post', '/teams/7/accept', 404);
  await failure('post', '/teams/9/requests/21/approve', 409);
  expect(listener).toHaveBeenCalledTimes(2);

  await failure('post', '/teams/7/accept', 400);
  await failure('post', '/teams/7/accept', 403);
  await failure('post', '/teams/7/accept', 500);
  await failure('get', '/teams/7', 404);
  await failure('post', '/notifications/read', 404);
  expect(listener).toHaveBeenCalledTimes(2);
});

test('no response at all (no connection): nothing', async () => {
  const error = Object.assign(new Error('Network Error'), {
    config: config('post', '/teams/7/accept'),
  });
  await expect(handler.rejected(error)).rejects.toBe(error);
  expect(listener).not.toHaveBeenCalled();
});

test('removing it stops it, but only removes the listener that is still set', () => {
  const next = jest.fn();
  const removeNext = setTeamChangeListener(next);
  remove(); // the old one's remover: the new listener stays
  success('post', '/teams/7/accept');
  expect(next).toHaveBeenCalledTimes(1);
  expect(listener).not.toHaveBeenCalled();

  removeNext();
  success('post', '/teams/7/accept');
  expect(next).toHaveBeenCalledTimes(1);
});
