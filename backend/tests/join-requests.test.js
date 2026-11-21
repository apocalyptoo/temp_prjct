// Tests for join requests (docs/features/team-membership.md, endpoints 3 and 5–8).
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

const get = (path, jwt) => fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });

async function createTeam(captain, name = 'Request Test') {
  const res = await postJson('/teams/create', { name }, captain.jwt);
  assert.equal(res.status, 201, 'team creation should work');
  return res.json();
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
