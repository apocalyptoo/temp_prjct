// Tests for the rate limits (docs/ROADMAP.md Phase 1 item 9, tuned for shared mobile
// IP addresses: see DECISIONS.md 2026-11-19). Each test uses its own fixed made-up
// address, so tests don't share counters.
// No accounts are created except where a test needs successful logins; requests are
// otherwise deliberately invalid or for unknown emails. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  OLD_PASSWORD, fakeClientIp, testEmail, randomToken, createTestUser,
  postJson, postForm, getWithIp,
} from './helpers.js';

// Sends `count` requests from one address and returns their status codes.
async function statusesFrom(ip, count, send) {
  const statuses = [];
  for (let i = 0; i < count; i++) statuses.push((await send(i)).status);
  return statuses;
}

function assertLimitedAfter(statuses, limit) {
  assert.equal(statuses.slice(0, limit).includes(429), false, `the first ${limit} requests must be allowed`);
  assert.equal(statuses[limit], 429, `request number ${limit + 1} must be refused`);
}

const failedLogin = (ip, email) => postJson('/auth/login', { email, password: 'Wrong-pass-1!' }, undefined, ip);

describe('Login rate limits', () => {
  test('10 failed attempts per IP + email, then 429; another email from the same IP still works', async () => {
    const ip = fakeClientIp();
    const email = testEmail();

    const statuses = await statusesFrom(ip, 11, () => failedLogin(ip, email));
    assertLimitedAfter(statuses, 10);

    const limited = await failedLogin(ip, email);
    assert.match((await limited.json()).error, /too many/i, 'should explain in plain words');

    const otherEmail = await failedLogin(ip, testEmail());
    assert.notEqual(otherEmail.status, 429, 'a different email from the same address has its own limit');
  });

  test('the email is compared lowercased and trimmed', async () => {
    const ip = fakeClientIp();
    const email = testEmail();
    const variants = [email, email.toUpperCase(), `  ${email}  `];

    const statuses = await statusesFrom(ip, 11, (i) => failedLogin(ip, variants[i % variants.length]));

    assertLimitedAfter(statuses, 10);
  });

  test('successful logins do not use up the limit', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const ip = fakeClientIp();

    const successes = await statusesFrom(ip, 12, () =>
      postJson('/auth/login', { email: user.email, password: OLD_PASSWORD }, undefined, ip)
    );
    assert.deepEqual([...new Set(successes)], [200], '12 successful logins must all work');

    const failures = await statusesFrom(ip, 11, () => failedLogin(ip, user.email));
    assertLimitedAfter(failures, 10);
  });

  test('"please verify your email" (403, password was right) does not count as a failed attempt', async (t) => {
    const user = await createTestUser(t, { verified: false });
    const ip = fakeClientIp();

    const verifyReplies = await statusesFrom(ip, 12, () =>
      postJson('/auth/login', { email: user.email, password: OLD_PASSWORD }, undefined, ip)
    );
    assert.deepEqual([...new Set(verifyReplies)], [403], '12 correct-password logins must all get the 403, never 429');

    const failures = await statusesFrom(ip, 11, () => failedLogin(ip, user.email));
    assertLimitedAfter(failures, 10);
  });

  test('per-IP safety cap: 50 failed attempts across many emails, then 429', async () => {
    const ip = fakeClientIp();

    const statuses = await statusesFrom(ip, 51, () => failedLogin(ip, testEmail()));
    assertLimitedAfter(statuses, 50);

    const otherClient = await failedLogin(fakeClientIp(), testEmail());
    assert.notEqual(otherClient.status, 429, 'a different address has its own cap');
  });

  test('IPv6 addresses in the same /56 network share a limit', async () => {
    // One home or mobile connection usually gets a whole IPv6 range. Cycling through
    // addresses inside it must not reset the counter.
    const prefix = `2001:db8:${crypto.randomUUID().slice(0, 4)}:12`;
    const email = testEmail();

    const statuses = await statusesFrom(null, 11, (i) =>
      failedLogin(`${prefix}${i.toString(16).padStart(2, '0')}::${i + 1}`, email)
    );

    assertLimitedAfter(statuses, 10);
  });
});

describe('Register rate limit', () => {
  test('20 per hour per IP, then 429', async () => {
    const ip = fakeClientIp();
    // Empty bodies are rejected with 400, so no account is ever created.
    const statuses = await statusesFrom(ip, 21, () => postJson('/auth/register', {}, undefined, ip));
    assertLimitedAfter(statuses, 20);
  });
});

describe('Forgot-password rate limits', () => {
  const forgot = (ip, email) => postJson('/auth/forgot', { email }, undefined, ip);

  test('5 per hour per IP + email, then 429; another email from the same IP still works', async () => {
    const ip = fakeClientIp();
    const email = testEmail(); // unknown email: nothing is saved and no email is sent

    const statuses = await statusesFrom(ip, 6, () => forgot(ip, email));
    assertLimitedAfter(statuses, 5);

    const otherEmail = await forgot(ip, testEmail());
    assert.notEqual(otherEmail.status, 429);
  });

  test('per-IP cap: 20 per hour across many emails, then 429', async () => {
    const ip = fakeClientIp();
    const statuses = await statusesFrom(ip, 21, () => forgot(ip, testEmail()));
    assertLimitedAfter(statuses, 20);
  });
});

describe('Resend-verification rate limits', () => {
  const resend = (ip, email) => postJson('/auth/resend-verification', { email }, undefined, ip);

  test('5 per hour per IP + email, then 429; another email from the same IP still works', async () => {
    const ip = fakeClientIp();
    const email = testEmail(); // unknown email: nothing is saved and no email is sent

    const statuses = await statusesFrom(ip, 6, () => resend(ip, email));
    assertLimitedAfter(statuses, 5);

    const otherEmail = await resend(ip, testEmail());
    assert.notEqual(otherEmail.status, 429);
  });

  test('per-IP cap: 20 per hour across many emails, then 429', async () => {
    const ip = fakeClientIp();
    const statuses = await statusesFrom(ip, 21, () => resend(ip, testEmail()));
    assertLimitedAfter(statuses, 20);
  });
});

describe('Reset rate limit', () => {
  test('10 per 15 minutes per IP, then 429 (JSON and the HTML form share the limit)', async () => {
    const ip = fakeClientIp();
    const statuses = await statusesFrom(ip, 11, () =>
      postJson('/auth/reset', { token: randomToken(), password: 'New-pass-456!' }, undefined, ip)
    );
    assertLimitedAfter(statuses, 10);

    const fromForm = await postForm('/auth/reset', `token=${randomToken()}&password=New-pass-456!`, ip);
    assert.equal(fromForm.status, 429);
    assert.match(fromForm.headers.get('content-type'), /text\/html/, 'the form gets a readable page');
  });
});

describe('Browser page rate limits', () => {
  for (const [label, path] of [
    ['reset-password page', '/auth/reset-password-page?token='],
    ['verify link', '/auth/verify?token='],
  ]) {
    test(`${label}: 30 per 15 minutes per IP, then a 429 page`, async () => {
      const ip = fakeClientIp();
      const statuses = await statusesFrom(ip, 31, () => getWithIp(path + randomToken(), ip));
      assertLimitedAfter(statuses, 30);

      const limited = await getWithIp(path + randomToken(), ip);
      assert.equal(limited.status, 429);
      assert.match(limited.headers.get('content-type'), /text\/html/, 'opened in a browser, so it gets a page');
    });
  }
});
