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

const createLoggedInAdmin = (t) => createLoggedInUser(t, { role: 'ADMIN' });

// A player with a profile who captains a team (with one other member) and is also a
// member of somebody else's team. Returns everything the tests need to check.
async function setUpPlayerWithTeams(t) {
  const player = await createTestUser(t, {
    verified: true,
    playerProfile: { create: { name: 'Delete Me', phone: '01700000000', position: 'Defender' } },
  });
  const teammate = await createTestUser(t, { verified: true });
  const otherCaptain = await createTestUser(t, { verified: true });

  const ownTeam = await prisma.team.create({
    data: {
      name: 'Own Team',
      captainId: player.id,
      members: {
        create: [
          { userId: player.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() },
          { userId: teammate.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
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
  return { player, teammate, otherCaptain, ownTeam, otherTeam };
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
  test('admin deletes a player: account, profile, teams and memberships are all gone', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const { player, teammate, otherCaptain, ownTeam, otherTeam } = await setUpPlayerWithTeams(t);

    const res = await sendDelete(`/admin/users/${player.id}`, admin.jwt);

    assert.equal(res.status, 200);
    assert.equal(await prisma.user.findUnique({ where: { id: player.id } }), null);
    assert.equal(await prisma.playerProfile.findUnique({ where: { userId: player.id } }), null);
    assert.equal(await prisma.team.findUnique({ where: { id: ownTeam.id } }), null, 'their own team is deleted');
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 0);
    assert.equal(await prisma.teamMember.count({ where: { userId: player.id } }), 0);
    // Other people are untouched; the other team just loses this member.
    assert.ok(await prisma.user.findUnique({ where: { id: teammate.id } }));
    assert.ok(await prisma.team.findUnique({ where: { id: otherTeam.id } }));
    assert.equal(await prisma.teamMember.count({ where: { teamId: otherTeam.id, userId: otherCaptain.id } }), 1);
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
  test('if the last step of a user delete fails, nothing is deleted', async (t) => {
    const { player, teammate, ownTeam, otherTeam } = await setUpPlayerWithTeams(t);

    await assert.rejects(deleteUserAndData(failAt('user', 'delete'), player.id), /forced failure/);

    // Every earlier step (memberships, the team, the profile) was rolled back.
    assert.ok(await prisma.user.findUnique({ where: { id: player.id } }), 'user still exists');
    assert.ok(await prisma.playerProfile.findUnique({ where: { userId: player.id } }), 'profile still exists');
    assert.ok(await prisma.team.findUnique({ where: { id: ownTeam.id } }), 'own team still exists');
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 2, 'own team keeps both members');
    assert.equal(
      await prisma.teamMember.count({ where: { teamId: otherTeam.id, userId: player.id } }),
      1,
      'membership in the other team still exists'
    );
    assert.ok(await prisma.user.findUnique({ where: { id: teammate.id } }));
  });

  test('if deleting the team row fails, its members are not deleted either', async (t) => {
    const { ownTeam } = await setUpPlayerWithTeams(t);

    await assert.rejects(deleteTeamAndMembers(failAt('team', 'deleteMany'), ownTeam.id), /forced failure/);

    assert.ok(await prisma.team.findUnique({ where: { id: ownTeam.id } }));
    assert.equal(await prisma.teamMember.count({ where: { teamId: ownTeam.id } }), 2);
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
