// Tests for Task 4.1: the captain is stored only in Team.captainId (DECISIONS.md
// 2026-11-18). The captain is still an accepted member of their team, but member rows
// no longer carry a role. Safety rules are in helpers.js. All users and teams are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

const get = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path}`);
  return res.json();
};

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const membership = (teamId, userId) =>
  prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

async function createTeam(captain, name = 'Captain Test') {
  const res = await postJson('/teams/create', { name }, captain.jwt);
  assert.equal(res.status, 201, 'team creation should work');
  return res.json();
}

// A team made through the API, with one accepted member who is not the captain.
async function teamWithMember(t) {
  const captain = await createLoggedInPlayer(t);
  const member = await createLoggedInPlayer(t);
  const team = await createTeam(captain);
  assert.equal((await postJson(`/teams/${team.id}/invite`, { userId: member.user.id }, captain.jwt)).status, 201);
  assert.equal((await postJson(`/teams/${team.id}/accept`, {}, member.jwt)).status, 200);
  return { team, captain, member };
}

describe('Creating a team', () => {
  test('stores the creator as captainId and adds them as an accepted member', async (t) => {
    const creator = await createLoggedInPlayer(t);

    const team = await createTeam(creator);

    const stored = await prisma.team.findUnique({ where: { id: team.id } });
    assert.equal(stored.captainId, creator.user.id);
    const row = await membership(team.id, creator.user.id);
    assert.equal(row?.status, 'accepted', 'the captain is an accepted member');
    assert.equal('role' in row, false, 'member rows no longer have a role');
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
  });
});

describe('Team replies', () => {
  test('have captainId and no ownerId; members have no role', async (t) => {
    const { team, captain, member } = await teamWithMember(t);

    assert.equal(team.captainId, captain.user.id, 'the create reply has captainId');
    assert.equal('ownerId' in team, false, 'the create reply has no ownerId');

    const listed = (await get(`/teams?search=${encodeURIComponent(team.name)}&limit=50`, member.jwt)).items.find((tm) => tm.id === team.id);
    assert.ok(listed, '/teams should include the team');
    assert.equal(listed.captainId, captain.user.id, '/teams: captainId');
    assert.equal('ownerId' in listed, false, '/teams: no ownerId');

    for (const [path, viewer] of [
      ['/teams/me', member],
      ['/teams/me', captain],
    ]) {
      const found = (await get(path, viewer.jwt)).find((tm) => tm.id === team.id);
      assert.ok(found, `${path} should include the team`);
      assert.equal(found.captainId, captain.user.id, `${path}: captainId`);
      assert.equal('ownerId' in found, false, `${path}: no ownerId`);
      for (const m of [...found.members, ...(found.pendingInvites ?? [])]) {
        assert.equal('role' in m, false, `${path}: members have no role`);
      }
    }
  });

  test('the admin team list has captain and no owner', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const { team, captain } = await teamWithMember(t);

    const found = (await get('/admin/teams', admin.jwt)).find((tm) => tm.id === team.id);

    assert.ok(found, 'the admin list should include the team');
    assert.equal(found.captain.id, captain.user.id);
    assert.equal('owner' in found, false);
  });
});

describe('GET /players/invites', () => {
  test('has team.captain (id and name only) and no team.owner', async (t) => {
    const captain = await createLoggedInUser(t, {
      role: 'PLAYER',
      playerProfile: { create: { name: 'Captain Karim', phone: '01700000000', position: 'Forward' } },
    });
    const invitee = await createLoggedInPlayer(t);
    const team = await createTeam(captain, 'Invite Captain Test');
    await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, captain.jwt);

    const invites = await get('/players/invites', invitee.jwt);
    const invite = invites.find((i) => i.teamId === team.id);

    assert.ok(invite, 'the invite should be listed');
    assert.deepEqual(invite.team.captain, { id: captain.user.id, name: 'Captain Karim' });
    assert.equal('owner' in invite.team, false);
    assert.equal(invite.team.captainId, captain.user.id);
    assert.equal('ownerId' in invite.team, false);
    assert.equal('role' in invite, false, 'the invite row has no role');
  });
});

describe('Only the captain (by captainId) can invite, remove or delete', () => {
  test('an accepted member who is not the captain gets 403 for all three', async (t) => {
    const { team, member, captain } = await teamWithMember(t);
    const outsider = await createLoggedInPlayer(t);

    const invite = await postJson(`/teams/${team.id}/invite`, { userId: outsider.user.id }, member.jwt);
    const remove = await sendDelete(`/teams/${team.id}/members/${captain.user.id}`, member.jwt);
    const del = await sendDelete(`/teams/${team.id}`, member.jwt);

    assert.equal(invite.status, 403);
    assert.equal((await invite.json()).error, 'Only the team captain can invite players.');
    assert.equal(remove.status, 403);
    assert.equal((await remove.json()).error, 'Only the team captain can remove players.');
    assert.equal(del.status, 403);
    assert.equal((await del.json()).error, 'Only the team captain can delete this team.');
    assert.equal(await membership(team.id, outsider.user.id), null, 'no invite was created');
    assert.ok(await membership(team.id, captain.user.id), 'the captain is still a member');
    assert.ok(await prisma.team.findUnique({ where: { id: team.id } }), 'the team still exists');
  });

  test('captaincy follows captainId: after it changes, the new captain can act and the old one cannot', async (t) => {
    const { team, captain: oldCaptain, member: newCaptain } = await teamWithMember(t);
    const invitee = await createLoggedInPlayer(t);
    // A captaincy change is a single update of captainId (DECISIONS.md 2026-11-18).
    await prisma.team.update({ where: { id: team.id }, data: { captainId: newCaptain.user.id } });

    const oldInvite = await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, oldCaptain.jwt);
    assert.equal(oldInvite.status, 403, 'the old captain can no longer invite');

    const newInvite = await postJson(`/teams/${team.id}/invite`, { userId: invitee.user.id }, newCaptain.jwt);
    assert.equal(newInvite.status, 201, 'the new captain can invite');

    const oldDelete = await sendDelete(`/teams/${team.id}`, oldCaptain.jwt);
    assert.equal(oldDelete.status, 403, 'the old captain can no longer delete');

    const removeOld = await sendDelete(`/teams/${team.id}/members/${oldCaptain.user.id}`, newCaptain.jwt);
    assert.equal(removeOld.status, 200, 'the new captain can remove the old one');
    assert.equal(await membership(team.id, oldCaptain.user.id), null);

    const newDelete = await sendDelete(`/teams/${team.id}`, newCaptain.jwt);
    assert.equal(newDelete.status, 200, 'the new captain can delete the team');
    assert.equal(await prisma.team.findUnique({ where: { id: team.id } }), null);
  });
});
