// Tests how form posts are read since server.js uses express.urlencoded({ extended: false }):
// every value is plain text (a repeated field becomes a list of texts), never a nested
// object, so bracket names like token[not]=x can't become Prisma query operators.
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  prisma,
  OLD_PASSWORD,
  NEW_PASSWORD,
  createTestUser,
  postForm,
  randomToken,
  sha256Hex,
  inOneHour,
  passwordIs,
} from './helpers.js';

const form = (fields) => new URLSearchParams(fields).toString();

async function userWithResetLink(t) {
  const token = randomToken();
  const user = await createTestUser(t, { resetToken: sha256Hex(token), resetTokenExpires: inOneHour() });
  return { user, token };
}

// The text of an HTML reply, without its tags.
const pageText = async (res) => (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('The reset form still works', () => {
  test('a real link and a strong password reset the password (HTML reply)', async (t) => {
    const { user, token } = await userWithResetLink(t);

    const res = await postForm('/auth/reset', form({ token, password: NEW_PASSWORD }));

    assert.equal(res.status, 200);
    assert.match(await pageText(res), /Password changed/);
    assert.equal(await passwordIs(user.id, NEW_PASSWORD), true);
  });
});

describe('Bracket names are plain text, never objects', () => {
  test('token[not]=x is a field named "token[not]": the token counts as missing and no user matches', async (t) => {
    // A user whose stored token isn't empty: an operator like { not: '' } would match it.
    const { user } = await userWithResetLink(t);

    const res = await postForm('/auth/reset', `token[not]=x&password=${encodeURIComponent(NEW_PASSWORD)}`);

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const text = await pageText(res);
    assert.match(text, /Token and new password required\. Please request a new password reset from the app\./);
    assert.doesNotMatch(text, /Try again/);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true, 'password must not change');
  });

  test('token[startsWith]=<prefix> cannot match a token that starts with that prefix', async (t) => {
    const prefix = `test${crypto.randomBytes(8).toString('hex')}`;
    const user = await createTestUser(t, { resetToken: prefix + randomToken(), resetTokenExpires: inOneHour() });

    const res = await postForm('/auth/reset', `token[startsWith]=${prefix}&password=${encodeURIComponent(NEW_PASSWORD)}`);

    assert.equal(res.status, 400);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
  });

  test('brackets inside a value stay part of the text: it is just a wrong token', async (t) => {
    const { user, token } = await userWithResetLink(t);

    const res = await postForm('/auth/reset', form({ token: `${token}[not]`, password: NEW_PASSWORD }));

    assert.equal(res.status, 400);
    assert.match(await pageText(res), /Invalid or expired token\. Please request a new password reset from the app\./);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
  });

  test('a repeated token field (a list of texts) gets the invalid-link page', async (t) => {
    const { user, token } = await userWithResetLink(t);

    const res = await postForm('/auth/reset', `token=${token}&token=${token}&password=${encodeURIComponent(NEW_PASSWORD)}`);

    assert.equal(res.status, 400);
    const text = await pageText(res);
    assert.match(text, /Invalid or expired token\. Please request a new password reset from the app\./);
    assert.doesNotMatch(text, /Try again/);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, sha256Hex(token), 'the real link still works');
  });
});
