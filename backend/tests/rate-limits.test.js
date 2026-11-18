// Tests for Phase 1 item 9: rate limits per client address. Each test uses its own
// fixed made-up address, sends one request more than the limit, and expects 429.
// No users are created: the requests are deliberately invalid or for unknown emails.
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClientIp, testEmail, randomToken, postJson, postForm } from './helpers.js';

async function sendUntilLimited(limit, send) {
  const ip = fakeClientIp();
  const statuses = [];
  for (let i = 0; i <= limit; i++) statuses.push((await send(ip)).status);
  return { ip, statuses };
}

function assertLimited(statuses, limit) {
  assert.equal(statuses.slice(0, limit).includes(429), false, `the first ${limit} requests must be allowed`);
  assert.equal(statuses[limit], 429, `request number ${limit + 1} must be refused`);
}

describe('Rate limits (item 9)', () => {
  test('login: 10 per 15 minutes, then 429, and other clients are unaffected', async () => {
    const { ip, statuses } = await sendUntilLimited(10, (ip) =>
      postJson('/auth/login', { email: testEmail(), password: 'Wrong-pass-1!' }, undefined, ip)
    );
    assertLimited(statuses, 10);

    const limited = await postJson('/auth/login', { email: testEmail(), password: 'x' }, undefined, ip);
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /too many/i, 'should explain in plain words');

    const otherClient = await postJson('/auth/login', { email: testEmail(), password: 'x' });
    assert.notEqual(otherClient.status, 429, 'a different client address has its own limit');
  });

  test('register: 5 per hour, then 429', async () => {
    // Empty bodies are rejected with 400, so no account is ever created.
    const { statuses } = await sendUntilLimited(5, (ip) => postJson('/auth/register', {}, undefined, ip));
    assertLimited(statuses, 5);
  });

  test('forgot-password: 5 per hour, then 429', async () => {
    // Unknown emails: nothing is saved and no email is sent.
    const { statuses } = await sendUntilLimited(5, (ip) =>
      postJson('/auth/forgot', { email: testEmail() }, undefined, ip)
    );
    assertLimited(statuses, 5);
  });

  test('reset: 10 per 15 minutes, then 429 (JSON and the HTML form share the limit)', async () => {
    const { ip, statuses } = await sendUntilLimited(10, (ip) =>
      postJson('/auth/reset', { token: randomToken(), password: 'New-pass-456!' }, undefined, ip)
    );
    assertLimited(statuses, 10);

    const fromForm = await postForm('/auth/reset', `token=${randomToken()}&password=New-pass-456!`, ip);
    assert.equal(fromForm.status, 429);
    assert.match(fromForm.headers.get('content-type'), /text\/html/, 'the form gets a readable page');
  });
});
