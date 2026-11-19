// Tests for GET /auth/me (docs/ROADMAP.md, Phase 2 "Persist login on app start"): the app
// calls it at start-up with the saved token to find out who is logged in.
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma, BASE_URL, createLoggedInUser } from './helpers.js';

const getMe = (headers = {}) => fetch(`${BASE_URL}/auth/me`, { headers });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('GET /auth/me', () => {
  test('with a valid token, returns your own id, name, email, role and verified', async (t) => {
    const { user, jwt: token } = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Me Myself', phone: '01700000000', position: 'Forward' } },
    });

    const res = await getMe(bearer(token));
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body, { id: user.id, name: 'Me Myself', email: user.email, role: 'PLAYER', verified: true });
  });

  test('a venue owner gets their venue name as the name', async (t) => {
    const { jwt: token } = await createLoggedInUser(t, {
      role: 'OWNER',
      ownerProfile: { create: { indoorName: 'My Arena', phone: '01700000000', address: 'Test Road' } },
    });

    const body = await (await getMe(bearer(token))).json();

    assert.equal(body.name, 'My Arena');
    assert.equal(body.role, 'OWNER');
  });

  test('never includes secrets', async (t) => {
    const { jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });

    const text = await (await getMe(bearer(token))).text();

    assert.doesNotMatch(text, /password|resetToken|verifyToken/i);
  });

  test('without a token gets 401', async () => {
    assert.equal((await getMe()).status, 401);
  });

  test('with a bad or expired token gets 401', async (t) => {
    const { user } = await createLoggedInUser(t, { role: 'PLAYER' });
    const expired = jwt.sign({ id: user.id, userId: user.id, role: 'PLAYER' }, process.env.JWT_SECRET, {
      expiresIn: -10,
    });
    const wrongSecret = jwt.sign({ id: user.id, userId: user.id, role: 'PLAYER' }, 'not-the-real-secret');

    for (const token of ['not-a-jwt', expired, wrongSecret]) {
      assert.equal((await getMe(bearer(token))).status, 401, `token ${token.slice(0, 12)}…`);
    }
  });

  test('with a valid token for an account that no longer exists gets 401', async (t) => {
    const { user, jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });
    await prisma.user.delete({ where: { id: user.id } });

    assert.equal((await getMe(bearer(token))).status, 401);
  });
});
