// Tests for deleting users and teams (docs/ROADMAP.md, Phase 2 "Admin delete route param
// mismatch" and Phase 3 "Wrap multi-step deletes in transactions").
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  BASE_URL,
  createLoggedInUser,
  createLoggedInPlayer,
  createTestUser,
  postJson,
} from './helpers.js';
import { deleteUserAndData, deleteTeamAndMembers } from '../src/utils/deletion.js';

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const getJson = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
};

const createLoggedInAdmin = (t) => createLoggedInUser(t, { role: 'ADMIN' });

// A player with a profile who captains two teams (one with another member, a pending
// invite and a join request; one alone) and is also a member of somebody else's team.
// Returns everything the tests need to check.
async function setUpPlayerWithTeams(t) {
  const player = await createTestUser(t, {
    verified: true,
    playerProfile: { create: { name: 'Delete Me', phone: '01700000000', position: 'Defender' } },
  });
  const teammate = await createTestUser(t, { verified: true });
  const otherCaptain = await createTestUser(t, { verified: true });
  const invited = await createTestUser(t, { verified: true });
  const requester = await createTestUser(t, { verified: true });

  const ownTeam = await prisma.team.create({
    data: {
      name: 'Own Team',
      captainId: player.id,
      members: {
        create: [
          { userId: player.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() },
          { userId: teammate.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
          { userId: invited.id, status: 'pending', origin: 'invite' },
          { userId: requester.id, status: 'pending', origin: 'request' },
        ],
      },
    },
  });
  const soloTeam = await prisma.team.create({
    data: {
      name: 'Solo Team',
      captainId: player.id,
      members: {
        create: [
          { userId: player.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() },
          { userId: invited.id, status: 'pending', origin: 'invite' },
        ],
      },
    },
  });
  const otherTeam = await prisma.team.create({
    data: {
      name: 'Other Team',
      captainId: otherCaptain.id,
      members: {
        create: [
          { userId: otherCaptain.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() },
          { userId: player.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
        ],
      },
    },
  });
  return { player, teammate, otherCaptain, invited, requester, ownTeam, soloTeam, otherTeam };
}

// Wraps the real Prisma client so that one step inside a transaction throws, for
// example failAt('user', 'delete'). Every step before it really runs against the
// database, inside the same transaction.
function failAt(modelName, methodName) {
  const bindAll = (obj, override) =>
    new Proxy(obj, {
      get(target, prop) {
        if (override && prop in override) return override[prop];
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  return {
    $transaction: (fn, options) =>
      prisma.$transaction((tx) => {
        const failingModel = bindAll(tx[modelName], {
          [methodName]: async () => {
            throw new Error(`forced failure at ${modelName}.${methodName}`);
          },
        });
        return fn(bindAll(tx, { [modelName]: failingModel }));
      }, options),
  };
}

describe('Admin deletes users', () => {
  test('admin deletes a player: the account goes, a team with members is handed over, a lone team goes', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const { player, teammate, otherCaptain, invited, requester, ownTeam, soloTeam, otherTeam } =
      await setUpPlayerWithTeams(t);

    const res = await sendDelete(`/admin/users/${player.id}`, admin.jwt);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'User deleted successfully' });
    assert.equal(await prisma.user.findUnique({ where: { id: player.id } }), null);
    assert.equal(await prisma.playerProfile.findUnique({ where: { userId: player.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { userId: player.id } }), 0);
    // Their team has a new captain, and keeps its pending invite and join request.
    assert.equal((await prisma.team.findUnique({ where: { id: ownTeam.id } })).captainId, teammate.id);
    const rows = await prisma.teamMember.findMany({ where: { teamId: ownTeam.id }, orderBy: { id: 'asc' } });
    assert.deepEqual(
      rows.map((row) => [row.userId, row.status, row.origin]),
      [
        [teammate.id, 'accepted', 'invite'],
        [invited.id, 'pending', 'invite'],
        [requester.id, 'pending', 'request'],
      ]
    );
    // The team they were alone in is gone, with its pending invite.
    assert.equal(await prisma.team.findUnique({ where: { id: soloTeam.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { teamId: soloTeam.id } }), 0);
    // The other team just loses this member.
    assert.equal((await prisma.team.findUnique({ where: { id: otherTeam.id } })).captainId, otherCaptain.id);
    assert.equal(await prisma.teamMember.count({ where: { teamId: otherTeam.id } }), 1);
  });

  test("the preview code: refused (409) when the outcome changed, deleted when it's current", async (t) => {
    const admin = await createLoggedInAdmin(t);
    const { player, teammate, ownTeam } = await setUpPlayerWithTeams(t);
    const preview = await getJson(`/admin/users/${player.id}/deletion-preview`, admin.jwt);

    // The next in line leaves: the team would now be deleted instead of handed over.
    await prisma.teamMember.deleteMany({ where: { teamId: ownTeam.id, userId: teammate.id } });
    const stale = await sendDelete(`/admin/users/${player.id}?previewCode=${preview.body.previewCode}`, admin.jwt);

    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error, "Something changed in this user's teams. Check what will happen and try again.");
    assert.ok(await prisma.user.findUnique({ where: { id: player.id } }), 'nothing is deleted');
    assert.equal((await prisma.team.findUnique({ where: { id: ownTeam.id } })).captainId, player.id);

    const fresh = await getJson(`/admin/users/${player.id}/deletion-preview`, admin.jwt);
    const res = await sendDelete(`/admin/users/${player.id}?previewCode=${fresh.body.previewCode}`, admin.jwt);
    assert.equal(res.status, 200);
    assert.equal(await prisma.user.findUnique({ where: { id: player.id } }), null);
  });

  test('a badly shaped preview code gets 400 on both routes, and nothing is deleted', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const owner = await createTestUser(t, {
      role: 'OWNER',
      verified: true,
      ownerProfile: { create: { indoorName: 'Code Arena' } },
    });

    for (const route of ['/admin/users', '/admin/indoors']) {
      for (const query of ['previewCode=', 'previewCode=abc', `previewCode=${'A'.repeat(64)}`, `previewCode=${'a'.repeat(64)}&previewCode=${'a'.repeat(64)}`]) {
        const res = await sendDelete(`${route}/${owner.id}?${query}`, admin.jwt);
        assert.equal(res.status, 400, `${route} ${query}`);
        assert.equal((await res.json()).error, 'Invalid preview code');
      }
    }
    assert.ok(await prisma.user.findUnique({ where: { id: owner.id } }));
  });

  test('admin deletes a venue owner from the venues screen route (/admin/indoors/:id)', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const owner = await createTestUser(t, {
      role: 'OWNER',
      verified: true,
      ownerProfile: { create: { indoorName: 'Delete Arena', phone: '01700000000', address: 'Test Road' } },
    });

    const res = await sendDelete(`/admin/indoors/${owner.id}`, admin.jwt);

    assert.equal(res.status, 200);
    assert.equal(await prisma.user.findUnique({ where: { id: owner.id } }), null);
    assert.equal(await prisma.ownerProfile.findUnique({ where: { userId: owner.id } }), null);
  });

  test('a bad id gets 400 and an unknown id gets 404, on both routes', async (t) => {
    const admin = await createLoggedInAdmin(t);

    for (const route of ['/admin/users', '/admin/indoors']) {
      for (const badId of ['abc', '0', '-1', '1.5', '99999999999']) {
        const res = await sendDelete(`${route}/${badId}`, admin.jwt);
        assert.equal(res.status, 400, `expected 400 for ${route}/${badId}`);
      }
      const unknown = await sendDelete(`${route}/2147483647`, admin.jwt);
      assert.equal(unknown.status, 404, `expected 404 for an unknown id on ${route}`);
    }
  });

  test('a player cannot use the admin delete routes', async (t) => {
    const player = await createLoggedInPlayer(t);
    const victim = await createTestUser(t, { verified: true });

    const res = await sendDelete(`/admin/users/${victim.id}`, player.jwt);

    assert.equal(res.status, 403);
    assert.ok(await prisma.user.findUnique({ where: { id: victim.id } }));
  });
});

describe('Deletes are all-or-nothing (transactions)', () => {
  for (const [model, method] of [
    ['team', 'update'], // the handover
    ['team', 'deleteMany'], // deleting the team they're alone in
    ['notification', 'createMany'], // telling the people it affects
    ['teamMember', 'deleteMany'],
    ['playerProfile', 'deleteMany'],
    ['user', 'delete'], // the last step
  ]) {
    test(`if a user delete fails at ${model}.${method}, nothing has changed`, async (t) => {
      const { player, teammate, otherCaptain, ownTeam, soloTeam, otherTeam } = await setUpPlayerWithTeams(t);
      // One update for the player, and one that names them.
      await prisma.notification.createMany({
        data: [
          { userId: player.id, type: 'becameCaptain', teamId: ownTeam.id, teamName: 'Own' },
          { userId: teammate.id, type: 'inviteAccepted', teamName: 'Own', playerId: player.id, playerName: 'Leaver' },
        ],
      });
      const countUpdates = () =>
        prisma.notification.count({ where: { userId: { in: [player.id, teammate.id, otherCaptain.id] } } });

      await assert.rejects(deleteUserAndData(failAt(model, method), player.id), /forced failure/);

      assert.equal(await countUpdates(), 2, 'no update was added or removed');

      assert.ok(await prisma.user.findUnique({ where: { id: player.id } }), 'user still exists');
      assert.ok(await prisma.playerProfile.findUnique({ where: { userId: player.id } }), 'profile still exists');
      for (const [team, rows] of [[ownTeam, 4], [soloTeam, 2]]) {
        assert.equal((await prisma.team.findUnique({ where: { id: team.id } }))?.captainId, player.id, `${team.name}: captain`);
        assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), rows, `${team.name}: rows`);
      }
      assert.equal(await prisma.teamMember.count({ where: { teamId: otherTeam.id, userId: player.id } }), 1);
    });
  }

  test('if deleting the team row fails, its members are not deleted either', async (t) => {
    const { ownTeam } = await setUpPlayerWithTeams(t);

    await assert.rejects(deleteTeamAndMembers(failAt('team', 'deleteMany'), ownTeam.id, { actorId: 1 }), /forced failure/);

    assert.ok(await prisma.team.findUnique({ where: { id: ownTeam.id } }));
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 4);
  });

  test('if telling its people fails, the team is not deleted (notifications spec D1)', async (t) => {
    const { ownTeam } = await setUpPlayerWithTeams(t);

    await assert.rejects(deleteTeamAndMembers(failAt('notification', 'createMany'), ownTeam.id, { actorId: 1 }), /forced failure/);

    assert.ok(await prisma.team.findUnique({ where: { id: ownTeam.id } }));
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 4);
  });
});

describe('Deleting teams still works', () => {
  test('admin deletes a team with its members', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const { ownTeam, player } = await setUpPlayerWithTeams(t);

    const res = await sendDelete(`/admin/teams/${ownTeam.id}`, admin.jwt);

    assert.equal(res.status, 200);
    assert.equal(await prisma.team.findUnique({ where: { id: ownTeam.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 0);
    assert.ok(await prisma.user.findUnique({ where: { id: player.id } }), 'the captain account stays');
  });

  test('admin gets 404 for an unknown team and 400 for a bad id', async (t) => {
    const admin = await createLoggedInAdmin(t);

    assert.equal((await sendDelete('/admin/teams/2147483647', admin.jwt)).status, 404);
    assert.equal((await sendDelete('/admin/teams/abc', admin.jwt)).status, 400);
  });

  test('the captain deletes their own team; another player cannot', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const other = await createLoggedInPlayer(t);
    const createRes = await postJson('/teams/create', { name: 'Doomed Team' }, captain.jwt);
    const team = await createRes.json();

    const forbidden = await sendDelete(`/teams/${team.id}`, other.jwt);
    assert.equal(forbidden.status, 403);
    assert.ok(await prisma.team.findUnique({ where: { id: team.id } }));

    const res = await sendDelete(`/teams/${team.id}`, captain.jwt);
    assert.equal(res.status, 200);
    assert.equal(await prisma.team.findUnique({ where: { id: team.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
  });
});
