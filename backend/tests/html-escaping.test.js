// Tests for Phase 1 items 5 (reset page XSS) and 11 (escaping names in email HTML).
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, randomToken } from './helpers.js';

const resetPage = (query) => fetch(`${BASE_URL}/auth/reset-password-page${query}`);

describe('escapeHtml', () => {
  test('escapes the characters that can break out of HTML text or attributes', async () => {
    const { escapeHtml } = await import('../src/utils/html.js');

    assert.equal(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`),
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;');
    assert.equal(escapeHtml('Rahim Uddin'), 'Rahim Uddin');
  });
});

describe('GET /auth/reset-password-page (item 5)', () => {
  test('a well-formed token shows the form with the token in it', async () => {
    const token = randomToken();

    const res = await resetPage(`?token=${token}`);

    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes(`value="${token}"`));
  });

  test('a token containing HTML is refused and never echoed into the page', async () => {
    const attack = '"><script>alert(1)</script>';

    const res = await resetPage(`?token=${encodeURIComponent(attack)}`);
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.equal(body.includes('<script>'), false, 'the script must not appear in the page');
    assert.match(body, /invalid or expired/i);
  });

  test('tokens with the wrong length, characters or shape are refused', async () => {
    const queries = [
      '', // missing
      '?token=',
      '?token=abc',
      `?token=${randomToken().slice(1)}`, // 63 characters
      `?token=${randomToken().slice(1)}G`, // 64 characters, but G isn't hex
      `?token=${randomToken().toUpperCase()}`, // the server only makes lowercase tokens
      `?token=${randomToken()}&token=${randomToken()}`, // repeated
    ];
    for (const query of queries) {
      const res = await resetPage(query);
      assert.equal(res.status, 400, `expected 400 for "${query}"`);
      assert.match(await res.text(), /invalid or expired/i);
    }
  });
});

describe('Email HTML (item 11)', () => {
  test('the verification email escapes the user\'s name', async () => {
    const { verifyEmailHtml } = await import('../src/utils/emailTemplates.js');

    const html = verifyEmailHtml({
      displayName: '<img src=x onerror=alert(1)>',
      verifyLink: 'https://example.com/auth/verify?token=abc',
    });

    assert.equal(html.includes('<img'), false, 'the name must not be inserted as HTML');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('https://example.com/auth/verify?token=abc'));
  });
});
