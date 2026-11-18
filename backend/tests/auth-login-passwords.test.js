// Tests for Phase 1 items 6 (password strength on reset, one shared rule, string checks)
// and 8 (generic login error). Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma, OLD_PASSWORD, NEW_PASSWORD, testEmail, deleteUserAfter,
  createTestUser, randomToken, inOneHour, postJson, passwordIs,
  sha256Hex, inOneDay,
} from './helpers.js';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

// An array of single characters. The old registration check turned it into the text
// "A,a,1,!,a,a,a,a", which passes the strength rule, and then crashed when hashing it.
const ARRAY_PASSWORD = ['A', 'a', '1', '!', 'a', 'a', 'a', 'a'];

describe('The password rule is one shared function', () => {
  test('isStrongPassword accepts strong passwords and rejects weak or non-string ones', async () => {
    const { isStrongPassword } = await import('../src/utils/password.js');

    assert.equal(isStrongPassword('Valid-pass-123!'), true);
    assert.equal(isStrongPassword('Shor1!Aa'), true, 'exactly 8 characters is enough');
    for (const weak of ['Sh0rt!', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoNumbers!!', 'NoSpecial123']) {
      assert.equal(isStrongPassword(weak), false, `should reject ${weak}`);
    }
    for (const notText of [ARRAY_PASSWORD, { length: 20 }, 12345678, null, undefined]) {
      assert.equal(isStrongPassword(notText), false, `should reject ${JSON.stringify(notText)}`);
    }
  });
});

describe('POST /auth/reset password rules (item 6)', () => {
  test('rejects a weak new password and leaves the account unchanged', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: sha256Hex(token), resetTokenExpires: inOneHour() });

    const res = await postJson('/auth/reset', { token, password: 'weak' });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, PASSWORD_RULE_MESSAGE);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true, 'password must not change');
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, sha256Hex(token), 'the reset link should still work');
  });

  test('rejects a non-string new password with 400, not 500', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: sha256Hex(token), resetTokenExpires: inOneHour() });

    for (const password of [ARRAY_PASSWORD, { x: 1 }, 12345678]) {
      const res = await postJson('/auth/reset', { token, password });
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(password)}`);
    }
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
  });
});

describe('POST /auth/register password rules (item 6)', () => {
  test('rejects a non-string password with 400, not 500', async (t) => {
    const email = testEmail();
    deleteUserAfter(t, email);

    const res = await postJson('/auth/register', {
      name: 'Test Player',
      email,
      password: ARRAY_PASSWORD,
      role: 'PLAYER',
      profileData: { phone: '01700000000', position: 'Forward' },
    });

    assert.equal(res.status, 400);
    assert.equal(await prisma.user.findUnique({ where: { email } }), null);
  });
});

describe('POST /auth/login (items 6 and 8)', () => {
  test('a non-string password gets 400, not 500', async (t) => {
    const user = await createTestUser(t, { verified: true });

    const res = await postJson('/auth/login', { email: user.email, password: { x: 1 } });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, GENERIC_LOGIN_ERROR);
  });

  test('unknown email and wrong password get the same status and message', async (t) => {
    const user = await createTestUser(t, { verified: true });

    const unknown = await postJson('/auth/login', { email: testEmail(), password: OLD_PASSWORD });
    const wrong = await postJson('/auth/login', { email: user.email, password: NEW_PASSWORD });

    assert.equal(unknown.status, 400);
    assert.equal(wrong.status, 400);
    assert.equal((await unknown.json()).error, GENERIC_LOGIN_ERROR);
    assert.equal((await wrong.json()).error, GENERIC_LOGIN_ERROR);
  });

  test('an unverified account with the wrong password gets the generic error', async (t) => {
    const user = await createTestUser(t, { verified: false });

    const res = await postJson('/auth/login', { email: user.email, password: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, GENERIC_LOGIN_ERROR);
  });

  test('an unverified account with the right password is told to verify', async (t) => {
    const user = await createTestUser(t, { verified: false });

    const res = await postJson('/auth/login', { email: user.email, password: OLD_PASSWORD });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, 'Please verify your email before logging in.');
  });
});
