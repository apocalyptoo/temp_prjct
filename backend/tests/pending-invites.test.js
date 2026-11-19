// Tests for "pending invites aren't members" (docs/ROADMAP.md, Phase 2 "Don't count
// pending invites as members"). Member lists and counts include only accepted members;
// only the captain also gets the team's pending invites, as a separate pendingInvites
// list. Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, createLoggedInPlayer, createLoggedInUser, postJson } from './helpers.js';

const getJson = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path} should succeed`);
  return res.json();
};

// A team with: the captain, one accepted member, and one player with a pending invite.
// Plus an outsider with nothing to do with the team.
async function setUpTeam(t) {
  const captain = await createLoggedInPlayer(t);
  const member = await createLoggedInPlayer(t);
  const invitee = await createLoggedInPlayer(t);
  const outsider = await createLoggedInPlayer(t);

  const team = await (await postJson('/teams/create', { name: 'Pending Test' }, captain.jwt)).json();
  await postJson(`/teams/${team.id}/invite`, { userId: member.user.id }, captain.jwt);
  assert.equal((await postJson(`/teams/${team.id}/accept`, {}, member.jwt)).status, 200);
  assert.equal(
    (await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt)).status,
    201
  );
  return { captain, member, invitee, outsider, team };
}

const memberIds = (team) => team.members.map((m) => m.userId).sort((a, b) => a - b);
const findTeam = (teams, id) => {
  const team = teams.find((tm) => tm.id === id);
  assert.ok(team, 'the team should be in the list');
  return team;
};

describe('Member lists contain only accepted members', () => {
  test('the captain sees accepted members, plus the pending invite in a separate list', async (t) => {
    const { captain, member, invitee, team } = await setUpTeam(t);

    for (const path of ['/teams/me', '/teams']) {
      const seen = findTeam(await getJson(path, captain.jwt), team.id);

      assert.deepEqual(memberIds(seen), [captain.user.id, member.user.id].sort((a, b) => a - b), path);
      assert.ok(seen.members.every((m) => m.status === 'accepted'), `${path}: only accepted members`);
      assert.deepEqual(
        seen.pendingInvites.map((p) => p.userId),
        [invitee.user.id],
        `${path}: the captain sees who they invited`
      );
      assert.equal(seen.pendingInvites[0].status, 'pending');
      assert.equal(seen.pendingInvites[0].user.email, undefined, 'no email for other players');
    }
  });

  test('an accepted member does not see pending invites', async (t) => {
    const { member, team } = await setUpTeam(t);

    for (const path of ['/teams/me', '/teams']) {
      const seen = findTeam(await getJson(path, member.jwt), team.id);
      assert.equal(seen.members.length, 2, path);
      assert.equal('pendingInvites' in seen, false, `${path}: no pendingInvites for a non-captain`);
    }
  });

  test('the invitee and an outsider see neither the invite as a member nor pendingInvites', async (t) => {
    const { invitee, outsider, team } = await setUpTeam(t);

    for (const viewer of [invitee, outsider]) {
      const seen = findTeam(await getJson('/teams', viewer.jwt), team.id);
      assert.equal(seen.members.length, 2);
      assert.equal(seen.members.some((m) => m.userId === invitee.user.id), false);
      assert.equal('pendingInvites' in seen, false);
    }
    // A pending invite doesn't put the team in the invitee's "my teams".
    const inviteeTeams = await getJson('/teams/me', invitee.jwt);
    assert.equal(inviteeTeams.some((tm) => tm.id === team.id), false);
  });

  test('the admin team list counts only accepted members', async (t) => {
    const { team } = await setUpTeam(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });

    const seen = findTeam(await getJson('/admin/teams', admin.jwt), team.id);

    assert.equal(seen.memberCount, 2);
  });
});

describe('Player stats count only accepted memberships', () => {
  test('totalTeams ignores pending invites', async (t) => {
    const { captain, member, invitee, outsider } = await setUpTeam(t);

    assert.equal((await getJson(`/players/${invitee.user.id}`, outsider.jwt)).totalTeams, 0);
    assert.equal((await getJson(`/players/${member.user.id}`, outsider.jwt)).totalTeams, 1);
    assert.equal((await getJson(`/players/${captain.user.id}`, outsider.jwt)).totalTeams, 1);
  });

  test('a bad player id gets 400 instead of a server error', async (t) => {
    const { outsider } = await setUpTeam(t);

    const res = await fetch(`${BASE_URL}/players/abc`, { headers: { Authorization: `Bearer ${outsider.jwt}` } });

    assert.equal(res.status, 400);
  });
});
