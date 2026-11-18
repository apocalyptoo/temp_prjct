// Tests for the 5-minute cooldown on account emails: if one was sent to an account
// less than 5 minutes ago, no new token is made and no email is sent, but the reply is
// exactly the same as usual. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, testEmail, createTestUser, postJson } from './helpers.js';

const FORGOT_REPLY = { message: 'If that email exists, a reset link was sent.' };
const MINUTE = 60 * 1000;

// A reset link expires 1 hour after it was sent, so "sent N minutes ago" means
// "expires in 60 - N minutes".
const sentMinutesAgo = (minutes) => new Date(Date.now() + (60 - minutes) * MINUTE);

describe('Forgot-password cooldown (5 minutes per account)', () => {
  test('a second request within 5 minutes sends nothing new, with the usual reply', async (t) => {
    const expires = sentMinutesAgo(2);
    const user = await createTestUser(t, { verified: true, resetToken: 'earlier-token-hash', resetTokenExpires: expires });

    const res = await postJson('/auth/forgot', { email: user.email });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), FORGOT_REPLY);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, 'earlier-token-hash', 'the earlier link must stay the valid one');
    assert.equal(after.resetTokenExpires.getTime(), expires.getTime());
  });

  test('after 5 minutes a new link is made', async (t) => {
    const user = await createTestUser(t, { verified: true, resetToken: 'earlier-token-hash', resetTokenExpires: sentMinutesAgo(6) });

    const res = await postJson('/auth/forgot', { email: user.email });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), FORGOT_REPLY);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.notEqual(after.resetToken, 'earlier-token-hash');
    assert.ok(after.resetTokenExpires > sentMinutesAgo(1), 'the new link should expire about an hour from now');
  });

  test('the reply is identical for unknown emails, new requests and requests in the cooldown', async (t) => {
    const cooling = await createTestUser(t, { verified: true, resetToken: 'x', resetTokenExpires: sentMinutesAgo(1) });
    const fresh = await createTestUser(t, { verified: true });

    const replies = await Promise.all(
      [testEmail(), fresh.email, cooling.email].map(async (email) => {
        const res = await postJson('/auth/forgot', { email });
        return { status: res.status, body: await res.json() };
      })
    );

    for (const reply of replies) assert.deepEqual(reply, { status: 200, body: FORGOT_REPLY });
  });
});
