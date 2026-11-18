// Tests for login timing, HTML replies from the reset form, and helmet's headers.
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_URL, OLD_PASSWORD, NEW_PASSWORD, testEmail, createTestUser, randomToken, getWithIp,
  inOneHour, postJson, postForm, passwordIs,
} from './helpers.js';

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function timeLogin(email, password) {
  const start = performance.now();
  await postJson('/auth/login', { email, password });
  return performance.now() - start;
}

describe('Login timing', () => {
  test('an unknown email takes about as long as a wrong password', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const unknown = [];
    const wrong = [];
    for (let i = 0; i < 5; i++) {
      unknown.push(await timeLogin(testEmail(), OLD_PASSWORD));
      wrong.push(await timeLogin(user.email, NEW_PASSWORD));
    }

    // Before the fix, an unknown email skipped the password check and answered in a
    // few milliseconds, while a wrong password took a full bcrypt comparison.
    assert.ok(
      median(unknown) >= median(wrong) * 0.5,
      `unknown email ${median(unknown).toFixed(1)} ms vs wrong password ${median(wrong).toFixed(1)} ms`
    );
  });
});

describe('POST /auth/reset from the HTML form replies with HTML', () => {
  const formBody = (token, password) => new URLSearchParams({ token, password }).toString();

  test('success shows a simple HTML page', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: token, resetTokenExpires: inOneHour() });

    const res = await postForm('/auth/reset', formBody(token, NEW_PASSWORD));
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /password has been reset/i);
    assert.equal(await passwordIs(user.id, NEW_PASSWORD), true);
  });

  test('a weak password shows the rule and a link back to the form', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: token, resetTokenExpires: inOneHour() });

    const res = await postForm('/auth/reset', formBody(token, 'weak'));
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /at least 8 characters/);
    assert.ok(body.includes(`href="/auth/reset-password-page?token=${token}"`), 'should link back to the form');
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
  });

  test('an expired link shows an HTML page telling the user to request a new one', async (t) => {
    const token = randomToken();
    await createTestUser(t, { resetToken: token, resetTokenExpires: new Date(Date.now() - 1000) });

    const res = await postForm('/auth/reset', formBody(token, NEW_PASSWORD));
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /invalid or expired/i);
    assert.match(body, /request a new password reset/i);
  });

  test('values inserted into the page are escaped', async () => {
    const res = await postForm('/auth/reset', formBody('"><script>alert(1)</script>', NEW_PASSWORD));
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.equal(body.includes('<script>'), false);
  });

  test('JSON requests still get JSON', async (t) => {
    const token = randomToken();
    await createTestUser(t, { resetToken: token, resetTokenExpires: inOneHour() });

    const res = await postJson('/auth/reset', { token, password: 'weak' });

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });
});

describe('Security headers (helmet)', () => {
  test('responses carry protective headers and hide the server technology', async () => {
    const res = await fetch(BASE_URL);

    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'), 'should send a content security policy');
    assert.equal(res.headers.get('x-powered-by'), null, 'should not announce Express');
  });

  test("the reset page's form is allowed by the content security policy", async () => {
    const res = await getWithIp(`/auth/reset-password-page?token=${randomToken()}`);
    const csp = res.headers.get('content-security-policy') ?? '';
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.match(csp, /form-action 'self'/, 'the form posts to the same site, which must be allowed');
    assert.match(body, /<form method="POST" action="\/auth\/reset">/);
    assert.doesNotMatch(body, /<script|style=/, 'the page must not rely on inline scripts or styles');
  });
});
