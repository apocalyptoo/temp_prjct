// Tests that ids in team URLs are checked with parseId: a badly formed id gets a 400
// reply instead of a server error (500). Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInPlayer, postJson } from './helpers.js';

const BAD_IDS = ['abc', '0', '-1', '1.5', '99999999999'];

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

describe('Bad team ids get 400', () => {
  test('invite, accept and reject with a bad team id', async (t) => {
    const player = await createLoggedInPlayer(t);
    const other = await createLoggedInPlayer(t);

    for (const badId of BAD_IDS) {
      const invite = await postJson(`/teams/${badId}/invite`, { userId: other.user.id }, player.jwt);
      const accept = await postJson(`/teams/${badId}/accept`, {}, player.jwt);
      const reject = await postJson(`/teams/${badId}/reject`, {}, player.jwt);
      assert.equal(invite.status, 400, `invite with team id ${badId}`);
      assert.equal(accept.status, 400, `accept with team id ${badId}`);
      assert.equal(reject.status, 400, `reject with team id ${badId}`);
      assert.equal((await invite.json()).error, 'Invalid team id');
    }
  });

  test('remove player with a bad team id or a bad player id', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const member = await createLoggedInPlayer(t);
    const team = await (await postJson('/teams/create', { name: 'Id Test' }, captain.jwt)).json();
    await postJson(`/teams/${team.id}/invite`, { userId: member.user.id }, captain.jwt);
    await postJson(`/teams/${team.id}/accept`, {}, member.jwt);

    for (const badId of BAD_IDS) {
      const badTeam = await sendDelete(`/teams/${badId}/members/${member.user.id}`, captain.jwt);
      const badUser = await sendDelete(`/teams/${team.id}/members/${badId}`, captain.jwt);
      assert.equal(badTeam.status, 400, `team id ${badId}`);
      assert.equal(badUser.status, 400, `player id ${badId}`);
      assert.equal((await badUser.json()).error, 'Invalid player id');
    }
    const row = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: member.user.id } },
    });
    assert.equal(row?.status, 'accepted', 'the member is still in the team');

    // A good id still works.
    const res = await sendDelete(`/teams/${team.id}/members/${member.user.id}`, captain.jwt);
    assert.equal(res.status, 200);
  });

  test('deleting a team with a bad id', async (t) => {
    const player = await createLoggedInPlayer(t);

    const res = await sendDelete('/teams/abc', player.jwt);

    assert.equal(res.status, 400);
  });
});
