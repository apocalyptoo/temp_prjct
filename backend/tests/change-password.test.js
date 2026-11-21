// POST /auth/change-password: change the password while logged in (docs/features/
// profiles-and-registration.md, d endpoint 6). The reply carries a fresh token for this
// phone; every older token of the account stops working. Safety rules are in helpers.js.
// All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import {
  BASE_URL,
  prisma,
  OLD_PASSWORD,
  NEW_PASSWORD,
  createLoggedInUser,
  deleteUserAfter,
  fakeClientIp,
  inOneHour,
  passwordIs,
  postJson,
  randomToken,
  sha256Hex,
} from './helpers.js';

const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
const PASSWORD_TOO_LONG =
  'Password must be at most 72 characters (emoji and non-English letters count as more than one)';
const REQUIRED = 'Current password and new password are required';

const change = (jwt, body, ip) => postJson('/auth/change-password', body, jwt, ip);

async function changeJson(jwt, body, ip) {
  const res = await change(jwt, body, ip);
  return { status: res.status, body: await res.json() };
}

const statusOfMe = async (jwt) =>
  (await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${jwt}` } })).status;

const login = (email, password) => postJson('/auth/login', { email, password });

const tokenVersionOf = async (userId) => (await prisma.user.findUnique({ where: { id: userId } })).tokenVersion;

const player = (t) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name: 'Changing Player', phone: '01712345678', position: 'Any' } },
  });

describe('A successful change', () => {
  test('replies with a fresh token that works; the new password logs in and the old one does not', async (t) => {
    const me = await player(t);
    const reply = await changeJson(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.message, 'Password changed');
    assert.equal(typeof reply.body.token, 'string');
    assert.equal(await statusOfMe(reply.body.token), 200, 'this phone stays logged in with the new token');
    assert.ok(await passwordIs(me.user.id, NEW_PASSWORD));
    assert.equal((await login(me.user.email, NEW_PASSWORD)).status, 200);
    assert.equal((await login(me.user.email, OLD_PASSWORD)).status, 400);
  });

  test('every older token stops working (logout on every other device)', async (t) => {
    const me = await player(t);
    const otherPhone = (await (await login(me.user.email, OLD_PASSWORD)).json()).token;
    assert.equal(await statusOfMe(otherPhone), 200);

    const before = await tokenVersionOf(me.user.id);
    const reply = await changeJson(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(reply.status, 200);

    assert.equal(await tokenVersionOf(me.user.id), before + 1);
    assert.equal(await statusOfMe(me.jwt), 401, 'the token that made the request is replaced');
    assert.equal(await statusOfMe(otherPhone), 401, 'the other phone is logged out');
  });

  test('a reset link sent before the change no longer works', async (t) => {
    const me = await player(t);
    const resetToken = randomToken();
    await prisma.user.update({
      where: { id: me.user.id },
      data: { resetToken: sha256Hex(resetToken), resetTokenExpires: inOneHour() },
    });

    assert.equal((await change(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })).status, 200);
    const user = await prisma.user.findUnique({ where: { id: me.user.id } });
    assert.equal(user.resetToken, null);
    assert.equal(user.resetTokenExpires, null);

    const reset = await postJson('/auth/reset', { token: resetToken, password: 'Another-pass-789!' });
    assert.equal(reset.status, 400);
    assert.equal((await reset.json()).error, 'Invalid or expired token');
  });

  test('works for venue owners and the admin too', async (t) => {
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Pass Arena' } } });
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    for (const someone of [owner, admin]) {
      const reply = await changeJson(someone.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
      assert.equal(reply.status, 200, someone.user.role);
    }
  });

  test('if the notice email fails to send, the reply is still 200 and the password is changed', async (t) => {
    // .invalid can never receive mail, so the mailer fails at once (see mailer.js).
    const email = `test-${crypto.randomUUID()}@mail.invalid`;
    deleteUserAfter(t, email);
    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(OLD_PASSWORD, 10), role: 'PLAYER', verified: true },
    });
    const { token } = await (await login(email, OLD_PASSWORD)).json();

    const reply = await changeJson(token, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(reply.status, 200);
    assert.ok(await passwordIs(user.id, NEW_PASSWORD));
  });
});

describe('Refused changes leave everything as it was', () => {
  test('a wrong current password gets 400 (never 401), and the old token keeps working', async (t) => {
    const me = await player(t);
    const before = await tokenVersionOf(me.user.id);

    const reply = await changeJson(me.jwt, { currentPassword: 'Wrong-pass-123!', newPassword: NEW_PASSWORD });
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, 'Current password is incorrect');
    assert.equal(await tokenVersionOf(me.user.id), before);
    assert.ok(await passwordIs(me.user.id, OLD_PASSWORD));
    assert.equal(await statusOfMe(me.jwt), 200);
  });

  test('each problem with the body has its message', async (t) => {
    const me = await player(t);
    const cases = [
      [{}, REQUIRED],
      [{ currentPassword: OLD_PASSWORD }, REQUIRED],
      [{ newPassword: NEW_PASSWORD }, REQUIRED],
      [{ currentPassword: '', newPassword: NEW_PASSWORD }, REQUIRED],
      [{ currentPassword: { not: '' }, newPassword: NEW_PASSWORD }, REQUIRED],
      [{ currentPassword: OLD_PASSWORD, newPassword: ['x'] }, REQUIRED],
      [{ currentPassword: OLD_PASSWORD, newPassword: 'weak' }, PASSWORD_RULE_MESSAGE],
      [{ currentPassword: OLD_PASSWORD, newPassword: 'Aa1!' + 'a'.repeat(69) }, PASSWORD_TOO_LONG],
      [{ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD }, 'Your new password must be different from your current one'],
    ];
    for (const [body, message] of cases) {
      const reply = await changeJson(me.jwt, body);
      assert.equal(reply.status, 400, JSON.stringify(body));
      assert.equal(reply.body.error, message, JSON.stringify(body));
    }
    assert.ok(await passwordIs(me.user.id, OLD_PASSWORD), 'nothing changed');
    assert.equal(await statusOfMe(me.jwt), 200);
  });

  test('a 72-byte new password is accepted', async (t) => {
    const me = await player(t);
    const reply = await changeJson(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: 'Aa1!' + 'a'.repeat(68) });
    assert.equal(reply.status, 200);
  });

  test('no token gets 401', async () => {
    const res = await change(undefined, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(res.status, 401);
  });
});

describe('Rate limits (failed attempts only)', () => {
  const wrong = { currentPassword: 'Wrong-pass-123!', newPassword: NEW_PASSWORD };

  test('10 failed attempts per account, then 429, from any address', async (t) => {
    const me = await player(t);
    for (let i = 0; i < 10; i++) {
      assert.equal((await change(me.jwt, wrong)).status, 400, `attempt ${i + 1}`);
    }
    const limited = await changeJson(me.jwt, wrong);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error, 'Too many attempts to change your password. Please wait 15 minutes and try again.');
    // The limit is per account: even the right password is refused for now.
    assert.equal((await change(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })).status, 429);
  });

  test('a successful change does not count', async (t) => {
    const me = await player(t);
    for (let i = 0; i < 9; i++) assert.equal((await change(me.jwt, wrong)).status, 400);
    const success = await changeJson(me.jwt, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(success.status, 200, 'request 10 is a success');
    const jwt = success.body.token;
    const wrongNow = { currentPassword: 'Wrong-pass-123!', newPassword: 'Third-pass-789!' };
    assert.equal((await change(jwt, wrongNow)).status, 400, 'the 10th failure is still allowed');
    assert.equal((await change(jwt, wrongNow)).status, 429, 'the 11th failure is refused');
  });

  test('50 failed attempts per address across accounts, then 429; another address still works', async (t) => {
    const ip = fakeClientIp();
    const accounts = [];
    for (let i = 0; i < 6; i++) accounts.push(await player(t));
    let sent = 0;
    for (const account of accounts) {
      for (let i = 0; i < 9 && sent < 50; i++, sent++) {
        assert.equal((await change(account.jwt, wrong, ip)).status, 400, `failure ${sent + 1}`);
      }
    }
    assert.equal(sent, 50);
    assert.equal((await change(accounts[5].jwt, wrong, ip)).status, 429, 'failure 51 from that address');
    assert.equal((await change(accounts[5].jwt, wrong, fakeClientIp())).status, 400, 'a different address has its own cap');
  });
});
