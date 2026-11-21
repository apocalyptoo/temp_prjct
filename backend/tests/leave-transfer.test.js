// Tests for leaving a team, transferring captaincy and deleting a team
// (docs/features/team-membership.md, endpoints 14, 15 and 17). Safety rules are in
// helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
const captainOf = async (teamId) => (await prisma.team.findUnique({ where: { id: teamId } }))?.captainId;

const leave = (team, player) => postJson(`/teams/${team.id}/leave`, {}, player.jwt);
const transfer = (team, captain, userId) => postJson(`/teams/${team.id}/transfer`, { userId }, captain.jwt);

// A team with the captain and one accepted member.
async function teamWithMember(t) {
  const captain = await createLoggedInPlayer(t);
  const member = await createLoggedInPlayer(t);
  const created = await postJson('/teams/create', { name: 'Leave Test' }, captain.jwt);
  assert.equal(created.status, 201);
  const team = await created.json();
  await prisma.teamMember.create({
    data: { teamId: team.id, userId: member.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
  });
  return { team, captain, member };
}

describe('POST /teams/:teamId/leave', () => {
  test('a member leaves; the team and the captain stay', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    const res = await leave(team, member);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'You left the team.', teamDeleted: false });
    assert.equal(await membership(team.id, member.user.id), null);
    assert.equal((await membership(team.id, captain.user.id))?.status, 'accepted');
  });

  test('the captain with other members gets 409 and stays', async (t) => {
    const { team, captain } = await teamWithMember(t);

    const res = await leave(team, captain);

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: 'Transfer captaincy before leaving the team.' });
    assert.equal(await captainOf(team.id), captain.user.id);
  });

  test('the captain as the only member deletes the team, with its pending invites and requests', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const invitee = await createLoggedInPlayer(t);
    const requester = await createLoggedInPlayer(t);
    const team = await (await postJson('/teams/create', { name: 'Solo Team' }, captain.jwt)).json();
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/requests`, { message: 'hi' }, requester.jwt);

    const res = await leave(team, captain);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Team deleted', teamDeleted: true });
    assert.equal(await prisma.team.findUnique({ where: { id: team.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
  });

  test('someone with only a pending invite or request, or nothing, gets 404', async (t) => {
    const { team, captain } = await teamWithMember(t);
    const invitee = await createLoggedInPlayer(t);
    const requester = await createLoggedInPlayer(t);
    const outsider = await createLoggedInPlayer(t);
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/requests`, {}, requester.jwt);

    for (const player of [invitee, requester, outsider]) {
      const res = await leave(team, player);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: "You're not a member of this team." });
    }
    assert.equal((await membership(team.id, invitee.user.id))?.status, 'pending');
    assert.equal((await membership(team.id, requester.user.id))?.status, 'pending');
  });

  test('an unknown team gets 404 "Team not found"', async (t) => {
    const player = await createLoggedInPlayer(t);

    const res = await postJson('/teams/2147483647/leave', {}, player.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Team not found' });
  });
});

describe('POST /teams/:teamId/transfer', () => {
  test('the captain hands over to a member and stays in the team as a player', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    const res = await transfer(team, captain, member.user.id);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Captaincy transferred', captainId: member.user.id });
    assert.equal(await captainOf(team.id), member.user.id);
    assert.equal((await membership(team.id, captain.user.id))?.status, 'accepted', 'the old captain stays a member');
    // The new captain now runs the team, and the old one doesn't.
    const outsider = await createLoggedInPlayer(t);
    const oldInvite = await postJson(`/teams/${team.id}/invite`, { userId: outsider.user.id }, captain.jwt);
    const newInvite = await postJson(`/teams/${team.id}/invite`, { userId: outsider.user.id }, member.jwt);
    assert.equal(oldInvite.status, 403);
    assert.equal(newInvite.status, 201);
    // The old captain can now leave.
    assert.equal((await leave(team, captain)).status, 200);
  });

  test('to yourself: 400', async (t) => {
    const { team, captain } = await teamWithMember(t);

    const res = await transfer(team, captain, captain.user.id);

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "You're already the captain." });
  });

  test('to a pending invitee, a pending requester, an outsider or nobody: 404', async (t) => {
    const { team, captain } = await teamWithMember(t);
    const invitee = await createLoggedInPlayer(t);
    const requester = await createLoggedInPlayer(t);
    const outsider = await createLoggedInPlayer(t);
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/requests`, {}, requester.jwt);

    for (const userId of [invitee.user.id, requester.user.id, outsider.user.id, 2147483647]) {
      const res = await transfer(team, captain, userId);
      assert.equal(res.status, 404, `user ${userId}`);
      assert.deepEqual(await res.json(), { error: 'Player not found in this team.' });
    }
    assert.equal(await captainOf(team.id), captain.user.id);
  });

  test('a member who is not the captain gets 403', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    const res = await transfer(team, member, member.user.id);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Only the team captain can transfer captaincy.' });
    assert.equal(await captainOf(team.id), captain.user.id);
  });

  test('userId must be a positive whole number', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    for (const userId of [String(member.user.id), { not: 1 }, -1, 0, 1.5, null, undefined, 2147483648]) {
      const res = await transfer(team, captain, userId);
      assert.equal(res.status, 400, `userId ${JSON.stringify(userId)}`);
      assert.deepEqual(await res.json(), { error: 'userId must be a positive integer' });
    }
    assert.equal(await captainOf(team.id), captain.user.id);
  });

  // The team lock makes these run one after the other, whichever comes first, so the
  // team always ends up with a captain who is an accepted member.
  test('a transfer and the new captain leaving at the same moment never leave a captain outside the team', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    const [transferRes, leaveRes] = await Promise.all([transfer(team, captain, member.user.id), leave(team, member)]);

    const newCaptain = await captainOf(team.id);
    assert.equal((await membership(team.id, newCaptain))?.status, 'accepted', 'the captain is a member');
    assert.ok(
      (transferRes.status === 200 && leaveRes.status === 409) || (leaveRes.status === 200 && transferRes.status === 404),
      `transfer ${transferRes.status}, leave ${leaveRes.status}`
    );
  });
});

describe('DELETE /teams/:teamId', () => {
  test('the captain deletes the team with all its rows', async (t) => {
    const { team, captain } = await teamWithMember(t);
    const requester = await createLoggedInPlayer(t);
    await postJson(`/teams/${team.id}/requests`, { message: 'hi' }, requester.jwt);

    const res = await sendDelete(`/teams/${team.id}`, captain.jwt);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Team deleted successfully.' });
    assert.equal(await prisma.team.findUnique({ where: { id: team.id } }), null);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
  });

  test('a member gets 403; an unknown team 404', async (t) => {
    const { team, member, captain } = await teamWithMember(t);

    const res = await sendDelete(`/teams/${team.id}`, member.jwt);
    const unknown = await sendDelete('/teams/2147483647', captain.jwt);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Only the team captain can delete this team.' });
    assert.ok(await prisma.team.findUnique({ where: { id: team.id } }));
    assert.equal(unknown.status, 404);
  });
});

describe('Only players leave, transfer or delete', () => {
  for (const role of ['OWNER', 'ADMIN']) {
    test(`a ${role} account gets the players-only 403`, async (t) => {
      const { team, member } = await teamWithMember(t);
      const account = await createLoggedInUser(t, { role });

      const responses = [
        await leave(team, account),
        await transfer(team, account, member.user.id),
        await sendDelete(`/teams/${team.id}`, account.jwt),
      ];

      for (const res of responses) {
        assert.equal(res.status, 403);
        assert.match((await res.json()).error, /only player accounts/i);
      }
      assert.ok(await prisma.team.findUnique({ where: { id: team.id } }));
    });
  }
});

describe('Bad team ids get 400', () => {
  test('leave, transfer, edit and delete', async (t) => {
    const player = await createLoggedInPlayer(t);

    for (const badId of ['abc', '0', '-1', '1.5', '99999999999']) {
      const responses = [
        await postJson(`/teams/${badId}/leave`, {}, player.jwt),
        await postJson(`/teams/${badId}/transfer`, { userId: player.user.id }, player.jwt),
        await fetch(`${BASE_URL}/teams/${badId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${player.jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Fine Name' }),
        }),
        await sendDelete(`/teams/${badId}`, player.jwt),
      ];
      for (const res of responses) {
        assert.equal(res.status, 400, `${res.url}`);
        assert.deepEqual(await res.json(), { error: 'Invalid team id' });
      }
    }
  });
});
