/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are refused */
// Tests for isWebLink (src/utils/links.js; docs/features/profiles-and-registration.md,
// P18): the website rule the app checks before sending a website and before opening one.
// The backend has the same rule with the same cases (backend/tests/venue-edit.test.js),
// so both always give the same answer. The screens that open websites test that they
// open only links that pass (owner-venue.test.js, venue-discovery.test.js).

import { isWebLink } from '../src/utils/links';

test('http and https links pass, in any capitals, with a port, path, query or fragment', () => {
  for (const link of [
    'https://arena.com.bd',
    'http://arena.com',
    'HTTP://Arena.com',
    'https://arena.com/page?x=1#top',
    'https://arena.com:8080/page',
    'https://my_arena-1.example.com',
    'https://ঢাকা.com',
    'http://localhost',
    'https://arena.com?x=1',
  ]) {
    expect([link, isWebLink(link)]).toEqual([link, true]);
  }
});

test('no scheme, other schemes, no host and spaces fail', () => {
  for (const link of [
    'arena.com', // no scheme
    'www.arena.com',
    'javascript:alert(1)',
    'mailto:a@b.com',
    'ftp://arena.com',
    'https://', // no host
    'https:// arena.com',
    'https://arena .com',
    '',
    null,
    undefined,
    5,
  ]) {
    expect([link, isWebLink(link)]).toEqual([link, false]);
  }
});

test('odd forms a URL parser would accept fail too', () => {
  for (const link of [
    'http:arena.com',
    'https:/arena.com',
    'https:\\\\arena.com',
    'https://user@arena.com',
    'https://arena.com@evil.example.com',
    'https://user:pass@arena.com',
    'https://arena..com',
    'https://.arena.com',
    'https://arena.com.',
    'https://arena.com:',
    'https://arena.com:99999',
    'https://[::1]',
    'https://<arena>.com',
    'https://arena.com\\page',
    'https://arena.com/a b',
  ]) {
    expect([link, isWebLink(link)]).toEqual([link, false]);
  }
});
