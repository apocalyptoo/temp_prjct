/* eslint-env jest */
/* eslint-disable no-script-url -- these tests check that javascript: links are refused */
// Tests for isWebLink (src/utils/links.js; docs/features/profiles-and-registration.md,
// P18): the website rule the app checks before sending a website and before opening one.
// The backend has the same rule with the same cases (backend/tests/venue-edit.test.js),
// so both always give the same answer. Also: Explore → Venues (IndoorsListScreen) opens
// only links that pass.

import React from 'react';
import { Linking, Text as NativeText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { isWebLink } from '../src/utils/links';
import IndoorsListScreen from '../src/screens/Owner/IndoorsListScreen';
import api from '../src/api/api';

jest.mock('../src/api/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

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

describe('Explore → Venues', () => {
  test('a valid website opens when tapped; a bad one is plain text', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    api.get.mockResolvedValue({
      data: [
        {
          userId: 1,
          indoorName: 'Good Arena',
          website: 'https://good.example',
        },
        { userId: 2, indoorName: 'Bad Arena', website: 'javascript:alert(1)' },
      ],
    });
    let renderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<IndoorsListScreen />);
    });
    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(api.get).toHaveBeenCalledWith('/owners');

    // The nearest tappable parent of a piece of text, if there is one.
    const tappableAround = text => {
      let node = renderer.root
        .findAllByType(NativeText)
        .find(found => found.props.children === text);
      expect(node).toBeDefined();
      while (node && typeof node.props.onPress !== 'function') {
        node = node.parent;
      }
      return node;
    };

    expect(tappableAround('javascript:alert(1)')).toBeNull();
    const good = tappableAround('https://good.example');
    await ReactTestRenderer.act(async () => good.props.onPress());
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith('https://good.example');
  });
});
