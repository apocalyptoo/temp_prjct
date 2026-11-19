// Tests for email normalisation (docs/ROADMAP.md, Phase 2 "Lowercase and trim emails"):
// emails are lowercased and trimmed wherever they come in, so "Test@Example.com " and
// "test@example.com" are the same account. (createAdmin.js is covered in
// create-admin.test.js.) Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma, deleteUserAfter, createTestUser, postJson } from './helpers.js';
import { normalizeEmail } from '../src/utils/email.js';

const PASSWORD = 'Valid-pass-123!';

const registerPlayer = (email) =>
  postJson('/auth/register', {
    name: 'Case Test', email, password: PASSWORD, role: 'PLAYER',
    profileData: { phone: '01700000000', position: 'Forward' },
  });

// A made-up address in two spellings: the stored (lowercase) one, and a messy one with
// capitals and spaces around it.
function messyAndClean() {
  const id = crypto.randomUUID();
  return { clean: `test-${id}@example.com`, messy: `  Test-${id.toUpperCase()}@Example.COM ` };
}

describe('normalizeEmail', () => {
  test('lowercases and trims; anything that is not a non-empty string becomes null', () => {
    assert.equal(normalizeEmail('  Test@Example.COM \n'), 'test@example.com');
    assert.equal(normalizeEmail('a@b.com'), 'a@b.com');
    for (const bad of ['', '   ', undefined, null, 5, { not: '' }, ['a@b.com']]) {
      assert.equal(normalizeEmail(bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
  });
});

describe('Register and login ignore case and surrounding spaces', () => {
  test('registering "Test@Example.com " then logging in as "test@example.com" works', async (t) => {
    const { clean, messy } = messyAndClean();
    deleteUserAfter(t, clean);

    const registerRes = await registerPlayer(messy);
    assert.equal(registerRes.status, 201);
    const user = await prisma.user.findUnique({ where: { email: clean } });
    assert.ok(user, 'the account is stored with the lowercase, trimmed email');

    // Stand-in for clicking the verification link.
    await prisma.user.update({ where: { id: user.id }, data: { verified: true } });

    const loginRes = await postJson('/auth/login', { email: clean, password: PASSWORD });
    assert.equal(loginRes.status, 200);
    assert.equal((await loginRes.json()).user.email, clean);

    const messyLoginRes = await postJson('/auth/login', { email: messy, password: PASSWORD });
    assert.equal(messyLoginRes.status, 200, 'logging in with the messy spelling works too');
  });

  test('registering the same email in a different case is rejected as already registered', async (t) => {
    const { clean, messy } = messyAndClean();
    deleteUserAfter(t, clean);

    assert.equal((await registerPlayer(clean)).status, 201);
    const secondRes = await registerPlayer(messy);

    assert.equal(secondRes.status, 400);
    assert.equal((await secondRes.json()).error, 'Email already registered');
    const sameAccounts = await prisma.user.count({ where: { email: { equals: clean, mode: 'insensitive' } } });
    assert.equal(sameAccounts, 1, 'only one account exists');
  });

  test('an email of only spaces is refused like an empty one', async () => {
    const loginRes = await postJson('/auth/login', { email: '   ', password: PASSWORD });
    const forgotRes = await postJson('/auth/forgot', { email: '   ' });
    const resendRes = await postJson('/auth/resend-verification', { email: '   ' });

    assert.equal(loginRes.status, 400);
    assert.equal(forgotRes.status, 400);
    assert.equal(resendRes.status, 400);
  });
});

describe('Forgot password and resend verification find the account in any case', () => {
  test('forgot-password with capitals and spaces sends a reset link to the account', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const messy = `  ${user.email.toUpperCase()} `;

    const res = await postJson('/auth/forgot', { email: messy });

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(after.resetToken, 'a reset token was stored on the account');
  });

  test('resend-verification with capitals and spaces sends a new link to the account', async (t) => {
    const user = await createTestUser(t, { verified: false });
    const messy = ` ${user.email.toUpperCase()}  `;

    const res = await postJson('/auth/resend-verification', { email: messy });

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(after.verifyToken, 'a verification token was stored on the account');
  });
});
