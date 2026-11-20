// Tests for Task 4.2: membership data. TeamMember.status is an enum (pending, accepted),
// origin records how a membership started (invite, request, creator), createdAt is when
// it was created, and acceptedAt is set when it becomes accepted. Profiles and
// memberships cascade with their user and team; a captain can't be deleted.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, createTestUser, postJson } from './helpers.js';

const get = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path}`);
  return res.json();
};

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

async function createTeam(captain, name = 'Membership Test') {
  const res = await postJson('/teams/create', { name }, captain.jwt);
  assert.equal(res.status, 201, 'team creation should work');
  return res.json();
}

// The server and the tests run on the same machine, so its clock is ours. A second
// either way allows for rounding to milliseconds in the database.
function assertRecent(date, since, what) {
  assert.ok(date instanceof Date, `${what} should be set`);
  assert.ok(date.getTime() >= since - 1000 && date.getTime() <= Date.now() + 1000, `${what} should be about now`);
}

// Fields a membership row in a reply must not have yet (feature 1 decides) or any more.
function assertReplyRow(row, where) {
  assert.ok('createdAt' in row, `${where}: has createdAt`);
  for (const field of ['joinedAt', 'origin', 'acceptedAt', 'role']) {
    assert.equal(field in row, false, `${where}: no ${field}`);
  }
}

describe('Creating a team', () => {
  test("the captain's row is origin creator, accepted, with acceptedAt set", async (t) => {
    const captain = await createLoggedInPlayer(t);
    const since = Date.now();

    const team = await createTeam(captain);

    const row = await membership(team.id, captain.user.id);
    assert.equal(row.origin, 'creator');
    assert.equal(row.status, 'accepted');
    assertRecent(row.acceptedAt, since, 'acceptedAt');
    assertRecent(row.createdAt, since, 'createdAt');
  });
});

describe('Invites', () => {
  test('an invite is origin invite, pending, with no acceptedAt; accepting sets acceptedAt', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createLoggedInPlayer(t);
    const team = await createTeam(captain);

    const inviteRes = await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt);
    assert.equal(inviteRes.status, 201);
    assertReplyRow(await inviteRes.json(), 'invite reply');

    const pending = await membership(team.id, player.user.id);
    assert.equal(pending.origin, 'invite');
    assert.equal(pending.status, 'pending');
    assert.equal(pending.acceptedAt, null);

    const since = Date.now();
    assert.equal((await postJson(`/teams/${team.id}/accept`, {}, player.jwt)).status, 200);

    const accepted = await membership(team.id, player.user.id);
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.origin, 'invite', 'accepting keeps the origin');
    assertRecent(accepted.acceptedAt, since, 'acceptedAt');
    assert.equal(accepted.createdAt.getTime(), pending.createdAt.getTime(), 'createdAt stays the invite date');
  });

  test('rejecting an invite still deletes the row', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createLoggedInPlayer(t);
    const team = await createTeam(captain);
    await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt);

    assert.equal((await postJson(`/teams/${team.id}/reject`, {}, player.jwt)).status, 200);

    assert.equal(await membership(team.id, player.user.id), null);
  });
});

describe('Replies', () => {
  test('membership rows in team and invite replies have createdAt, and no joinedAt, origin or acceptedAt', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const member = await createLoggedInPlayer(t);
    const invitee = await createLoggedInPlayer(t);
    const team = await createTeam(captain);
    await postJson(`/teams/${team.id}/invite`, { userId: member.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/accept`, {}, member.jwt);
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);

    for (const path of ['/teams', '/teams/me']) {
      const found = (await get(path, captain.jwt)).find((tm) => tm.id === team.id);
      assert.equal(found.members.length, 2, `${path}: captain and member`);
      assert.equal(found.pendingInvites.length, 1, `${path}: one pending invite`);
      for (const row of [...found.members, ...found.pendingInvites]) assertReplyRow(row, path);
    }

    const invite = (await get('/players/invites', invitee.jwt)).find((i) => i.teamId === team.id);
    assertReplyRow(invite, '/players/invites');
  });
});

describe('Cascade (deleting directly with Prisma, as a safety net)', () => {
  test('deleting a team removes its membership rows', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createLoggedInPlayer(t);
    const team = await createTeam(captain);
    await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 2);

    await prisma.team.delete({ where: { id: team.id } });

    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
  });

  test("deleting a user who isn't a captain removes their profile and memberships", async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Cascade Me', phone: '01700000000', position: 'Defender' } },
    });
    const team = await createTeam(captain);
    const otherTeam = await createTeam(captain, 'Second Team');
    await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/accept`, {}, player.jwt);
    await postJson(`/teams/${otherTeam.id}/invite`, { userId: player.user.id }, captain.jwt);

    await prisma.user.delete({ where: { id: player.user.id } });

    assert.equal(await prisma.playerProfile.findUnique({ where: { userId: player.user.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { userId: player.user.id } }), 0, 'accepted and pending rows are gone');
    assert.ok(await membership(team.id, captain.user.id), "the team and its captain's row are untouched");
  });

  test("deleting a venue owner removes their venue profile", async (t) => {
    const owner = await createTestUser(t, {
      role: 'OWNER',
      ownerProfile: { create: { indoorName: 'Cascade Arena', phone: '01800000000', address: 'Arena Street 1' } },
    });

    await prisma.user.delete({ where: { id: owner.id } });

    assert.equal(await prisma.ownerProfile.findUnique({ where: { userId: owner.id } }), null);
  });

  test('deleting a user who is still a captain is refused by the database, and nothing changes', async (t) => {
    const captain = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Still Captain', phone: '01700000000', position: 'Forward' } },
    });
    const team = await createTeam(captain);

    // Postgres refuses with a RESTRICT violation on the captain's foreign key (Prisma
    // passes it on without one of its own error codes, so match the constraint name).
    await assert.rejects(prisma.user.delete({ where: { id: captain.user.id } }), /Team_captainId_fkey/);

    assert.ok(await prisma.user.findUnique({ where: { id: captain.user.id } }), 'the user still exists');
    assert.ok(await prisma.playerProfile.findUnique({ where: { userId: captain.user.id } }), 'the profile still exists');
    assert.ok(await membership(team.id, captain.user.id), "the captain's membership still exists");
  });
});

describe('Status values', () => {
  test("a status outside the list can't be stored, through Prisma or straight in the database", async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await createTeam(captain);
    const row = await membership(team.id, captain.user.id);

    await assert.rejects(
      prisma.teamMember.update({ where: { id: row.id }, data: { status: 'rejected' } }),
      (err) => err.name === 'PrismaClientValidationError'
    );
    await assert.rejects(
      prisma.$executeRawUnsafe(
        'UPDATE "TeamMember" SET "status" = $1::"MembershipStatus" WHERE "id" = $2',
        'rejected',
        row.id
      ),
      /invalid input value for enum "MembershipStatus"/
    );

    assert.equal((await membership(team.id, captain.user.id)).status, 'accepted');
  });
});
