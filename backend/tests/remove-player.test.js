// Tests DELETE /teams/:teamId/members/:userId (removePlayer in teamController.js) as it
// behaves today. Bad ids are covered in route-ids.test.js. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInPlayer, postJson } from './helpers.js';

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

// A team with a captain, one accepted member and one player with a pending invite.
async function teamWithMembers(t) {
  const captain = await createLoggedInPlayer(t);
  const member = await createLoggedInPlayer(t);
  const invitee = await createLoggedInPlayer(t);
  const created = await postJson('/teams/create', { name: 'Remove Test' }, captain.jwt);
  assert.equal(created.status, 201);
  const team = await created.json();
  assert.equal((await postJson(`/teams/${team.id}/invite`, { userId: member.user.id }, captain.jwt)).status, 201);
  assert.equal((await postJson(`/teams/${team.id}/accept`, {}, member.jwt)).status, 200);
  assert.equal((await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt)).status, 201);
  return { team, captain, member, invitee };
}

describe('The captain removes players', () => {
  test('removing an accepted member deletes their membership', async (t) => {
    const { team, captain, member } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/${team.id}/members/${member.user.id}`, captain.jwt);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Player removed successfully.' });
    assert.equal(await membership(team.id, member.user.id), null);
    assert.equal((await membership(team.id, captain.user.id))?.status, 'accepted', 'the captain stays');
  });

  test('the same route cancels a pending invite (same reply)', async (t) => {
    const { team, captain, invitee } = await teamWithMembers(t);
    assert.equal((await membership(team.id, invitee.user.id))?.status, 'pending');

    const res = await sendDelete(`/teams/${team.id}/members/${invitee.user.id}`, captain.jwt);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Player removed successfully.' });
    assert.equal(await membership(team.id, invitee.user.id), null);
    const accept = await postJson(`/teams/${team.id}/accept`, {}, invitee.jwt);
    assert.equal(accept.status, 404, 'the cancelled invite can no longer be accepted');
  });
});

describe('Who can remove', () => {
  test('an accepted member who is not the captain gets 403, and nothing changes', async (t) => {
    const { team, member, invitee } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/${team.id}/members/${invitee.user.id}`, member.jwt);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Only the team captain can remove players.' });
    assert.equal((await membership(team.id, invitee.user.id))?.status, 'pending');
  });

  test('a member removing themselves also gets 403 (there is no "leave team" yet)', async (t) => {
    const { team, member } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/${team.id}/members/${member.user.id}`, member.jwt);

    assert.equal(res.status, 403);
    assert.equal((await membership(team.id, member.user.id))?.status, 'accepted');
  });

  test('an outsider gets 403 for the captain too', async (t) => {
    const { team, captain } = await teamWithMembers(t);
    const outsider = await createLoggedInPlayer(t);

    const res = await sendDelete(`/teams/${team.id}/members/${captain.user.id}`, outsider.jwt);

    assert.equal(res.status, 403);
    assert.equal((await membership(team.id, captain.user.id))?.status, 'accepted');
  });

  test('the captain cannot remove themselves (400)', async (t) => {
    const { team, captain } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/${team.id}/members/${captain.user.id}`, captain.jwt);

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'The team captain cannot remove themselves.' });
    assert.equal((await membership(team.id, captain.user.id))?.status, 'accepted');
  });
});

describe('Not found', () => {
  test('a player who is not in the team gets 404', async (t) => {
    const { team, captain } = await teamWithMembers(t);
    const outsider = await createLoggedInPlayer(t);

    const res = await sendDelete(`/teams/${team.id}/members/${outsider.user.id}`, captain.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Player not found in this team.' });
  });

  test('a user id that does not exist gets the same 404', async (t) => {
    const { team, captain } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/${team.id}/members/2147483647`, captain.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Player not found in this team.' });
  });

  test('an unknown team gets 404 "Team not found"', async (t) => {
    const { member, captain } = await teamWithMembers(t);

    const res = await sendDelete(`/teams/2147483647/members/${member.user.id}`, captain.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Team not found' });
  });
});
