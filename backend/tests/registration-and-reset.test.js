// Tests for two small fixes: registration still succeeds when the verification email
// can't be sent, and a password reset clears any leftover verification link.
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  prisma, NEW_PASSWORD, deleteUserAfter, createTestUser, randomToken, sha256Hex,
  inOneHour, inOneDay, postJson,
} from './helpers.js';

describe('Registration when the email fails to send', () => {
  test('the account is created and the reply is 201 with a pointer to "Resend verification email"', async (t) => {
    // .invalid is reserved and can never receive mail, so the server refuses to send to
    // it straight away. That makes sending fail without touching real email.
    const email = `test-${crypto.randomUUID()}@mail.invalid`;
    deleteUserAfter(t, email);

    const res = await postJson('/auth/register', {
      name: 'Test Player', email, password: 'Valid-pass-123!', role: 'PLAYER',
      profileData: { phone: '01700000000', position: 'Forward' },
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.match(body.message, /couldn't send the verification email/i);
    assert.match(body.message, /resend verification email/i);
    assert.ok(await prisma.user.findUnique({ where: { email } }), 'the account exists');
  });
});

describe('Password reset', () => {
  test('a successful reset also clears any leftover verification link', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, {
      verified: false,
      verifyToken: sha256Hex(randomToken()), verifyTokenExpires: inOneDay(),
      resetToken: sha256Hex(token), resetTokenExpires: inOneHour(),
    });

    const res = await postJson('/auth/reset', { token, password: NEW_PASSWORD });

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.verified, true);
    assert.equal(after.verifyToken, null);
    assert.equal(after.verifyTokenExpires, null);
  });
});
