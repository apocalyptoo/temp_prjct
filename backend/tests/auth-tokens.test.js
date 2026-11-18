// Tests for the password-reset and email-verify token checks
// (docs/ROADMAP.md, Phase 1 items 1 and 2). Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  BASE_URL, OLD_PASSWORD, NEW_PASSWORD, prisma,
  createTestUser, randomToken, inOneHour, postJson, postForm, passwordIs,
} from './helpers.js';

describe('POST /auth/reset', () => {
  test('a valid token resets the password (JSON)', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: token, resetTokenExpires: inOneHour() });

    const res = await postJson('/auth/reset', { token, password: NEW_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(await passwordIs(user.id, NEW_PASSWORD), true);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, null);
  });

  test('a valid token resets the password (HTML form)', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: token, resetTokenExpires: inOneHour() });

    const res = await postForm('/auth/reset', new URLSearchParams({ token, password: NEW_PASSWORD }).toString());

    assert.equal(res.status, 200);
    assert.equal(await passwordIs(user.id, NEW_PASSWORD), true);
  });

  // The audit's example attack is {"token": {"not": ""}}, which matches ANY user
  // with an unexpired reset token. To keep real users safe, these tests use
  // {"startsWith": "<random prefix>"} instead: the same trick (an object that
  // Prisma treats as a query operator), but it can only match the throwaway user.
  test('rejects an object token sent as JSON (operator injection)', async (t) => {
    const prefix = `test${crypto.randomBytes(8).toString('hex')}`;
    const user = await createTestUser(t, { resetToken: prefix + randomToken(), resetTokenExpires: inOneHour() });

    const res = await postJson('/auth/reset', { token: { startsWith: prefix }, password: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true, 'password must not change');
  });

  test('rejects an object token sent through the HTML form (token[startsWith]=...)', async (t) => {
    const prefix = `test${crypto.randomBytes(8).toString('hex')}`;
    const user = await createTestUser(t, { resetToken: prefix + randomToken(), resetTokenExpires: inOneHour() });

    const res = await postForm('/auth/reset', `token[startsWith]=${prefix}&password=${encodeURIComponent(NEW_PASSWORD)}`);

    assert.equal(res.status, 400);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true, 'password must not change');
  });

  test('rejects tokens that are not a non-empty string', async () => {
    const badBodies = [
      { token: 12345, password: NEW_PASSWORD },
      { token: ['abc'], password: NEW_PASSWORD },
      { token: true, password: NEW_PASSWORD },
      { token: '', password: NEW_PASSWORD },
      { password: NEW_PASSWORD },
    ];
    for (const body of badBodies) {
      const res = await postJson('/auth/reset', body);
      assert.equal(res.status, 400, `expected 400 for body ${JSON.stringify(body)}`);
    }
  });
});

describe('GET /auth/verify', () => {
  test('a valid token verifies the account', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { verified: false, verifyToken: token });

    const res = await fetch(`${BASE_URL}/auth/verify?token=${token}`);

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.verified, true);
    assert.equal(after.verifyToken, null);
  });

  test('rejects an empty or repeated token', async () => {
    for (const query of ['?token=', '?token=a&token=b']) {
      const res = await fetch(`${BASE_URL}/auth/verify${query}`);
      assert.equal(res.status, 400, `expected 400 for ${query}`);
    }
  });

  // With the bug, a missing token makes the server run the query with no filter,
  // so it "verifies" whichever user the database returns first. Before sending
  // the request, look up that user (same query the server runs). Only go ahead
  // if they are already verified with no pending token: then even the buggy
  // server writes back the values they already have, and nothing changes.
  async function userTheBugWouldHit() {
    return prisma.user.findFirst({ where: { verifyToken: undefined } });
  }

  for (const [label, query] of [
    ['no token at all', ''],
    ['bracket syntax in the query string (token[not]=)', '?token[not]='],
  ]) {
    test(`rejects a request with ${label}`, async (t) => {
      const target = await userTheBugWouldHit();
      if (target && !(target.verified && target.verifyToken === null)) {
        t.skip(`skipped: user ${target.id} is unverified, so the bug could change a real user`);
        return;
      }

      const res = await fetch(`${BASE_URL}/auth/verify${query}`);

      assert.equal(res.status, 400);
      if (target) {
        const after = await prisma.user.findUnique({ where: { id: target.id } });
        assert.equal(after.verified, target.verified);
        assert.equal(after.verifyToken, target.verifyToken);
      }
    });
  }
});
