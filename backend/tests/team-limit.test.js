// Tests for the 15-member limit (docs/PRODUCT.md, "Team size";
// docs/features/team-membership.md, d.1): a full team takes no new members, and the
// team-row lock (lockTeam) keeps the limit even when approvals arrive at the same moment.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser, createLoggedInPlayer, postJson } from './helpers.js';

const MAX = 15;
const FULL = { error: 'Team is full (15/15).' };

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
const memberCount = (teamId) => prisma.teamMember.count({ where: { teamId, status: 'accepted' } });

// A team whose captain is logged in, with `members` accepted members in all (the
// captain included). The other members are throwaway accounts made in the database.
async function teamWithMembers(t, members) {
  const captain = await createLoggedInPlayer(t);
  const created = await postJson('/teams/create', { name: 'Limit Test' }, captain.jwt);
  assert.equal(created.status, 201);
  const team = await created.json();
  const others = [];
  for (let i = 1; i < members; i += 1) others.push(await createTestUser(t));
  await prisma.teamMember.createMany({
    data: others.map((user) => ({ teamId: team.id, userId: user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() })),
  });
  assert.equal(await memberCount(team.id), members);
  return { captain, team };
}

// `count` players, each with a pending join request to the team.
async function requesters(t, team, count) {
  const players = [];
  for (let i = 0; i < count; i += 1) {
    const player = await createLoggedInPlayer(t);
    await prisma.teamMember.create({ data: { teamId: team.id, userId: player.user.id, status: 'pending', origin: 'request' } });
    players.push(player);
  }
  return players;
}

const approve = (team, player, captain) =>
  postJson(`/teams/${team.id}/requests/${player.user.id}/approve`, {}, captain.jwt);

describe('A full team (15 accepted members)', () => {
  test('a player cannot ask to join', async (t) => {
    const { team } = await teamWithMembers(t, MAX);
    const player = await createLoggedInPlayer(t);

    const res = await postJson(`/teams/${team.id}/requests`, { message: 'room for one more?' }, player.jwt);

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), FULL);
    assert.equal(await membership(team.id, player.user.id), null);
  });

  test('asking when invited does not join a full team either; the invite stays pending', async (t) => {
    const { team } = await teamWithMembers(t, MAX);
    const player = await createLoggedInPlayer(t);
    await prisma.teamMember.create({ data: { teamId: team.id, userId: player.user.id, status: 'pending', origin: 'invite' } });

    const res = await postJson(`/teams/${team.id}/requests`, {}, player.jwt);

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), FULL);
    assert.equal((await membership(team.id, player.user.id)).status, 'pending');
  });

  test('the captain cannot approve a request; it stays pending, and can still be declined', async (t) => {
    const { captain, team } = await teamWithMembers(t, MAX);
    const [player] = await requesters(t, team, 1);

    const res = await approve(team, player, captain);

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), FULL);
    assert.equal((await membership(team.id, player.user.id)).status, 'pending');
    assert.equal(await memberCount(team.id), MAX);
    const declined = await postJson(`/teams/${team.id}/requests/${player.user.id}/reject`, {}, captain.jwt);
    assert.equal(declined.status, 200);
  });

  test('with 14 members the last place can still be filled', async (t) => {
    const { captain, team } = await teamWithMembers(t, MAX - 1);
    const [player] = await requesters(t, team, 1);

    assert.equal((await approve(team, player, captain)).status, 200);
    assert.equal(await memberCount(team.id), MAX);
  });
});

describe('Approvals at the same moment never go past 15', () => {
  // Without the lock, each approval could count 14 members before the other one
  // writes, and both would succeed. With it, they run one after the other.
  test('two approvals at once with 14 members: exactly one succeeds', async (t) => {
    const { captain, team } = await teamWithMembers(t, MAX - 1);
    const players = await requesters(t, team, 2);

    const responses = await Promise.all(players.map((player) => approve(team, player, captain)));

    assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
    assert.equal(await memberCount(team.id), MAX);
  });

  // The same with five at once: a race between only two requests can pass by luck
  // even without the lock, five make a lost race far more likely to show.
  test('five approvals at once with 14 members: exactly one succeeds', async (t) => {
    const { captain, team } = await teamWithMembers(t, MAX - 1);
    const players = await requesters(t, team, 5);

    const responses = await Promise.all(players.map((player) => approve(team, player, captain)));

    assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409, 409, 409, 409]);
    assert.equal(await memberCount(team.id), MAX);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id, status: 'pending' } }), 4, 'the rest stay pending');
  });
});
