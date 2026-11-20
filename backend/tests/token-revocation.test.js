// Tests 30-day login tokens and revocation through User.tokenVersion (src/middleware/auth.js,
// login and reset in authController.js). Safety rules are in helpers.js.
//
// Some tests sign their own tokens with the real secret, read from the server's config
// (src/config.js loads backend/.env and checks it, like the server does).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import {
  prisma,
  BASE_URL,
  OLD_PASSWORD,
  NEW_PASSWORD,
  createTestUser,
  createLoggedInUser,
  postJson,
  randomToken,
  sha256Hex,
  inOneHour,
} from './helpers.js';

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

const getWithAuth = (path, authorization) =>
  fetch(BASE_URL + path, authorization === undefined ? {} : { headers: { Authorization: authorization } });

const getMe = (authorization) => getWithAuth('/auth/me', authorization);

// A token signed with the real secret and HS256, with whatever claims the test chooses.
const signToken = (claims, options = {}) =>
  jwt.sign(claims, config.jwtSecret, { algorithm: 'HS256', expiresIn: '1h', ...options });

const claimsFor = (user) => ({ id: user.id, userId: user.id, role: user.role, email: user.email });

async function login(email, password) {
  const res = await postJson('/auth/login', { email, password });
  assert.equal(res.status, 200, 'login should work');
  return (await res.json()).token;
}

describe('Login tokens', () => {
  test('carry the tokenVersion as `tv` and expire 30 days after they were issued', async (t) => {
    const { user, jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });

    const claims = jwt.decode(token, { complete: true });

    assert.equal(claims.header.alg, 'HS256');
    assert.equal(claims.payload.tv, 0);
    assert.equal(claims.payload.tv, user.tokenVersion);
    assert.equal(claims.payload.exp - claims.payload.iat, THIRTY_DAYS_IN_SECONDS);
    assert.equal(claims.payload.id, user.id);
    assert.equal(claims.payload.userId, user.id);
    assert.equal(claims.payload.role, 'PLAYER');
    assert.equal(claims.payload.email, user.email);
  });

  test('a valid token works', async (t) => {
    const { user, jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });

    const res = await getMe(`Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal((await res.json()).id, user.id);
  });
});

describe('A password reset logs the account out everywhere', () => {
  test('the old token gets 401 after the reset; a new login works', async (t) => {
    const resetToken = randomToken();
    const user = await createTestUser(t, {
      verified: true,
      resetToken: sha256Hex(resetToken),
      resetTokenExpires: inOneHour(),
    });
    const oldToken = await login(user.email, OLD_PASSWORD);
    assert.equal((await getMe(`Bearer ${oldToken}`)).status, 200, 'works before the reset');

    const reset = await postJson('/auth/reset', { token: resetToken, password: NEW_PASSWORD });
    assert.equal(reset.status, 200);

    const afterReset = await getMe(`Bearer ${oldToken}`);
    assert.equal(afterReset.status, 401);
    assert.deepEqual(await afterReset.json(), { error: 'Invalid token' });
    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(stored.tokenVersion, 1, 'the reset increased tokenVersion by one');

    const newToken = await login(user.email, NEW_PASSWORD);
    assert.equal(jwt.decode(newToken).tv, 1);
    assert.equal((await getMe(`Bearer ${newToken}`)).status, 200);
  });
});

describe('Tokens whose tv does not match', () => {
  test('a correctly signed token with the right tv works (the control case)', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const res = await getMe(`Bearer ${signToken({ ...claimsFor(user), tv: 0 })}`);
    assert.equal(res.status, 200);
  });

  test('no tv claim (a token from before this change) gets 401', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const res = await getMe(`Bearer ${signToken(claimsFor(user))}`);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Invalid token' });
  });

  test('a wrong tv gets 401 (a higher number, an older one, or text)', async (t) => {
    const user = await createTestUser(t, { verified: true, tokenVersion: 3 });
    for (const tv of [4, 2, 0, '3']) {
      const res = await getMe(`Bearer ${signToken({ ...claimsFor(user), tv })}`);
      assert.equal(res.status, 401, `tv ${JSON.stringify(tv)}`);
    }
    assert.equal((await getMe(`Bearer ${signToken({ ...claimsFor(user), tv: 3 })}`)).status, 200);
  });

  test('a token for an account that no longer exists gets 401', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const token = signToken({ ...claimsFor(user), tv: 0 });
    await prisma.user.delete({ where: { id: user.id } });

    assert.equal((await getMe(`Bearer ${token}`)).status, 401);
  });
});

describe('req.user comes from the database, not from the token', () => {
  test('a token claiming ADMIN for a player account gets 403 on an admin route', async (t) => {
    const user = await createTestUser(t, { verified: true, role: 'PLAYER' });
    const token = signToken({ ...claimsFor(user), role: 'ADMIN', tv: 0 });

    const res = await getWithAuth('/admin/stats', `Bearer ${token}`);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Access denied. Admins only.' });
  });

  test('a role change takes effect at once, without logging in again', async (t) => {
    const { user, jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });
    await prisma.user.update({ where: { id: user.id }, data: { role: 'OWNER' } });

    const res = await getMe(`Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal((await res.json()).role, 'OWNER');
  });
});

describe('The Authorization header must be exactly "Bearer <token>"', () => {
  test('a missing header gets 401 "No token"', async () => {
    const res = await getMe();
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'No token' });
  });

  test('other shapes get 401 "Invalid token"', async (t) => {
    const { jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });
    const shapes = [
      'Basic xyz',
      'Bearer',
      'Bearer a b',
      `Bearer  ${token}`, // two spaces
      `Bearer ${token} extra`,
      `Token ${token}`,
      token, // no "Bearer" at all
    ];
    for (const header of shapes) {
      const res = await getMe(header);
      assert.equal(res.status, 401, `header ${JSON.stringify(header.slice(0, 20))}`);
      assert.deepEqual(await res.json(), { error: 'Invalid token' });
    }
  });

  test('the word Bearer is case-insensitive', async (t) => {
    const { jwt: token } = await createLoggedInUser(t, { role: 'PLAYER' });
    for (const word of ['bearer', 'BEARER', 'Bearer']) {
      assert.equal((await getMe(`${word} ${token}`)).status, 200, word);
    }
  });
});

describe('Only HS256 tokens are accepted', () => {
  test('a token signed with HS512 (same secret) gets 401', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const token = jwt.sign({ ...claimsFor(user), tv: 0 }, config.jwtSecret, { algorithm: 'HS512', expiresIn: '1h' });

    assert.equal((await getMe(`Bearer ${token}`)).status, 401);
  });

  test('an unsigned token ("alg": "none") gets 401', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const part = (object) => Buffer.from(JSON.stringify(object)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${part({ alg: 'none', typ: 'JWT' })}.${part({ ...claimsFor(user), tv: 0, iat: now, exp: now + 3600 })}.`;

    assert.equal((await getMe(`Bearer ${unsigned}`)).status, 401);
  });
});
