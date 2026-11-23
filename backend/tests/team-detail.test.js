// Tests for the team reads of feature 1 (docs/features/team-membership.md, endpoints 1, 2
// and 18): GET /teams/:teamId for every kind of viewer, the new fields on /teams/me,
// pending invites without join requests in the team lists, and positions in /players.
// Join request rows are made directly in the database here, so these tests don't depend
// on the request endpoints. Safety rules are in helpers.js. All users and teams are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, postJson } from './helpers.js';

const get = (path, jwt) => fetch(BASE_URL + path, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });

const getJson = async (path, jwt) => {
  const res = await get(path, jwt);
  assert.equal(res.status, 200, `GET ${path}`);
  return res.json();
};

// A logged-in player with a profile (name, phone, position), so the tests can
// check which profile fields other people see.
const playerNamed = (t, name, position = 'Defender') =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name, phone: '01711111111', position } },
  });

// A team with every kind of row: the captain, an accepted member, a pending invite and
// a pending join request with a message. Plus an outsider, a venue owner and the admin.
async function setUpTeam(t) {
  const captain = await playerNamed(t, 'Captain Rahim', 'Forward');
  const member = await playerNamed(t, 'Member Tanvir', 'Goalkeeper');
  const invitee = await playerNamed(t, 'Invitee Sakib');
  const requester = await playerNamed(t, 'Requester Nayeem', 'Midfielder');
  const outsider = await playerNamed(t, 'Outsider Fahim');
  const owner = await createLoggedInUser(t, { role: 'OWNER' });
  const admin = await createLoggedInUser(t, { role: 'ADMIN' });

  const created = await postJson('/teams/create', { name: 'Detail Test', description: 'About us' }, captain.jwt);
  assert.equal(created.status, 201);
  const team = await created.json();
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: member.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
      { teamId: team.id, userId: invitee.user.id, status: 'pending', origin: 'invite' },
      { teamId: team.id, userId: requester.user.id, status: 'pending', origin: 'request', message: 'I play Thursdays' },
    ],
  });
  return { team, captain, member, invitee, requester, outsider, owner, admin };
}

const ids = (rows) => rows.map((row) => row.userId);

describe('GET /teams/:teamId: what each viewer gets', () => {
  test('the captain: counts, state, members, join requests with messages, pending invites', async (t) => {
    const { team, captain, member, invitee, requester } = await setUpTeam(t);

    const seen = await getJson(`/teams/${team.id}`, captain.jwt);

    assert.equal(seen.id, team.id);
    assert.equal(seen.name, 'Detail Test');
    assert.equal(seen.description, 'About us');
    assert.equal(seen.captainId, captain.user.id);
    assert.equal(seen.memberCount, 2);
    assert.equal(seen.maxMembers, 15);
    assert.equal(seen.viewerState, 'captain');
    assert.deepEqual(ids(seen.members), [captain.user.id, member.user.id], 'captain first');
    assert.deepEqual(ids(seen.joinRequests), [requester.user.id]);
    assert.equal(seen.joinRequests[0].message, 'I play Thursdays');
    assert.equal(seen.joinRequests[0].user.name, 'Requester Nayeem');
    assert.deepEqual(ids(seen.pendingInvites), [invitee.user.id]);
    assert.equal('myRequest' in seen, false);
  });

  test('an accepted member: state member, no join requests, invites or messages', async (t) => {
    const { team, member } = await setUpTeam(t);

    const seen = await getJson(`/teams/${team.id}`, member.jwt);

    assert.equal(seen.viewerState, 'member');
    assert.equal(seen.memberCount, 2);
    for (const field of ['joinRequests', 'pendingInvites', 'myRequest']) assert.equal(field in seen, false, field);
    assert.doesNotMatch(JSON.stringify(seen), /I play Thursdays/);
  });

  test('the invited player, the requester (with their own request) and an outsider', async (t) => {
    const { team, invitee, requester, outsider } = await setUpTeam(t);

    const asInvitee = await getJson(`/teams/${team.id}`, invitee.jwt);
    const asRequester = await getJson(`/teams/${team.id}`, requester.jwt);
    const asOutsider = await getJson(`/teams/${team.id}`, outsider.jwt);

    assert.equal(asInvitee.viewerState, 'invited');
    assert.equal(asRequester.viewerState, 'requested');
    assert.equal(asRequester.myRequest.message, 'I play Thursdays');
    assert.ok(asRequester.myRequest.createdAt);
    assert.equal(asOutsider.viewerState, 'none');
    for (const seen of [asInvitee, asRequester, asOutsider]) {
      assert.equal('joinRequests' in seen, false);
      assert.equal('pendingInvites' in seen, false);
      assert.equal(seen.members.length, 2, 'pending rows are not members');
    }
    assert.equal('myRequest' in asInvitee, false);
    assert.doesNotMatch(JSON.stringify(asOutsider), /I play Thursdays/);
  });

  test('a venue owner is none and sees no requests; the admin is none but sees requests and invites', async (t) => {
    const { team, owner, admin, requester, invitee } = await setUpTeam(t);

    const asOwner = await getJson(`/teams/${team.id}`, owner.jwt);
    const asAdmin = await getJson(`/teams/${team.id}`, admin.jwt);

    assert.equal(asOwner.viewerState, 'none');
    assert.equal('joinRequests' in asOwner, false);
    assert.doesNotMatch(JSON.stringify(asOwner), /I play Thursdays/);
    assert.equal(asAdmin.viewerState, 'none');
    assert.deepEqual(ids(asAdmin.joinRequests), [requester.user.id]);
    assert.equal(asAdmin.joinRequests[0].message, 'I play Thursdays');
    assert.deepEqual(ids(asAdmin.pendingInvites), [invitee.user.id]);
  });
});

describe('GET /teams/:teamId: rows and people', () => {
  test('members are the captain, then the longest-standing (earliest acceptedAt, ties to the lower id)', async (t) => {
    const captain = await playerNamed(t, 'Order Captain');
    const late = await playerNamed(t, 'Joined Late');
    const early = await playerNamed(t, 'Joined Early');
    const tieA = await playerNamed(t, 'Tie A');
    const tieB = await playerNamed(t, 'Tie B');
    const team = await (await postJson('/teams/create', { name: 'Order Test' }, captain.jwt)).json();
    const tie = new Date('2026-01-03T00:00:00Z');
    // The captain's own row is the newest, to show the captain comes first anyway.
    await prisma.teamMember.update({
      where: { teamId_userId: { teamId: team.id, userId: captain.user.id } },
      data: { acceptedAt: new Date('2026-06-01T00:00:00Z') },
    });
    for (const [player, acceptedAt] of [
      [late, new Date('2026-05-01T00:00:00Z')],
      [tieB, tie],
      [early, new Date('2026-01-01T00:00:00Z')],
      [tieA, tie],
    ]) {
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: player.user.id, status: 'accepted', origin: 'invite', acceptedAt },
      });
    }

    const seen = await getJson(`/teams/${team.id}`, captain.jwt);

    // tieB's row was created before tieA's, so it has the lower id.
    assert.deepEqual(ids(seen.members), [captain.user.id, early.user.id, tieB.user.id, tieA.user.id, late.user.id]);
  });

  test("other people's email and phone are never in the reply; positions are", async (t) => {
    const { team, member, captain } = await setUpTeam(t);

    const seen = await getJson(`/teams/${team.id}`, member.jwt);
    const captainRow = seen.members.find((row) => row.userId === captain.user.id);

    assert.equal(captainRow.user.name, 'Captain Rahim');
    assert.deepEqual(captainRow.user.playerProfile, { name: 'Captain Rahim', position: 'Forward' });
    assert.equal('email' in captainRow.user, false);
    const text = JSON.stringify(seen);
    assert.doesNotMatch(text, /01711111111/, 'no phone numbers');
    assert.doesNotMatch(text, new RegExp(captain.user.email), "no other player's email");
  });

  test('membership rows never carry origin or acceptedAt, and only join requests carry a message', async (t) => {
    const { team, captain } = await setUpTeam(t);

    const seen = await getJson(`/teams/${team.id}`, captain.jwt);

    for (const row of [...seen.members, ...seen.pendingInvites, ...seen.joinRequests]) {
      assert.equal('origin' in row, false);
      assert.equal('acceptedAt' in row, false);
      assert.ok('createdAt' in row);
    }
    for (const row of [...seen.members, ...seen.pendingInvites]) assert.equal('message' in row, false);
  });

  test('a join request without a message has message null', async (t) => {
    const { team, captain, outsider } = await setUpTeam(t);
    await prisma.teamMember.create({ data: { teamId: team.id, userId: outsider.user.id, status: 'pending', origin: 'request' } });

    const seen = await getJson(`/teams/${team.id}`, captain.jwt);

    assert.equal(seen.joinRequests.find((row) => row.userId === outsider.user.id).message, null);
  });

  test('join requests are oldest first, pending invites newest first', async (t) => {
    const { team, captain, requester, invitee, outsider } = await setUpTeam(t);
    const second = await playerNamed(t, 'Second Invitee');
    await prisma.teamMember.update({
      where: { teamId_userId: { teamId: team.id, userId: requester.user.id } },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: outsider.user.id, status: 'pending', origin: 'request', createdAt: new Date('2026-02-01T00:00:00Z') },
    });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: second.user.id, status: 'pending', origin: 'invite' } });

    const seen = await getJson(`/teams/${team.id}`, captain.jwt);

    assert.deepEqual(ids(seen.joinRequests), [requester.user.id, outsider.user.id]);
    assert.deepEqual(ids(seen.pendingInvites), [second.user.id, invitee.user.id]);
  });
});

describe('GET /teams/:teamId: bad requests', () => {
  test('bad ids get 400, an unknown team 404, no login 401', async (t) => {
    const { team, outsider } = await setUpTeam(t);

    for (const badId of ['abc', '0', '-1', '1.5', '99999999999']) {
      const res = await get(`/teams/${badId}`, outsider.jwt);
      assert.equal(res.status, 400, `team id ${badId}`);
      assert.deepEqual(await res.json(), { error: 'Invalid team id' });
    }
    const missing = await get('/teams/2147483647', outsider.jwt);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Team not found' });
    assert.equal((await get(`/teams/${team.id}`)).status, 401);
  });
});

describe('Team lists', () => {
  test('/teams/me: member count and limit for everyone, the join request count only for the captain', async (t) => {
    const { team, captain, member } = await setUpTeam(t);

    const asCaptain = (await getJson('/teams/me', captain.jwt)).find((tm) => tm.id === team.id);
    const asMember = (await getJson('/teams/me', member.jwt)).find((tm) => tm.id === team.id);

    assert.equal(asCaptain.memberCount, 2);
    assert.equal(asCaptain.maxMembers, 15);
    assert.equal(asCaptain.joinRequestCount, 1);
    assert.equal(asMember.memberCount, 2);
    assert.equal(asMember.maxMembers, 15);
    assert.equal('joinRequestCount' in asMember, false);
  });

  test('/teams/me: the captain\'s pendingInvites hold invites only, never join requests', async (t) => {
    const { team, captain, invitee } = await setUpTeam(t);

    for (const path of ['/teams/me']) {
      const seen = (await getJson(path, captain.jwt)).find((tm) => tm.id === team.id);
      assert.deepEqual(ids(seen.pendingInvites), [invitee.user.id], path);
      assert.doesNotMatch(JSON.stringify(seen), /I play Thursdays/, `${path}: no messages`);
    }
  });

  test('a pending join request does not put the team in the requester\'s /teams/me', async (t) => {
    const { team, requester } = await setUpTeam(t);

    const mine = await getJson('/teams/me', requester.jwt);

    assert.equal(mine.some((tm) => tm.id === team.id), false);
  });
});

describe('GET /players', () => {
  test("each player has their public position in playerProfile; emails stay hidden and the viewer isn't listed", async (t) => {
    const viewer = await playerNamed(t, 'Viewer Player');
    const other = await playerNamed(t, 'Listed Player', 'Goalkeeper');

    const { items } = await getJson('/players?search=Listed+Player&limit=50', viewer.jwt);
    const listed = items.find((p) => p.id === other.user.id);

    assert.equal(listed.name, 'Listed Player');
    assert.deepEqual(listed.playerProfile, { name: 'Listed Player', position: 'Goalkeeper' });
    assert.equal('email' in listed, false);
    // The list is for finding other players (docs/features/explore.md, P4).
    const own = await getJson('/players?search=Viewer+Player&limit=50', viewer.jwt);
    assert.equal(own.items.some((p) => p.id === viewer.user.id), false);
  });
});
