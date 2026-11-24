// Tests for deleting your own account (POST /auth/delete-account; docs/features/
// account-deletion.md, d.4 endpoint 2). The plan, the locks and the notice email have
// their own tests (deletion-plan, delete-account-races, account-deleted-notice).
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  BASE_URL,
  OLD_PASSWORD,
  NEW_PASSWORD,
  createLoggedInUser,
  createTestUser,
  deleteUserAfter,
  fakeClientIp,
  postJson,
} from './helpers.js';

const profile = (name) => ({ create: { name, phone: '01712345678', position: 'Any' } });
const loggedInPlayer = (t, name = 'Player') => createLoggedInUser(t, { playerProfile: profile(name) });
const mate = (t, name = 'Mate') => createTestUser(t, { verified: true, playerProfile: profile(name) });
const day = (n) => new Date(Date.UTC(2026, 0, n));

// A team with these people in it, the first one captain, accepted in this order.
const teamOf = (name, ...people) =>
  prisma.team.create({
    data: {
      name,
      captainId: people[0].id,
      members: {
        create: people.map((user, index) => ({
          userId: user.id,
          status: 'accepted',
          origin: index === 0 ? 'creator' : 'invite',
          acceptedAt: day(index + 1),
        })),
      },
    },
  });
const addPending = (team, user, origin) =>
  prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, status: 'pending', origin } });

const previewCodeOf = async (jwt) => {
  const res = await fetch(`${BASE_URL}/auth/deletion-preview`, { headers: { Authorization: `Bearer ${jwt}` } });
  return (await res.json()).previewCode;
};
const send = async (jwt, body, ip) => {
  const res = await postJson('/auth/delete-account', body, jwt, ip);
  return { status: res.status, body: await res.json() };
};
const deleteAccount = async (jwt) => send(jwt, { password: OLD_PASSWORD, previewCode: await previewCodeOf(jwt) });

const exists = async (id) => (await prisma.user.findUnique({ where: { id } })) !== null;
const captainOf = async (team) => (await prisma.team.findUnique({ where: { id: team.id } }))?.captainId;
const statusOfMe = async (jwt) =>
  (await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${jwt}` } })).status;

const CHANGED = { status: 409, body: { error: 'Something changed in your teams. Check what will happen and try again.' } };
const DELETED = { status: 200, body: { message: 'Your account was deleted.' } };

describe('Deleting your own account', () => {
  test('the account, the profile and every row of theirs are gone, and every login is dead', async (t) => {
    const me = await loggedInPlayer(t);
    const captain = await mate(t, 'Captain');
    const other = await teamOf('Other FC', captain, me.user);
    const invitedTo = await teamOf('Invited FC', captain);
    const askedTo = await teamOf('Asked FC', captain);
    await addPending(invitedTo, me.user, 'invite');
    await addPending(askedTo, me.user, 'request');
    const second = await (await postJson('/auth/login', { email: me.user.email, password: OLD_PASSWORD })).json();

    assert.deepEqual(await deleteAccount(me.jwt), DELETED);

    assert.equal(await exists(me.user.id), false);
    assert.equal(await prisma.playerProfile.findUnique({ where: { userId: me.user.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { userId: me.user.id } }), 0);
    // Their other teams stay, one member or pending row lighter.
    for (const team of [other, invitedTo, askedTo]) {
      assert.equal(await captainOf(team), captain.id);
      assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
    }
    assert.equal(await statusOfMe(me.jwt), 401);
    assert.equal(await statusOfMe(second.token), 401, 'a second device is logged out too');
    const login = await postJson('/auth/login', { email: me.user.email, password: OLD_PASSWORD });
    assert.equal(login.status, 400);
    assert.equal((await login.json()).error, 'Invalid email or password');
  });

  test('a captained team is handed over: only the captain changes, and its pending rows stay', async (t) => {
    const me = await loggedInPlayer(t);
    const [next, third, invited, requester] = [await mate(t), await mate(t), await mate(t), await mate(t)];
    const team = await teamOf('Kept FC', me.user, next, third);
    await addPending(team, invited, 'invite');
    await addPending(team, requester, 'request');
    const before = await prisma.team.findUnique({ where: { id: team.id } });
    const rowsBefore = await prisma.teamMember.findMany({
      where: { teamId: team.id, userId: { not: me.user.id } },
      orderBy: { id: 'asc' },
    });

    assert.deepEqual(await deleteAccount(me.jwt), DELETED);

    assert.deepEqual(await prisma.team.findUnique({ where: { id: team.id } }), { ...before, captainId: next.id });
    assert.deepEqual(
      await prisma.teamMember.findMany({ where: { teamId: team.id }, orderBy: { id: 'asc' } }),
      rowsBefore
    );
  });

  test('a team they are alone in goes, with its pending rows', async (t) => {
    const me = await loggedInPlayer(t);
    const team = await teamOf('Solo FC', me.user);
    await addPending(team, await mate(t), 'invite');
    await addPending(team, await mate(t), 'request');

    assert.deepEqual(await deleteAccount(me.jwt), DELETED);

    assert.equal(await captainOf(team), undefined);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
  });

  test("a venue owner's listing leaves venue discovery", async (t) => {
    const owner = await createLoggedInUser(t, {
      role: 'OWNER',
      ownerProfile: {
        create: { indoorName: `Gone ${Date.now()}`, phone: '01712345678', address: 'Road 1', area: 'Mirpur', approvedAt: new Date() },
      },
    });
    const viewer = await loggedInPlayer(t);
    const venueStatus = async () =>
      (await fetch(`${BASE_URL}/owners/${owner.user.id}`, { headers: { Authorization: `Bearer ${viewer.jwt}` } })).status;
    assert.equal(await venueStatus(), 200);

    assert.deepEqual(await deleteAccount(owner.jwt), DELETED);

    assert.equal(await venueStatus(), 404);
    assert.equal(await prisma.ownerProfile.findUnique({ where: { userId: owner.user.id } }), null);
  });

  test('the same email can sign up again, with a fresh account', async (t) => {
    const me = await loggedInPlayer(t);
    await teamOf('Old FC', me.user);
    assert.deepEqual(await deleteAccount(me.jwt), DELETED);

    deleteUserAfter(t, me.user.email);
    const res = await postJson('/auth/register', {
      email: me.user.email,
      password: NEW_PASSWORD,
      role: 'PLAYER',
      name: 'Fresh Start',
      profileData: { phone: '01712345678', position: 'Any' },
      acceptedTerms: true,
    });

    assert.equal(res.status, 201);
    const fresh = await prisma.user.findUnique({ where: { email: me.user.email }, include: { teamMembers: true } });
    assert.notEqual(fresh.id, me.user.id);
    assert.equal(fresh.verified, false);
    assert.deepEqual(fresh.teamMembers, []);
  });
});

describe('Refused deletions change nothing', () => {
  test('a wrong password gets 400, never 401, and the login keeps working', async (t) => {
    const me = await loggedInPlayer(t);
    const team = await teamOf('Safe FC', me.user);

    const reply = await send(me.jwt, { password: 'Wrong-pass-123!', previewCode: await previewCodeOf(me.jwt) });

    assert.deepEqual(reply, { status: 400, body: { error: 'Password is incorrect' } });
    assert.equal(await statusOfMe(me.jwt), 200);
    assert.equal(await captainOf(team), me.user.id);
  });

  test('each problem with the body has its message, the password first', async (t) => {
    const me = await loggedInPlayer(t);
    const previewCode = await previewCodeOf(me.jwt);
    const PASSWORD = 'Password is required';
    const PREVIEW = 'Check what will happen before deleting your account';

    for (const [body, error] of [
      [{}, PASSWORD],
      [[], PASSWORD],
      [{ previewCode }, PASSWORD],
      [{ password: '', previewCode }, PASSWORD],
      [{ password: null, previewCode }, PASSWORD],
      [{ password: 12345678, previewCode }, PASSWORD],
      [{ password: { not: '' }, previewCode }, PASSWORD],
      [{ password: OLD_PASSWORD }, PREVIEW],
      [{ password: OLD_PASSWORD, previewCode: '' }, PREVIEW],
      [{ password: OLD_PASSWORD, previewCode: 'abc' }, PREVIEW],
      [{ password: OLD_PASSWORD, previewCode: previewCode.toUpperCase().replace(/\d/g, 'A') }, PREVIEW],
      [{ password: OLD_PASSWORD, previewCode: `${previewCode}\n` }, PREVIEW],
      [{ password: OLD_PASSWORD, previewCode: { not: '' } }, PREVIEW],
    ]) {
      const reply = await send(me.jwt, body);
      assert.deepEqual(reply, { status: 400, body: { error } }, JSON.stringify(body));
    }
    assert.ok(await exists(me.user.id));
  });

  test('the next in line left since the preview: 409, then the new code works', async (t) => {
    const me = await loggedInPlayer(t);
    const [next, third] = [await mate(t), await mate(t)];
    const team = await teamOf('Changing FC', me.user, next, third);
    const previewCode = await previewCodeOf(me.jwt);
    await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: next.id } });

    assert.deepEqual(await send(me.jwt, { password: OLD_PASSWORD, previewCode }), CHANGED);
    assert.ok(await exists(me.user.id));
    assert.equal(await captainOf(team), me.user.id);

    assert.deepEqual(await deleteAccount(me.jwt), DELETED);
    assert.equal(await captainOf(team), third.id);
  });

  test('somebody joined a team they were alone in: 409, so the team is not deleted under them', async (t) => {
    const me = await loggedInPlayer(t);
    const team = await teamOf('Growing FC', me.user);
    const previewCode = await previewCodeOf(me.jwt);
    const joined = await mate(t);
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: joined.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
    });

    assert.deepEqual(await send(me.jwt, { password: OLD_PASSWORD, previewCode }), CHANGED);
    assert.ok(await exists(me.user.id));
  });

  test('they were made captain of another team: 409', async (t) => {
    const me = await loggedInPlayer(t);
    const captain = await mate(t);
    const team = await teamOf('Transfer FC', captain, me.user);
    const previewCode = await previewCodeOf(me.jwt);
    await prisma.team.update({ where: { id: team.id }, data: { captainId: me.user.id } });

    assert.deepEqual(await send(me.jwt, { password: OLD_PASSWORD, previewCode }), CHANGED);
    assert.ok(await exists(me.user.id));
  });

  test("a renamed team doesn't matter", async (t) => {
    const me = await loggedInPlayer(t);
    const next = await mate(t);
    const team = await teamOf('Old Name', me.user, next);
    const previewCode = await previewCodeOf(me.jwt);
    await prisma.team.update({ where: { id: team.id }, data: { name: 'New Name' } });

    assert.deepEqual(await send(me.jwt, { password: OLD_PASSWORD, previewCode }), DELETED);
    assert.equal(await captainOf(team), next.id);
  });

  test('the admin gets 403 whatever the body says; no login gets 401', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });

    for (const body of [{}, { password: OLD_PASSWORD, previewCode: 'a'.repeat(64) }]) {
      assert.deepEqual(await send(admin.jwt, body), {
        status: 403,
        body: { error: "The admin account can't be deleted in the app." },
      });
    }
    assert.ok(await exists(admin.user.id));
    assert.equal((await send(undefined, { password: OLD_PASSWORD })).status, 401);
  });

  test('the same account from two devices at once: one 200, the other logged out', async (t) => {
    const me = await loggedInPlayer(t);
    const previewCode = await previewCodeOf(me.jwt);
    const body = { password: OLD_PASSWORD, previewCode };

    const replies = await Promise.all([send(me.jwt, body), send(me.jwt, body)]);

    assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 401]);
    assert.equal(await exists(me.user.id), false);
  });
});

describe('Rate limits (failed attempts only)', () => {
  const TOO_MANY = { error: 'Too many attempts to delete your account. Please wait 15 minutes and try again.' };
  const wrong = { password: 'Wrong-pass-123!', previewCode: 'a'.repeat(64) };

  test('10 wrong passwords per account, then 429, from any address; change password is not affected', async (t) => {
    const me = await loggedInPlayer(t);
    for (let i = 0; i < 10; i += 1) assert.equal((await send(me.jwt, wrong)).status, 400, `failure ${i + 1}`);

    assert.deepEqual(await send(me.jwt, wrong), { status: 429, body: TOO_MANY });
    // Even the right password is refused for now.
    assert.equal((await deleteAccount(me.jwt)).status, 429);
    assert.ok(await exists(me.user.id));

    const change = await postJson('/auth/change-password', { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD }, me.jwt);
    assert.equal(change.status, 200);
  });

  test("a 409 doesn't count", async (t) => {
    const me = await loggedInPlayer(t);
    for (let i = 0; i < 11; i += 1) {
      const reply = await send(me.jwt, { password: OLD_PASSWORD, previewCode: 'a'.repeat(64) });
      assert.deepEqual(reply, CHANGED, `attempt ${i + 1}`);
    }
    assert.deepEqual(await deleteAccount(me.jwt), DELETED);
  });

  test('50 failures per address across accounts, then 429; another address still works', async (t) => {
    const ip = fakeClientIp();
    for (let account = 0; account < 5; account += 1) {
      const { jwt } = await loggedInPlayer(t);
      const replies = await Promise.all(Array.from({ length: 10 }, () => send(jwt, wrong, ip)));
      assert.ok(replies.every((reply) => reply.status === 400), `account ${account + 1}`);
    }
    const sixth = await loggedInPlayer(t);

    assert.deepEqual(await send(sixth.jwt, wrong, ip), { status: 429, body: TOO_MANY });
    assert.equal((await send(sixth.jwt, wrong)).status, 400);
  });
});
