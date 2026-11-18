// Tests for POST /auth/resend-verification. Safety rules are in helpers.js.
// (Its rate limits are tested in rate-limits.test.js.)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, testEmail, createTestUser, postJson } from './helpers.js';

const RESEND_REPLY = { message: "If that account needs verifying, we've sent a new email." };
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// A verification link expires 24 hours after it was sent.
const verifySentMinutesAgo = (minutes) => new Date(Date.now() + DAY - minutes * MINUTE);

const resend = async (email) => {
  const res = await postJson('/auth/resend-verification', { email });
  return { status: res.status, body: await res.json() };
};

describe('POST /auth/resend-verification', () => {
  test('an unverified account gets a new link (new hashed token, 24-hour expiry)', async (t) => {
    const user = await createTestUser(t, {
      verified: false, verifyToken: 'old-token-hash', verifyTokenExpires: verifySentMinutesAgo(30),
    });

    const reply = await resend(user.email);

    assert.deepEqual(reply, { status: 200, body: RESEND_REPLY });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.notEqual(after.verifyToken, 'old-token-hash');
    assert.match(after.verifyToken, /^[0-9a-f]{64}$/);
    assert.ok(after.verifyTokenExpires > verifySentMinutesAgo(1), 'new link should expire about 24 hours from now');
  });

  test('works for an unverified account that has no token at all', async (t) => {
    const user = await createTestUser(t, { verified: false });

    const reply = await resend(user.email);

    assert.deepEqual(reply, { status: 200, body: RESEND_REPLY });
    assert.match((await prisma.user.findUnique({ where: { id: user.id } })).verifyToken, /^[0-9a-f]{64}$/);
  });

  test('unknown and already-verified emails get the identical reply, and nothing changes', async (t) => {
    const verified = await createTestUser(t, { verified: true });

    const unknownReply = await resend(testEmail());
    const verifiedReply = await resend(verified.email);

    assert.deepEqual(unknownReply, { status: 200, body: RESEND_REPLY });
    assert.deepEqual(verifiedReply, { status: 200, body: RESEND_REPLY });
    const after = await prisma.user.findUnique({ where: { id: verified.id } });
    assert.equal(after.verifyToken, null);
  });

  test('within 5 minutes of the last email, nothing new is sent (same reply)', async (t) => {
    const expires = verifySentMinutesAgo(2);
    const user = await createTestUser(t, { verified: false, verifyToken: 'recent-token-hash', verifyTokenExpires: expires });

    const reply = await resend(user.email);

    assert.deepEqual(reply, { status: 200, body: RESEND_REPLY });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.verifyToken, 'recent-token-hash');
    assert.equal(after.verifyTokenExpires.getTime(), expires.getTime());
  });

  test('rejects an email that is not a non-empty string', async () => {
    for (const email of [{ not: '' }, ['a@example.com'], 123, '', undefined]) {
      const res = await postJson('/auth/resend-verification', { email });
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(email)}`);
    }
  });
});
