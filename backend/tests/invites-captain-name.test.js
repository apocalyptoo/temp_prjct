// Tests for the pending invites on the Notifications screen (GET /notifications,
// needsAction.invites; moved here from GET /players/invites, removed in F5.3): each
// invite shows the captain's player name, through the visibility rules (never their
// email).
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

describe('GET /notifications: invites', () => {
  test("shows the captain's player name and the team name, without the captain's email", async (t) => {
    const captain = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Captain Rahim', phone: '01700000000', position: 'Midfielder' } },
    });
    const invitee = await createLoggedInPlayer(t);
    const team = await (await postJson('/teams/create', { name: 'Invite Name Test' }, captain.jwt)).json();
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);

    const res = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${invitee.jwt}` } });
    const { invites } = (await res.json()).needsAction;

    assert.equal(res.status, 200);
    assert.equal(invites.length, 1);
    assert.equal(invites[0].team.name, 'Invite Name Test');
    assert.equal(invites[0].team.captain.id, captain.user.id);
    assert.equal(invites[0].team.captain.name, 'Captain Rahim');
    assert.equal(invites[0].team.captain.email, undefined, "the captain's email is never shown");
  });
});
