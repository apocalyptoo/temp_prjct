// The Terms of Use and Privacy Policy pages (GET /legal/terms, GET /legal/privacy;
// docs/features/profiles-and-registration.md, d endpoint 7). They're opened in a
// browser, with no login. Safety rules are in helpers.js (nothing is created here).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getWithIp } from './helpers.js';
import { legalPage } from '../src/utils/pages.js';

const PAGES = [
  ['/legal/terms', 'ConnectArena Terms of Use', [/offensive names or content/i, /fake profiles or fake venues/i, /harass/i, /spam/i]],
  ['/legal/privacy', 'ConnectArena Privacy Policy', [/phone number is seen only by their teammates/i, /email address is seen only by you and the admin/i, /backups/i, /your notifications: the newest 50/i, /mention you by name are deleted too/i]],
];

describe('The legal pages', () => {
  for (const [path, title, mustSay] of PAGES) {
    test(`${path} is an HTML page with its title and the draft note, without logging in`, async () => {
      const res = await getWithIp(path);
      const body = await res.text();

      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.ok(body.includes(`<title>${title}</title>`));
      assert.ok(body.includes(`<h1>${title}</h1>`));
      assert.match(body, /This is a draft\. The full text will be published before the app launches\./);
      for (const words of mustSay) assert.match(body, words);
    });

    test(`${path} keeps helmet's content security policy and uses no inline scripts or styles`, async () => {
      const res = await getWithIp(path);
      const body = await res.text();

      assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
      assert.doesNotMatch(body, /<script|<style|\sstyle=|\son[a-z]+=/i);
    });
  }

  test('other paths under /legal are 404', async () => {
    assert.equal((await getWithIp('/legal/cookies')).status, 404);
  });

  test('legalPage escapes every value', () => {
    const html = legalPage({
      title: '<T>',
      note: 'a & b',
      sections: [{ heading: '"H"', paragraphs: ['<p>'], items: ["it's"] }],
    });
    assert.ok(html.includes('<title>&lt;T&gt;</title>'));
    assert.ok(html.includes('a &amp; b'));
    assert.ok(html.includes('&quot;H&quot;'));
    assert.ok(html.includes('<p>&lt;p&gt;</p>'));
    assert.ok(html.includes('<li>it&#39;s</li>'));
  });
});
