// Tests for join requests (docs/features/team-membership.md, endpoints 3 and 5–8).
// The full-team cases are in team-limit.test.js. Safety rules are in helpers.js. All
// users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

const get = (path, jwt) => fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

async function createTeam(captain, name = 'Request Test') {
  const res = await postJson('/teams/create', { name }, captain.jwt);
  assert.equal(res.status, 201, 'team creation should work');
  return res.json();
}

const ask = (team, player, body = {}) => postJson(`/teams/${team.id}/requests`, body, player.jwt);
const approve = (team, player, captain) =>
  postJson(`/teams/${team.id}/requests/${player.user.id}/approve`, {}, captain.jwt);
const decline = (team, player, captain) =>
  postJson(`/teams/${team.id}/requests/${player.user.id}/reject`, {}, captain.jwt);

// A captain with a team and a player who isn't in it.
async function teamAndPlayer(t) {
  const captain = await createLoggedInPlayer(t);
  const player = await createLoggedInPlayer(t);
  const team = await createTeam(captain);
  return { captain, player, team };
}

describe('GET /players/requests', () => {
  test("lists only the viewer's own pending join requests, newest first, with message and team counts", async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createLoggedInPlayer(t);
    const someoneElse = await createLoggedInPlayer(t);
    const older = await createTeam(captain, 'Older Request');
    const newer = await createTeam(captain, 'Newer Request');
    const invited = await createTeam(captain, 'Invited Team');
    await prisma.teamMember.createMany({
      data: [
        { teamId: older.id, userId: player.user.id, status: 'pending', origin: 'request', message: 'Hi', createdAt: new Date('2026-01-01T00:00:00Z') },
        { teamId: newer.id, userId: player.user.id, status: 'pending', origin: 'request', createdAt: new Date('2026-02-01T00:00:00Z') },
        { teamId: invited.id, userId: player.user.id, status: 'pending', origin: 'invite' },
        { teamId: older.id, userId: someoneElse.user.id, status: 'pending', origin: 'request', message: 'Not yours' },
      ],
    });

    const res = await get('/players/requests', player.jwt);
    const requests = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(requests.map((r) => r.teamId), [newer.id, older.id], 'requests only, newest first');
    assert.equal(requests[1].message, 'Hi');
    assert.equal(requests[0].message, null);
    assert.deepEqual(requests[1].team, { id: older.id, name: 'Older Request', memberCount: 1, maxMembers: 15 });
    assert.ok(requests[0].createdAt);
    for (const field of ['origin', 'acceptedAt', 'status', 'userId']) assert.equal(field in requests[0], false, field);
  });

  test('venue owners and the admin get 403', async (t) => {
    for (const role of ['OWNER', 'ADMIN']) {
      const account = await createLoggedInUser(t, { role });
      const res = await get('/players/requests', account.jwt);
      assert.equal(res.status, 403, role);
      assert.match((await res.json()).error, /only player accounts/i);
    }
  });
});

describe('POST /teams/:teamId/requests', () => {
  test('creates a pending join request with the trimmed message', async (t) => {
    const { player, team } = await teamAndPlayer(t);

    const res = await ask(team, player, { message: '  I play Thursdays with Tanvir  ' });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.teamId, team.id);
    assert.equal(body.userId, player.user.id);
    assert.equal(body.status, 'pending');
    assert.equal(body.message, 'I play Thursdays with Tanvir');
    assert.ok(body.createdAt);
    for (const field of ['origin', 'acceptedAt']) assert.equal(field in body, false, field);
    const row = await membership(team.id, player.user.id);
    assert.equal(row.origin, 'request');
    assert.equal(row.status, 'pending');
    assert.equal(row.acceptedAt, null);
    assert.equal(row.message, 'I play Thursdays with Tanvir');
  });

  test('no body, a missing, null, empty or blank message all store no message', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await createTeam(captain);

    for (const body of [undefined, {}, { message: null }, { message: '' }, { message: '   ' }]) {
      const player = await createLoggedInPlayer(t);
      const res = await fetch(`${BASE_URL}/teams/${team.id}/requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${player.jwt}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(res.status, 201, `body ${JSON.stringify(body)}`);
      assert.equal((await membership(team.id, player.user.id)).message, null, `body ${JSON.stringify(body)}`);
    }
  });

  test('the message is at most 150 characters, counted by code point', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await createTeam(captain);
    const bangla = 'ক'; // ক
    const emoji = '\u{1F600}'; // one code point, two UTF-16 units

    for (const message of [bangla.repeat(150), emoji.repeat(150), `  ${'a'.repeat(150)}  `]) {
      const player = await createLoggedInPlayer(t);
      assert.equal((await ask(team, player, { message })).status, 201, `${[...message].length} characters`);
    }
    for (const message of [bangla.repeat(151), emoji.repeat(151)]) {
      const player = await createLoggedInPlayer(t);
      const res = await ask(team, player, { message });
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'Message must be at most 150 characters' });
      assert.equal(await membership(team.id, player.user.id), null);
    }
  });

  test('a message that is not text is refused', async (t) => {
    const { player, team } = await teamAndPlayer(t);

    for (const message of [123, true, { not: '' }, ['hi']]) {
      const res = await ask(team, player, { message });
      assert.equal(res.status, 400, JSON.stringify(message));
      assert.deepEqual(await res.json(), { error: 'Message must be text' });
    }
    assert.equal(await membership(team.id, player.user.id), null);
  });

  test('the captain or an accepted member gets 409 "already in this team"', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: player.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
    });

    for (const who of [captain, player]) {
      const res = await ask(team, who);
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { error: "You're already in this team." });
    }
  });

  test('asking twice gets 409 and keeps the first request', async (t) => {
    const { player, team } = await teamAndPlayer(t);
    assert.equal((await ask(team, player, { message: 'first' })).status, 201);

    const res = await ask(team, player, { message: 'second' });

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "You've already asked to join this team." });
    assert.equal((await membership(team.id, player.user.id)).message, 'first');
  });

  test('asking when already invited accepts the invite (the message is dropped)', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    assert.equal((await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt)).status, 201);

    const res = await ask(team, player, { message: 'let me in' });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Joined team successfully', joined: true });
    const row = await membership(team.id, player.user.id);
    assert.equal(row.status, 'accepted');
    assert.equal(row.origin, 'invite', 'it is still the invite row');
    assert.ok(row.acceptedAt);
    assert.equal(row.message, null);
  });

  test('an unknown team gets 404', async (t) => {
    const player = await createLoggedInPlayer(t);

    const res = await postJson('/teams/2147483647/requests', {}, player.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Team not found' });
  });
});

describe('DELETE /teams/:teamId/requests/me', () => {
  test('the requester cancels their request; a second cancel gets 404', async (t) => {
    const { player, team } = await teamAndPlayer(t);
    await ask(team, player, { message: 'hi' });

    const res = await sendDelete(`/teams/${team.id}/requests/me`, player.jwt);
    const again = await sendDelete(`/teams/${team.id}/requests/me`, player.jwt);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Request cancelled' });
    assert.equal(await membership(team.id, player.user.id), null, 'the row and its message are gone');
    assert.equal(again.status, 404);
    assert.deepEqual(await again.json(), { error: 'Join request not found' });
  });

  test('it never touches an invite or a membership', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, captain.jwt);

    const asInvitee = await sendDelete(`/teams/${team.id}/requests/me`, player.jwt);
    const asCaptain = await sendDelete(`/teams/${team.id}/requests/me`, captain.jwt);

    assert.equal(asInvitee.status, 404);
    assert.equal(asCaptain.status, 404);
    assert.equal((await membership(team.id, player.user.id)).status, 'pending');
    assert.equal((await membership(team.id, captain.user.id)).status, 'accepted');
  });
});

describe('The captain approves or declines', () => {
  test('approving makes the player a member and deletes the message', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    await ask(team, player, { message: 'hi' });

    const res = await approve(team, player, captain);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Request approved' });
    const row = await membership(team.id, player.user.id);
    assert.equal(row.status, 'accepted');
    assert.equal(row.origin, 'request');
    assert.ok(row.acceptedAt);
    assert.equal(row.message, null);
  });

  test('declining deletes the request; the player can ask again', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    await ask(team, player, { message: 'hi' });

    const res = await decline(team, player, captain);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'Request declined' });
    assert.equal(await membership(team.id, player.user.id), null);
    assert.equal((await ask(team, player)).status, 201, 'asking again works');
  });

  test('a member who is not the captain gets 403, and nothing changes', async (t) => {
    const { player, team } = await teamAndPlayer(t);
    const member = await createLoggedInPlayer(t);
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: member.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
    });
    await ask(team, player, { message: 'hi' });

    for (const send of [approve, decline]) {
      const res = await send(team, player, member);
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: 'Only the team captain can approve or reject join requests.' });
    }
    const row = await membership(team.id, player.user.id);
    assert.equal(row.status, 'pending');
    assert.equal(row.message, 'hi');
  });

  test('a cancelled request, an invite, a member or nobody: 404 "Join request not found"', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    const invitee = await createLoggedInPlayer(t);
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);
    await ask(team, player);
    await sendDelete(`/teams/${team.id}/requests/me`, player.jwt);

    for (const target of [player, invitee, captain]) {
      for (const send of [approve, decline]) {
        const res = await send(team, target, captain);
        assert.equal(res.status, 404);
        assert.deepEqual(await res.json(), { error: 'Join request not found' });
      }
    }
    assert.equal((await membership(team.id, invitee.user.id)).status, 'pending', 'the invite is untouched');
    const nobody = await postJson(`/teams/${team.id}/requests/2147483647/approve`, {}, captain.jwt);
    assert.equal(nobody.status, 404);
  });

  test('approving twice: the second gets 404', async (t) => {
    const { captain, player, team } = await teamAndPlayer(t);
    await ask(team, player);

    assert.equal((await approve(team, player, captain)).status, 200);
    assert.equal((await approve(team, player, captain)).status, 404);
  });

  test('an unknown team gets 404 "Team not found"', async (t) => {
    const { captain, player } = await teamAndPlayer(t);

    const res = await postJson(`/teams/2147483647/requests/${player.user.id}/approve`, {}, captain.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Team not found' });
  });
});

describe('Only players use join requests', () => {
  for (const role of ['OWNER', 'ADMIN']) {
    test(`a ${role} account gets 403 on every join request action`, async (t) => {
      const account = await createLoggedInUser(t, { role });
      const { player, team } = await teamAndPlayer(t);
      await ask(team, player, { message: 'hi' });

      const responses = [
        await postJson(`/teams/${team.id}/requests`, {}, account.jwt),
        await sendDelete(`/teams/${team.id}/requests/me`, account.jwt),
        await postJson(`/teams/${team.id}/requests/${player.user.id}/approve`, {}, account.jwt),
        await postJson(`/teams/${team.id}/requests/${player.user.id}/reject`, {}, account.jwt),
      ];

      for (const res of responses) {
        assert.equal(res.status, 403);
        assert.match((await res.json()).error, /only player accounts/i);
      }
      assert.equal((await membership(team.id, player.user.id)).status, 'pending');
      assert.equal(await membership(team.id, account.user.id), null);
    });
  }
});
