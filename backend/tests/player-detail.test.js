// One player's public profile, for Player detail (GET /players/:id;
// docs/features/explore.md, d endpoint 6): the public fields through the visibility
// rules, the phone only for accepted teammates, the player and the admin, never the
// email, the player's accepted teams, and inviteOptions for a player who captains teams.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, prisma, createLoggedInUser, createTestUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

const PHONE = '01798765432';
const profile = (name, extra = {}) => ({
  playerProfile: { create: { name, phone: PHONE, position: 'Any', ...extra } },
});
const loggedInPlayer = (t, name, extra = {}) => createLoggedInUser(t, { role: 'PLAYER', ...profile(name, extra) });
const venueOwner = (t) => createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Detail Arena' } } });
const admin = (t) => createLoggedInUser(t, { role: 'ADMIN' });

// A team made directly in the database, with its captain's own accepted row.
const teamOf = (captainId, name, area = null) =>
  prisma.team.create({
    data: {
      name,
      area,
      captainId,
      members: { create: { userId: captainId, status: 'accepted', origin: 'creator', acceptedAt: new Date() } },
    },
  });

const addRow = (teamId, userId, status, origin) =>
  prisma.teamMember.create({
    data: { teamId, userId, status, origin, acceptedAt: status === 'accepted' ? new Date() : null },
  });

async function fillTeam(t, teamId, count) {
  for (let n = 1; n < count; n += 1) {
    const filler = await createTestUser(t);
    await addRow(teamId, filler.id, 'accepted', 'invite');
  }
}

describe('GET /players/:id: the public profile', () => {
  test('a stranger sees name, position, area, height and weight, and no phone or email', async (t) => {
    const player = await loggedInPlayer(t, 'Nayeem Islam', { position: 'Goalkeeper', area: 'Mirpur 10', height: 178, weight: 70 });
    const stranger = await loggedInPlayer(t, 'Stranger');

    const reply = await getJson(`/players/${player.user.id}`, stranger.jwt);

    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, {
      id: player.user.id,
      role: 'PLAYER',
      createdAt: player.user.createdAt.toISOString(),
      name: 'Nayeem Islam',
      playerProfile: { name: 'Nayeem Islam', position: 'Goalkeeper', height: 178, weight: 70, area: 'Mirpur 10' },
      teams: [],
      inviteOptions: [],
    });
  });

  test('height, weight and area are left out when not set', async (t) => {
    const player = await loggedInPlayer(t, 'Bare Profile', { position: 'Forward' });
    const stranger = await loggedInPlayer(t, 'Stranger');

    const reply = await getJson(`/players/${player.user.id}`, stranger.jwt);

    assert.deepEqual(reply.body.playerProfile, { name: 'Bare Profile', position: 'Forward' });
  });

  test('a venue owner sees the same public profile, without inviteOptions', async (t) => {
    const player = await loggedInPlayer(t, 'Seen By Owner', { area: 'Banani' });
    const owner = await venueOwner(t);

    const reply = await getJson(`/players/${player.user.id}`, owner.jwt);

    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body.playerProfile, { name: 'Seen By Owner', position: 'Any', area: 'Banani' });
    assert.equal('inviteOptions' in reply.body, false);
    assert.doesNotMatch(JSON.stringify(reply.body), /email|example\.com|phone|01798765432/);
  });

  test('an unverified player still has a page (they are only left out of lists and searches)', async (t) => {
    const unverified = await createTestUser(t, { verified: false, ...profile('Not Verified Yet') });
    const viewer = await loggedInPlayer(t, 'Viewer');

    const reply = await getJson(`/players/${unverified.id}`, viewer.jwt);

    assert.equal(reply.status, 200);
    assert.equal(reply.body.name, 'Not Verified Yet');
  });
});

describe('GET /players/:id: the phone', () => {
  test('an accepted teammate sees it; a stranger, a venue owner, and someone only invited or asking do not', async (t) => {
    const player = await loggedInPlayer(t, 'Phone Owner');
    const teammate = await loggedInPlayer(t, 'Teammate');
    const invited = await loggedInPlayer(t, 'Only Invited');
    const requester = await loggedInPlayer(t, 'Only Asking');
    const stranger = await loggedInPlayer(t, 'Stranger');
    const owner = await venueOwner(t);
    const team = await teamOf(player.user.id, 'Phone Team');
    await addRow(team.id, teammate.user.id, 'accepted', 'invite');
    await addRow(team.id, invited.user.id, 'pending', 'invite');
    await addRow(team.id, requester.user.id, 'pending', 'request');

    const asTeammate = await getJson(`/players/${player.user.id}`, teammate.jwt);
    assert.equal(asTeammate.body.playerProfile.phone, PHONE);
    assert.equal('email' in asTeammate.body, false);

    for (const viewer of [invited, requester, stranger, owner]) {
      const reply = await getJson(`/players/${player.user.id}`, viewer.jwt);
      assert.equal(reply.status, 200);
      assert.equal('phone' in reply.body.playerProfile, false);
      assert.doesNotMatch(JSON.stringify(reply.body), /01798765432/);
    }
  });

  test('both must be accepted: the captain does not see the phone of a player they only invited', async (t) => {
    const captain = await loggedInPlayer(t, 'Captain');
    const invited = await loggedInPlayer(t, 'Invited Player');
    const team = await teamOf(captain.user.id, 'Invite Only Team');
    await addRow(team.id, invited.user.id, 'pending', 'invite');

    const before = await getJson(`/players/${invited.user.id}`, captain.jwt);
    assert.equal('phone' in before.body.playerProfile, false);

    await prisma.teamMember.updateMany({ where: { teamId: team.id, userId: invited.user.id }, data: { status: 'accepted', acceptedAt: new Date() } });
    const after = await getJson(`/players/${invited.user.id}`, captain.jwt);
    assert.equal(after.body.playerProfile.phone, PHONE, 'teammates once the invite is accepted');

    await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: invited.user.id } });
    const gone = await getJson(`/players/${invited.user.id}`, captain.jwt);
    assert.equal('phone' in gone.body.playerProfile, false, 'not teammates any more');
  });

  test('the player themselves and the admin see it, with empty optional fields as null', async (t) => {
    const player = await loggedInPlayer(t, 'Self Viewer', { position: 'Defender' });
    const boss = await admin(t);

    for (const viewer of [player, boss]) {
      const reply = await getJson(`/players/${player.user.id}`, viewer.jwt);
      assert.equal(reply.status, 200);
      assert.deepEqual(reply.body.playerProfile, {
        name: 'Self Viewer',
        phone: PHONE,
        position: 'Defender',
        height: null,
        weight: null,
        area: null,
      });
      assert.equal('inviteOptions' in reply.body, false, 'not for yourself, not for the admin');
    }
  });

  test('nobody gets the email from this endpoint: not a teammate, not the admin, not the player', async (t) => {
    const player = await loggedInPlayer(t, 'Email Owner');
    const teammate = await loggedInPlayer(t, 'Teammate');
    const boss = await admin(t);
    const team = await teamOf(player.user.id, 'Email Team');
    await addRow(team.id, teammate.user.id, 'accepted', 'invite');

    for (const viewer of [player, teammate, boss]) {
      const reply = await getJson(`/players/${player.user.id}`, viewer.jwt);
      assert.equal(reply.status, 200);
      assert.doesNotMatch(JSON.stringify(reply.body), /email|example\.com|password|verifyToken|resetToken|tokenVersion/);
    }
  });
});

describe('GET /players/:id: teams', () => {
  test('accepted teams only, the ones they captain first, then by name, with counts', async (t) => {
    const player = await loggedInPlayer(t, 'Team Player');
    const otherCaptain = await loggedInPlayer(t, 'Other Captain');
    const viewer = await loggedInPlayer(t, 'Viewer');
    const zebra = await teamOf(player.user.id, 'Zebra FC', 'Uttara');
    const alpha = await teamOf(otherCaptain.user.id, 'alpha United');
    const bravo = await teamOf(otherCaptain.user.id, 'Bravo City', 'Mirpur');
    const invitedTo = await teamOf(otherCaptain.user.id, 'Invited Only');
    const askedFor = await teamOf(otherCaptain.user.id, 'Asked Only');
    await addRow(alpha.id, player.user.id, 'accepted', 'invite');
    await addRow(bravo.id, player.user.id, 'accepted', 'request');
    await addRow(invitedTo.id, player.user.id, 'pending', 'invite');
    await addRow(askedFor.id, player.user.id, 'pending', 'request');
    // A pending row in a listed team doesn't count as a member.
    await addRow(bravo.id, viewer.user.id, 'pending', 'request');

    const reply = await getJson(`/players/${player.user.id}`, viewer.jwt);

    assert.deepEqual(reply.body.teams, [
      { id: zebra.id, name: 'Zebra FC', area: 'Uttara', memberCount: 1, maxMembers: 15, isCaptain: true },
      { id: alpha.id, name: 'alpha United', area: null, memberCount: 2, maxMembers: 15, isCaptain: false },
      { id: bravo.id, name: 'Bravo City', area: 'Mirpur', memberCount: 2, maxMembers: 15, isCaptain: false },
    ]);
  });
});

describe('GET /players/:id: inviteOptions', () => {
  test('one entry per team the viewer captains, with the state of this player in it', async (t) => {
    const captain = await loggedInPlayer(t, 'Busy Captain');
    const player = await loggedInPlayer(t, 'Wanted Player');
    const free = await teamOf(captain.user.id, 'A Free Team');
    const memberOf = await teamOf(captain.user.id, 'B Member Team');
    const invitedTo = await teamOf(captain.user.id, 'C Invited Team');
    const askedFor = await teamOf(captain.user.id, 'D Asked Team');
    const full = await teamOf(captain.user.id, 'E Full Team');
    const fullButMember = await teamOf(captain.user.id, 'F Full Member Team');
    await addRow(memberOf.id, player.user.id, 'accepted', 'invite');
    await addRow(invitedTo.id, player.user.id, 'pending', 'invite');
    await addRow(askedFor.id, player.user.id, 'pending', 'request');
    await fillTeam(t, full.id, 15);
    await fillTeam(t, fullButMember.id, 14);
    await addRow(fullButMember.id, player.user.id, 'accepted', 'invite');
    // A team the viewer is only a member of, not the captain, is not an option.
    const someoneElse = await loggedInPlayer(t, 'Someone Else');
    const notMine = await teamOf(someoneElse.user.id, 'Not My Team');
    await addRow(notMine.id, captain.user.id, 'accepted', 'invite');

    const reply = await getJson(`/players/${player.user.id}`, captain.jwt);

    assert.deepEqual(reply.body.inviteOptions, [
      { teamId: free.id, name: 'A Free Team', memberCount: 1, maxMembers: 15, state: 'canInvite' },
      { teamId: memberOf.id, name: 'B Member Team', memberCount: 2, maxMembers: 15, state: 'member' },
      { teamId: invitedTo.id, name: 'C Invited Team', memberCount: 1, maxMembers: 15, state: 'invited' },
      { teamId: askedFor.id, name: 'D Asked Team', memberCount: 1, maxMembers: 15, state: 'requested' },
      { teamId: full.id, name: 'E Full Team', memberCount: 15, maxMembers: 15, state: 'full' },
      { teamId: fullButMember.id, name: 'F Full Member Team', memberCount: 15, maxMembers: 15, state: 'member' },
    ]);
  });

  test('an empty list for a player who captains no team', async (t) => {
    const player = await loggedInPlayer(t, 'Some Player');
    const viewer = await loggedInPlayer(t, 'No Teams');

    const reply = await getJson(`/players/${player.user.id}`, viewer.jwt);

    assert.deepEqual(reply.body.inviteOptions, []);
  });

  test('the option matches what the invite endpoint then does', async (t) => {
    const captain = await loggedInPlayer(t, 'Captain');
    const player = await loggedInPlayer(t, 'Target');
    const team = await teamOf(captain.user.id, 'Invite Flow Team');

    const before = await getJson(`/players/${player.user.id}`, captain.jwt);
    assert.equal(before.body.inviteOptions[0].state, 'canInvite');

    const invite = await fetch(`${BASE_URL}/teams/${team.id}/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${captain.jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: player.user.id }),
    });
    assert.equal(invite.status, 201);

    const after = await getJson(`/players/${player.user.id}`, captain.jwt);
    assert.equal(after.body.inviteOptions[0].state, 'invited');
  });
});

describe('GET /players/:id: not a player, or not there', () => {
  test('a venue owner, the admin, a player account without a profile and an unknown id are all "Player not found"', async (t) => {
    const owner = await venueOwner(t);
    const boss = await admin(t);
    const noProfile = await createTestUser(t, { role: 'PLAYER', verified: true });
    const viewer = await loggedInPlayer(t, 'Viewer');

    for (const id of [owner.user.id, boss.user.id, noProfile.id, 2147483646]) {
      const reply = await getJson(`/players/${id}`, viewer.jwt);
      assert.equal(reply.status, 404, String(id));
      assert.deepEqual(reply.body, { error: 'Player not found' });
    }
  });

  test('a bad id is "Invalid player id"', async (t) => {
    const viewer = await loggedInPlayer(t, 'Viewer');

    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const reply = await getJson(`/players/${id}`, viewer.jwt);
      assert.equal(reply.status, 400, id);
      assert.deepEqual(reply.body, { error: 'Invalid player id' });
    }
  });

  test('/players/me, /players/invites and /players/requests are still their own routes', async (t) => {
    const viewer = await loggedInPlayer(t, 'Route Check');

    assert.equal((await getJson('/players/me', viewer.jwt)).body.email, viewer.user.email);
    assert.ok(Array.isArray((await getJson('/players/invites', viewer.jwt)).body));
    assert.ok(Array.isArray((await getJson('/players/requests', viewer.jwt)).body));
  });

  test('a login is needed', async () => {
    const res = await fetch(`${BASE_URL}/players/1`);
    assert.equal(res.status, 401);
  });
});
