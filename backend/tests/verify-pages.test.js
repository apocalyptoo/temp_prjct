// Tests that the email verification link (GET /auth/verify) answers with simple HTML
// pages, since it's opened in a browser. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser, randomToken, getWithIp } from './helpers.js';

describe('GET /auth/verify replies with HTML pages', () => {
  test('a valid link shows a success page and verifies the account', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { verified: false, verifyToken: token });

    const res = await getWithIp(`/auth/verify?token=${token}`);
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /email verified/i);
    assert.match(body, /log in/i);
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).verified, true);
  });

  test('an unknown or used link shows a clear error page', async () => {
    const res = await getWithIp(`/auth/verify?token=${randomToken()}`);
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /invalid or expired/i);
  });

  test('a missing or repeated token shows the same error page', async () => {
    for (const query of ['?token=', '?token=a&token=b']) {
      const res = await getWithIp(`/auth/verify${query}`);
      assert.equal(res.status, 400, `expected 400 for ${query}`);
      assert.match(res.headers.get('content-type'), /text\/html/);
    }
  });

  test('nothing from the link is echoed into the page', async () => {
    const res = await getWithIp(`/auth/verify?token=${encodeURIComponent('"><script>alert(1)</script>')}`);
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.equal(body.includes('<script>'), false);
  });
});
