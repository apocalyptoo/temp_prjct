// Race tests for account deletion (docs/features/account-deletion.md, d.2, P6): whatever
// happens to the user's teams while the account is being deleted, the deletion either
// finishes completely or changes nothing, and every team keeps exactly one captain, who
// is an accepted member of it.
//
// The first group is exact: it stops the deletion at a chosen step and does something
// else to the same team or account there. The second group fires both at once, many
// times over. Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createTestUser, createLoggedInPlayer, postJson } from './helpers.js';
import { deleteUserAndData, planAccountDeletion, previewCodeFor } from '../src/utils/deletion.js';

const ROUNDS = 12;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const player = (t) =>
  createTestUser(t, { verified: true, playerProfile: { create: { name: 'Race', phone: '01712345678', position: 'Any' } } });

// A team with these people in it, the first one captain, accepted in this order.
const teamOf = (...people) =>
  prisma.team.create({
    data: {
      name: 'Race FC',
      captainId: people[0].id,
      members: {
        create: people.map((user, index) => ({
          userId: user.id,
          status: 'accepted',
          origin: index === 0 ? 'creator' : 'invite',
          acceptedAt: new Date(Date.UTC(2026, 0, index + 1)),
        })),
      },
    },
  });
const addPending = (team, user, origin) =>
  prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, status: 'pending', origin } });

const exists = async (user) => (await prisma.user.findUnique({ where: { id: user.id } })) !== null;
const captainOf = async (team) => (await prisma.team.findUnique({ where: { id: team.id } }))?.captainId;

// The team is gone with all its rows, or its captain is one of its accepted members.
async function assertTeamIsSound(team) {
  const now = await prisma.team.findUnique({ where: { id: team.id }, include: { members: true } });
  if (!now) {
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
    return;
  }
  assert.ok(
    now.members.some((row) => row.userId === now.captainId && row.status === 'accepted'),
    'the captain is an accepted member'
  );
}

// The real Prisma client, except that inside a transaction `hook` runs before or after
// the first call of one step, for example { model: 'team', method: 'findMany', after }.
function clientWithHook({ model, method, before, after }) {
  let used = false;
  const bindAll = (obj, override) =>
    new Proxy(obj, {
      get(target, prop) {
        if (prop in override) return override[prop];
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  return {
    $transaction: (fn, options) =>
      prisma.$transaction((tx) => {
        const step = async (...args) => {
          const first = !used;
          used = true;
          if (first) await before?.();
          const result = await tx[model][method](...args);
          if (first) await after?.();
          return result;
        };
        return fn(bindAll(tx, { [model]: bindAll(tx[model], { [method]: step }) }));
      }, options),
  };
}

const call = async (method, path, jwt, body) => {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
};

describe('Something else happens while an account is being deleted', () => {
  test('a transfer to the user waits, then finds them gone', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const leaver = await player(t);
    const team = await teamOf(captain.user, leaver);
    let transfer;

    const result = await deleteUserAndData(
      clientWithHook({
        model: 'playerProfile',
        method: 'deleteMany',
        before: async () => {
          transfer = postJson(`/teams/${team.id}/transfer`, { userId: leaver.id }, captain.jwt);
          await sleep(300);
        },
      }),
      leaver.id
    );

    assert.equal(result.status, 'deleted');
    const reply = await transfer;
    assert.equal(reply.status, 404);
    assert.equal((await reply.json()).error, 'Player not found in this team.');
    assert.equal(await captainOf(team), captain.user.id);
    await assertTeamIsSound(team);
  });

  test('a team the user creates meanwhile cannot appear', async (t) => {
    const leaver = await player(t);
    let creating;

    const result = await deleteUserAndData(
      clientWithHook({
        model: 'playerProfile',
        method: 'deleteMany',
        before: async () => {
          creating = teamOf(leaver).then(() => 'created', (error) => error.code);
          await sleep(300);
        },
      }),
      leaver.id
    );

    assert.equal(result.status, 'deleted');
    assert.equal(await creating, 'P2003', 'the database refuses a team for an account that is gone');
    assert.equal(await prisma.team.count({ where: { captainId: leaver.id } }), 0);
  });

  test('a team joined after the list was read is found: the deletion starts over', async (t) => {
    const captain = await player(t);
    const leaver = await player(t);
    const team = await teamOf(captain);
    const runs = [];
    const client = clientWithHook({
      model: 'team',
      method: 'findMany',
      after: () =>
        prisma.teamMember.create({
          data: { teamId: team.id, userId: leaver.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
        }),
    });
    const counting = { $transaction: (...args) => (runs.push(1), client.$transaction(...args)) };

    const result = await deleteUserAndData(counting, leaver.id);

    assert.equal(result.status, 'deleted');
    assert.equal(runs.length, 2);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
    await assertTeamIsSound(team);
  });

  test('when the teams never stop changing, it gives up after 3 tries and changes nothing', async (t) => {
    const leaver = await player(t);
    let tries = 0;
    const restless = {
      $transaction: (...args) => {
        tries += 1;
        return clientWithHook({ model: 'team', method: 'findMany', after: () => teamOf(leaver) }).$transaction(...args);
      },
    };

    assert.deepEqual(await deleteUserAndData(restless, leaver.id), { status: 'stale' });
    assert.equal(tries, 3);
    assert.ok(await exists(leaver));
    assert.equal(await prisma.team.count({ where: { captainId: leaver.id } }), 3);
  });

  test('the password changed since it was checked: nothing is deleted', async (t) => {
    const user = await player(t);
    const team = await teamOf(user);
    const result = await deleteUserAndData(
      clientWithHook({
        model: 'team',
        method: 'findMany',
        after: () => prisma.user.update({ where: { id: user.id }, data: { password: 'another hash' } }),
      }),
      user.id,
      { passwordHash: user.password }
    );

    assert.deepEqual(result, { status: 'password-changed' });
    assert.ok(await exists(user));
    assert.equal(await captainOf(team), user.id);
  });

  test('the successor leaves before the locks are taken: the preview code refuses', async (t) => {
    const captain = await player(t);
    const next = await player(t);
    const team = await teamOf(captain, next);
    const previewCode = previewCodeFor(await planAccountDeletion(prisma, captain.id));

    const result = await deleteUserAndData(
      clientWithHook({
        model: 'team',
        method: 'findMany',
        after: () => prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: next.id } }),
      }),
      captain.id,
      { previewCode }
    );

    assert.deepEqual(result, { status: 'stale' });
    assert.ok(await exists(captain));
    assert.equal(await captainOf(team), captain.id);
  });

  test('an admin account is refused by the shared deletion itself; an unknown one is gone', async (t) => {
    const admin = await createTestUser(t, { role: 'ADMIN' });

    assert.deepEqual(await deleteUserAndData(prisma, admin.id), { status: 'admin' });
    assert.ok(await exists(admin));
    assert.deepEqual(await deleteUserAndData(prisma, 2147483647), { status: 'gone' });
  });
});

describe('Many at once', () => {
  test("the captain and the next in line delete their accounts at the same moment", async (t) => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, b, c] = [await player(t), await player(t), await player(t)];
      // Two teams in opposite order, so each is the other's successor.
      const teams = [await teamOf(a, b, c), await teamOf(b, a, c)];

      const results = await Promise.all([deleteUserAndData(prisma, a.id), deleteUserAndData(prisma, b.id)]);

      assert.deepEqual(results.map((result) => result.status), ['deleted', 'deleted'], `round ${round}`);
      for (const team of teams) {
        assert.equal(await captainOf(team), c.id, `round ${round}: the last one left is captain`);
        await assertTeamIsSound(team);
      }
    }
  });

  test('every member of a team deletes their account at once: the team goes too', async (t) => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const people = [await player(t), await player(t), await player(t), await player(t)];
      const team = await teamOf(...people);

      const results = await Promise.all(people.map((user) => deleteUserAndData(prisma, user.id)));

      assert.ok(results.every((result) => result.status === 'deleted'), `round ${round}`);
      assert.equal(await captainOf(team), undefined);
      await assertTeamIsSound(team);
    }
  });

  test('the same account twice at once: one deletes it, the other finds it gone', async (t) => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, b] = [await player(t), await player(t)];
      const team = await teamOf(a, b);

      const results = await Promise.all([deleteUserAndData(prisma, a.id), deleteUserAndData(prisma, a.id)]);

      assert.deepEqual(results.map((result) => result.status).sort(), ['deleted', 'gone'], `round ${round}`);
      assert.equal(await captainOf(team), b.id);
    }
  });

  test('a deletion against a transfer, a leave, an accept and an approval: no server error, sound teams', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const member = await createLoggedInPlayer(t);

    for (let round = 0; round < ROUNDS; round += 1) {
      const leaver = await createLoggedInPlayer(t);
      const toTransfer = await teamOf(captain.user, leaver.user);
      const toInherit = await teamOf(leaver.user, member.user, captain.user);
      const toJoin = await teamOf(captain.user);
      const toApprove = await teamOf(captain.user);
      await addPending(toJoin, leaver.user, 'invite');
      await addPending(toApprove, leaver.user, 'request');
      const approve = `/teams/${toApprove.id}/requests/${leaver.user.id}/approve`;

      const [deletion, ...statuses] = await Promise.all([
        deleteUserAndData(prisma, leaver.user.id),
        call('POST', `/teams/${toTransfer.id}/transfer`, captain.jwt, { userId: leaver.user.id }),
        call('POST', `/teams/${toInherit.id}/leave`, member.jwt),
        call('POST', `/teams/${toJoin.id}/accept`, leaver.jwt),
        call('POST', approve, captain.jwt),
        call('POST', `/teams/${toTransfer.id}/leave`, leaver.jwt),
      ]);

      assert.equal(deletion.status, 'deleted', `round ${round}`);
      assert.ok(statuses.every((status) => status < 500), `round ${round}: ${statuses}`);
      assert.equal(await prisma.teamMember.count({ where: { userId: leaver.user.id } }), 0);
      for (const team of [toTransfer, toInherit, toJoin, toApprove]) {
        await assertTeamIsSound(team);
        assert.notEqual(await captainOf(team), undefined, 'every team still has members, so none is deleted');
      }
      await prisma.team.deleteMany({ where: { id: { in: [toTransfer.id, toInherit.id, toJoin.id, toApprove.id] } } });
    }
  });

  test('a deletion against creating a team and being invited: no server error, nothing left behind', async (t) => {
    const captain = await createLoggedInPlayer(t);

    for (let round = 0; round < ROUNDS; round += 1) {
      const leaver = await createLoggedInPlayer(t);
      const team = await teamOf(captain.user);

      const [deletion, ...statuses] = await Promise.all([
        deleteUserAndData(prisma, leaver.user.id),
        call('POST', '/teams/create', leaver.jwt, { name: 'Race FC' }),
        call('POST', `/teams/${team.id}/invite`, captain.jwt, { userId: leaver.user.id }),
      ]);

      assert.equal(deletion.status, 'deleted', `round ${round}`);
      assert.ok(statuses.every((status) => status < 500), `round ${round}: ${statuses}`);
      assert.equal(await prisma.team.count({ where: { captainId: leaver.user.id } }), 0);
      assert.equal(await prisma.teamMember.count({ where: { userId: leaver.user.id } }), 0);
      await prisma.team.delete({ where: { id: team.id } });
    }
  });
});
