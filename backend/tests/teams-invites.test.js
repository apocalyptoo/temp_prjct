// Tests for the join-team bypass (docs/ROADMAP.md, Phase 1 item 3, interim fix):
// a player must not be able to join a team without the captain's invite.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInPlayer, postJson } from './helpers.js';

// A captain with a new team, plus a second player who isn't in it.
async function setUpTeamAndOutsider(t) {
  const captain = await createLoggedInPlayer(t);
  const outsider = await createLoggedInPlayer(t);
  const res = await postJson('/teams/create', { name: 'Test Team', description: 'test' }, captain.jwt);
  assert.equal(res.status, 201, 'team creation should work');
  const team = await res.json();
  return { captain, outsider, team };
}

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

describe('Joining a team needs the captain', () => {
  test('a player cannot join a team without an invite (/join then /accept)', async (t) => {
    const { outsider, team } = await setUpTeamAndOutsider(t);

    const joinRes = await postJson(`/teams/${team.id}/join`, {}, outsider.jwt);
    await postJson(`/teams/${team.id}/accept`, {}, outsider.jwt);

    const row = await membership(team.id, outsider.user.id);
    assert.equal(row?.status ?? 'no membership', 'no membership', 'outsider must not be in the team');
    assert.equal(joinRes.status, 404, '/join should no longer exist');
  });

  test('accepting with no invite returns 404', async (t) => {
    const { outsider, team } = await setUpTeamAndOutsider(t);

    const res = await postJson(`/teams/${team.id}/accept`, {}, outsider.jwt);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Invite not found');
    assert.equal(await membership(team.id, outsider.user.id), null);
  });

  test('rejecting with no invite returns 404', async (t) => {
    const { outsider, team } = await setUpTeamAndOutsider(t);

    const res = await postJson(`/teams/${team.id}/reject`, {}, outsider.jwt);

    assert.equal(res.status, 404);
  });

  test('accept and reject only act on pending invites, not on an accepted membership', async (t) => {
    const { captain, team } = await setUpTeamAndOutsider(t);

    // The captain is an accepted member, with nothing pending.
    const acceptRes = await postJson(`/teams/${team.id}/accept`, {}, captain.jwt);
    const rejectRes = await postJson(`/teams/${team.id}/reject`, {}, captain.jwt);

    assert.equal(acceptRes.status, 404);
    assert.equal(rejectRes.status, 404);
    const row = await membership(team.id, captain.user.id);
    assert.equal(row?.status, 'accepted', "the captain's membership must be untouched");
  });
});

describe('Invite input checks', () => {
  test('rejects a userId that is not a positive integer', async (t) => {
    const { captain, team } = await setUpTeamAndOutsider(t);

    for (const userId of [{ not: 1 }, 'abc', '5', -1, 0, 1.5, null, undefined]) {
      const res = await postJson(`/teams/${team.id}/invite`, { userId }, captain.jwt);
      assert.equal(res.status, 400, `expected 400 for userId ${JSON.stringify(userId)}`);
    }
    const pending = await prisma.teamMember.count({ where: { teamId: team.id, status: 'pending' } });
    assert.equal(pending, 0, 'no invites should have been created');
  });

  test('userId has the same upper limit as ids in URLs (the database Int range)', async (t) => {
    const { captain, team } = await setUpTeamAndOutsider(t);

    // The largest id the database can hold: checked, then simply not found.
    const largest = await postJson(`/teams/${team.id}/invite`, { userId: 2147483647 }, captain.jwt);
    assert.equal(largest.status, 404);
    assert.deepEqual(await largest.json(), { error: 'Player not found' });

    // One more, or far more, is refused before it reaches the database (it used to give 500).
    for (const userId of [2147483648, 99999999999, Number.MAX_SAFE_INTEGER]) {
      const res = await postJson(`/teams/${team.id}/invite`, { userId }, captain.jwt);
      assert.equal(res.status, 400, `expected 400 for userId ${userId}`);
      assert.deepEqual(await res.json(), { error: 'userId must be a positive integer' });
    }
  });
});

describe('Normal invite flow still works', () => {
  test('captain invites, player accepts, player is a member', async (t) => {
    const { captain, outsider, team } = await setUpTeamAndOutsider(t);

    const inviteRes = await postJson(`/teams/${team.id}/invite`, { userId: outsider.user.id }, captain.jwt);
    assert.equal(inviteRes.status, 201);
    assert.equal((await membership(team.id, outsider.user.id)).status, 'pending');

    const acceptRes = await postJson(`/teams/${team.id}/accept`, {}, outsider.jwt);
    assert.equal(acceptRes.status, 200);
    assert.equal((await membership(team.id, outsider.user.id)).status, 'accepted');

    const myTeamsRes = await fetch(`${BASE_URL}/teams/me`, { headers: { Authorization: `Bearer ${outsider.jwt}` } });
    const myTeams = await myTeamsRes.json();
    assert.ok(myTeams.some((tm) => tm.id === team.id), 'team should be in the player\'s "my teams"');
  });

  test('captain invites, player rejects, invite is gone', async (t) => {
    const { captain, outsider, team } = await setUpTeamAndOutsider(t);

    await postJson(`/teams/${team.id}/invite`, { userId: outsider.user.id }, captain.jwt);
    const rejectRes = await postJson(`/teams/${team.id}/reject`, {}, outsider.jwt);

    assert.equal(rejectRes.status, 200);
    assert.equal(await membership(team.id, outsider.user.id), null);
  });
});
