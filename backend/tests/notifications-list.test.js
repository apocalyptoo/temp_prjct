// Tests for the Notifications screen's data and the badge (docs/features/notifications.md,
// d.2 endpoints 1 and 2): GET /notifications and GET /notifications/count. Who sees what,
// in which order, what's never sent, and that the number always matches the list. Safety
// rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, postJson } from './helpers.js';
import { MAX_UPDATES } from '../src/utils/notifications.js';

const send = (method, path, jwt, body) =>
  fetch(BASE_URL + path, {
    method,
    headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function getJson(path, jwt) {
  const res = await send('GET', path, jwt);
  assert.equal(res.status, 200, path);
  return res.json();
}
const ok = async (response, status = 200) => assert.equal((await response).status, status);

// The screen's data, after checking that the badge endpoint gives the same number, and
// that the number is what the lists add up to.
async function screenOf(person) {
  const data = await getJson('/notifications', person.jwt);
  assert.deepEqual(await getJson('/notifications/count', person.jwt), { count: data.count });
  const requests = data.needsAction.joinRequests.flatMap((group) => group.requests);
  const unread = data.updates.filter((update) => !update.read);
  assert.equal(data.count, data.needsAction.invites.length + requests.length + unread.length);
  return data;
}

const PHONE = '01712345678';
const createPlayer = (t, name, profile = {}) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name, phone: PHONE, position: 'Forward', height: 170, ...profile } },
  });
const createOwner = (t) => createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Arena 71' } } });

async function createTeam(captain, name, extra = {}) {
  const res = await postJson('/teams/create', { name, ...extra }, captain.jwt);
  assert.equal(res.status, 201);
  return res.json();
}
const addRow = (team, person, status, origin, extra = {}) =>
  prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: person.user.id,
      status,
      origin,
      acceptedAt: status === 'accepted' ? new Date() : null,
      ...extra,
    },
  });
const invite = (team, person, extra) => addRow(team, person, 'pending', 'invite', extra);
const request = (team, person, extra) => addRow(team, person, 'pending', 'request', extra);
const addUpdate = (person, data) => prisma.notification.create({ data: { userId: person.user.id, ...data } });

describe('Who may ask', () => {
  for (const path of ['/notifications', '/notifications/count']) {
    test(`${path}: 403 for the admin, 401 without a login`, async (t) => {
      const admin = await createLoggedInUser(t, { role: 'ADMIN' });
      const refused = await send('GET', path, admin.jwt);
      assert.equal(refused.status, 403);
      assert.deepEqual(await refused.json(), { error: 'The admin account has no notifications.' });

      const noLogin = await send('GET', path);
      assert.equal(noLogin.status, 401);
      assert.deepEqual(await noLogin.json(), { error: 'No token' });
      assert.equal((await send('GET', path, 'not-a-token')).status, 401);
    });
  }

  test('a player and a venue owner with nothing: empty lists and 0', async (t) => {
    for (const person of [await createPlayer(t, 'Rahim'), await createOwner(t)]) {
      assert.deepEqual(await screenOf(person), {
        count: 0,
        needsAction: { invites: [], joinRequests: [] },
        updates: [],
      });
    }
  });
});

describe('Needs your action: invites', () => {
  test("the player's pending invites, newest first, exactly in the spec's shape", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const member = await createPlayer(t, 'Karim');
    const player = await createPlayer(t, 'Nayeem');
    const older = await createTeam(captain, 'Alpha FC', { area: 'Dhanmondi' });
    const newer = await createTeam(captain, 'Beta FC');
    await addRow(older, member, 'accepted', 'invite');
    const first = await invite(older, player, { createdAt: new Date('2026-01-01T00:00:00Z') });
    const second = await invite(newer, player, { createdAt: new Date('2026-02-01T00:00:00Z') });

    const { count, needsAction, updates } = await screenOf(player);
    assert.equal(count, 2);
    assert.deepEqual(needsAction.joinRequests, []);
    assert.deepEqual(updates, []);
    const rahim = { id: captain.user.id, name: 'Rahim' };
    assert.deepEqual(needsAction.invites, [
      {
        id: second.id,
        teamId: newer.id,
        createdAt: '2026-02-01T00:00:00.000Z',
        team: { id: newer.id, name: 'Beta FC', area: null, memberCount: 1, maxMembers: 15, captain: rahim },
      },
      {
        id: first.id,
        teamId: older.id,
        createdAt: '2026-01-01T00:00:00.000Z',
        team: { id: older.id, name: 'Alpha FC', area: 'Dhanmondi', memberCount: 2, maxMembers: 15, captain: rahim },
      },
    ]);
  });

  test("not memberships, not their own requests, and not other players' invites", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const player = await createPlayer(t, 'Nayeem');
    const other = await createPlayer(t, 'Karim');
    await addRow(await createTeam(captain, 'Member FC'), player, 'accepted', 'invite');
    await request(await createTeam(captain, 'Asked FC'), player);
    await invite(await createTeam(captain, 'Other FC'), other);

    assert.deepEqual((await screenOf(player)).needsAction, { invites: [], joinRequests: [] });
  });
});

describe('Needs your action: join requests', () => {
  test("per team by name, oldest request first, with the message, exactly in the spec's shape", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [one, two, three] = [
      await createPlayer(t, 'Nayeem', { area: 'Mirpur 10' }),
      await createPlayer(t, 'Karim'),
      await createPlayer(t, 'Tanvir', { position: 'Goalkeeper' }),
    ];
    const beta = await createTeam(captain, 'beta FC');
    const alpha = await createTeam(captain, 'Alpha FC');
    await createTeam(captain, 'Quiet FC'); // nobody asked: no group
    const later = await request(beta, two, { createdAt: new Date('2026-02-01T00:00:00Z') });
    const earlier = await request(beta, one, { createdAt: new Date('2026-01-01T00:00:00Z'), message: 'I play Thursdays' });
    const only = await request(alpha, three, { createdAt: new Date('2026-03-01T00:00:00Z') });

    const { count, needsAction } = await screenOf(captain);
    assert.equal(count, 3);
    const person = (who, name, profile) => ({ id: who.user.id, name, playerProfile: { name, ...profile } });
    const asJson = (value) => JSON.parse(JSON.stringify(value)); // dates as text
    assert.deepEqual(needsAction.joinRequests, asJson([
      {
        teamId: alpha.id,
        teamName: 'Alpha FC',
        memberCount: 1,
        maxMembers: 15,
        requests: [
          { id: only.id, userId: three.user.id, createdAt: only.createdAt, message: null, user: person(three, 'Tanvir', { position: 'Goalkeeper' }) },
        ],
      },
      {
        teamId: beta.id,
        teamName: 'beta FC',
        memberCount: 1,
        maxMembers: 15,
        requests: [
          { id: earlier.id, userId: one.user.id, createdAt: earlier.createdAt, message: 'I play Thursdays', user: person(one, 'Nayeem', { position: 'Forward', area: 'Mirpur 10' }) },
          { id: later.id, userId: two.user.id, createdAt: later.createdAt, message: null, user: person(two, 'Karim', { position: 'Forward' }) },
        ],
      },
    ]));
  });

  test('two teams with the same name: by id', async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const player = await createPlayer(t, 'Nayeem');
    const [first, second] = [await createTeam(captain, 'Same FC'), await createTeam(captain, 'Same FC')];
    await request(second, player);
    await request(first, player);
    const { needsAction } = await screenOf(captain);
    assert.deepEqual(needsAction.joinRequests.map((group) => group.teamId), [first.id, second.id]);
  });

  test("only the captain sees them: not a member, the requester, an invited player or a venue owner", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [member, requester, invited] = [await createPlayer(t, 'Karim'), await createPlayer(t, 'Nayeem'), await createPlayer(t, 'Tanvir')];
    const owner = await createOwner(t);
    const team = await createTeam(captain, 'Alpha FC');
    await addRow(team, member, 'accepted', 'invite');
    await invite(team, invited);
    await request(team, requester, { message: 'A private message' });

    for (const person of [member, requester, invited, owner]) {
      const res = await send('GET', '/notifications', person.jwt);
      assert.ok(!(await res.text()).includes('A private message'));
      assert.deepEqual((await screenOf(person)).needsAction.joinRequests, []);
    }
    assert.equal((await screenOf(captain)).needsAction.joinRequests[0].requests[0].message, 'A private message');
  });

  test('a transfer moves them, with the message, to the new captain at once', async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const next = await createPlayer(t, 'Karim');
    const requester = await createPlayer(t, 'Nayeem');
    const team = await createTeam(captain, 'Alpha FC');
    await addRow(team, next, 'accepted', 'invite');
    await request(team, requester, { message: 'Hi' });
    await ok(send('POST', `/teams/${team.id}/transfer`, captain.jwt, { userId: next.user.id }));

    assert.deepEqual((await screenOf(captain)).needsAction.joinRequests, []);
    const now = await screenOf(next);
    assert.equal(now.needsAction.joinRequests[0].requests[0].message, 'Hi');
    assert.equal(now.count, 2, 'the request, and "you\'re now the captain"');
  });

  test('a full team: its request and invite still show and count, with how full it is', async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [requester, invited] = [await createPlayer(t, 'Nayeem'), await createPlayer(t, 'Tanvir')];
    const team = await createTeam(captain, 'Alpha FC');
    for (let index = 0; index < 14; index += 1) await addRow(team, await createPlayer(t, `Filler ${index}`), 'accepted', 'invite');
    await request(team, requester);
    await invite(team, invited);

    const asCaptain = await screenOf(captain);
    assert.equal(asCaptain.count, 1);
    assert.deepEqual([asCaptain.needsAction.joinRequests[0].memberCount, asCaptain.needsAction.joinRequests[0].maxMembers], [15, 15]);
    const { team: theirs } = (await screenOf(invited)).needsAction.invites[0];
    assert.deepEqual([theirs.memberCount, theirs.maxMembers], [15, 15]);
  });

  test('a player who is invited and captains a team sees both', async (t) => {
    const [a, b, c] = [await createPlayer(t, 'A One'), await createPlayer(t, 'B Two'), await createPlayer(t, 'C Three')];
    await invite(await createTeam(a, 'A FC'), b);
    await request(await createTeam(b, 'B FC'), c);
    const { count, needsAction } = await screenOf(b);
    assert.equal(count, 2);
    assert.equal(needsAction.invites[0].team.name, 'A FC');
    assert.equal(needsAction.joinRequests[0].teamName, 'B FC');
  });
});

describe('Updates', () => {
  test('newest first (the highest id), with text, note, read and nothing else', async (t) => {
    const owner = await createOwner(t);
    const older = await addUpdate(owner, { type: 'venueMovedToReview', venueName: 'Arena 71', note: 'Closed for repairs', readAt: new Date() });
    // A later id with an earlier time: the id decides.
    const newer = await addUpdate(owner, { type: 'venueApproved', venueName: 'Arena 71', createdAt: new Date('2026-01-01T00:00:00Z') });

    const { count, needsAction, updates } = await screenOf(owner);
    assert.equal(count, 1);
    assert.deepEqual(needsAction, { invites: [], joinRequests: [] });
    assert.deepEqual(updates, [
      {
        id: newer.id,
        type: 'venueApproved',
        text: 'Arena 71 was approved. Players can find it now.',
        note: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        read: false,
        opens: { kind: 'venue', name: 'Arena 71' },
      },
      {
        id: older.id,
        type: 'venueMovedToReview',
        text: 'Arena 71 was moved back to review.',
        note: 'Closed for repairs',
        createdAt: older.createdAt.toISOString(),
        read: true,
        opens: { kind: 'venue', name: 'Arena 71' },
      },
    ]);
  });

  test("each type's sentence and what it opens", async (t) => {
    const player = await createPlayer(t, 'Rahim');
    const names = { teamId: 7, teamName: 'Alpha FC', playerId: 31, playerName: 'Tanvir' };
    const team = { kind: 'team', id: 7, name: 'Alpha FC' };
    const person = { kind: 'player', id: 31, name: 'Tanvir' };
    const venue = { kind: 'venue', name: 'Arena 71' };
    const cases = [
      [{ type: 'requestApproved', ...names }, 'Your request to join Alpha FC was approved.', team],
      [{ type: 'requestDeclined', ...names }, 'Your request to join Alpha FC was declined.', team],
      [{ type: 'inviteAccepted', ...names }, 'Tanvir accepted the invite to Alpha FC.', team],
      [{ type: 'inviteDeclined', ...names }, 'Tanvir declined the invite to Alpha FC.', person],
      [{ type: 'memberRemoved', ...names }, 'You were removed from Alpha FC.', team],
      [{ type: 'memberLeft', ...names }, 'Tanvir left your team Alpha FC.', person],
      [{ type: 'memberLeft', teamId: 7, teamName: 'Alpha FC' }, 'A member left your team Alpha FC.', team],
      [{ type: 'becameCaptain', ...names }, "You're now the captain of Alpha FC.", team],
      [{ type: 'teamDeleted', ...names }, 'Alpha FC, a team you were in, was deleted.', team],
      [{ type: 'teamDeletedInvite', ...names }, 'Alpha FC, which had invited you, was deleted.', team],
      [{ type: 'teamDeletedRequest', ...names }, 'Alpha FC, which you asked to join, was deleted.', team],
      [{ type: 'venueApproved', venueName: 'Arena 71' }, 'Arena 71 was approved. Players can find it now.', venue],
      [{ type: 'venueMovedToReview', venueName: 'Arena 71', note: 'Why' }, 'Arena 71 was moved back to review.', venue],
      [{ type: 'becameCaptain', teamName: 'Alpha FC' }, "You're now the captain of Alpha FC.", null], // no id: nothing to open
    ];
    for (const [data] of cases) await addUpdate(player, data);

    const { updates } = await screenOf(player);
    assert.deepEqual(
      updates.reverse().map(({ text, opens }) => [text, opens]),
      cases.map(([, text, opens]) => [text, opens])
    );
  });

  test("only the viewer's own", async (t) => {
    const [mine, theirs] = [await createPlayer(t, 'Rahim'), await createPlayer(t, 'Karim')];
    await addUpdate(theirs, { type: 'memberRemoved', teamId: 7, teamName: 'Alpha FC' });
    assert.deepEqual((await screenOf(mine)).updates, []);
    assert.equal((await screenOf(theirs)).updates.length, 1);
  });

  test('at most the newest 50, and the number counts those', async (t) => {
    const player = await createPlayer(t, 'Rahim');
    await prisma.notification.createMany({
      data: Array.from({ length: 52 }, (_, index) => ({ userId: player.user.id, type: 'memberRemoved', teamName: `Team ${index + 1}` })),
    });
    const { count, updates } = await screenOf(player);
    assert.equal(updates.length, MAX_UPDATES);
    assert.equal(count, 50);
    assert.equal(updates[0].text, 'You were removed from Team 52.');
    assert.equal(updates[49].text, 'You were removed from Team 3.');
  });
});

describe('What is never sent', () => {
  test("no email, phone, height, origin or acceptedAt of anyone, anywhere in the reply", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [requester, member] = [await createPlayer(t, 'Nayeem'), await createPlayer(t, 'Karim')];
    const team = await createTeam(captain, 'Alpha FC');
    await addRow(team, member, 'accepted', 'invite'); // even a teammate's phone isn't here
    await request(team, requester, { message: 'Hi' });
    await invite(await createTeam(member, 'Beta FC'), captain);
    await ok(send('POST', `/teams/${team.id}/leave`, member.jwt));

    const text = await (await send('GET', '/notifications', captain.jwt)).text();
    assert.ok(text.includes('Nayeem') && text.includes('Beta FC') && text.includes('Karim left your team'));
    for (const secret of ['@example.com', PHONE, 'email', 'phone', 'password', 'origin', 'acceptedAt', 'tokenVersion', '"status"']) {
      assert.ok(!text.includes(secret), `${secret} isn't in the reply`);
    }
  });
});

describe('The number follows every change', () => {
  test('invite, cancel, invite, decline; request, approve; leaving', async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const player = await createPlayer(t, 'Nayeem');
    const team = await createTeam(captain, 'Alpha FC');
    const base = `/teams/${team.id}`;
    const counts = async () => [(await screenOf(captain)).count, (await screenOf(player)).count];

    assert.deepEqual(await counts(), [0, 0]);
    await ok(send('POST', `${base}/invite`, captain.jwt, { userId: player.user.id }), 201);
    assert.deepEqual(await counts(), [0, 1], 'invited');
    await ok(send('DELETE', `${base}/invites/${player.user.id}`, captain.jwt));
    assert.deepEqual(await counts(), [0, 0], 'the invite was cancelled');
    await ok(send('POST', `${base}/invite`, captain.jwt, { userId: player.user.id }), 201);
    await ok(send('POST', `${base}/reject`, player.jwt));
    assert.deepEqual(await counts(), [1, 0], 'the captain hears it was declined');
    await ok(send('POST', `${base}/requests`, player.jwt, { message: 'Hi' }), 201);
    assert.deepEqual(await counts(), [2, 0], 'and has a request to answer');
    await ok(send('DELETE', `${base}/requests/me`, player.jwt));
    assert.deepEqual(await counts(), [1, 0], 'the request was cancelled, with no update');
    await ok(send('POST', `${base}/requests`, player.jwt, {}), 201);
    await ok(send('POST', `${base}/requests/${player.user.id}/approve`, captain.jwt));
    assert.deepEqual(await counts(), [1, 1], 'the player hears it was approved');
    await ok(send('POST', `${base}/leave`, player.jwt));
    assert.deepEqual(await counts(), [2, 1], 'the captain hears the player left');
  });

  test('deleting the team takes its pending items away and leaves the updates', async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [invited, requester] = [await createPlayer(t, 'Nayeem'), await createPlayer(t, 'Karim')];
    const team = await createTeam(captain, 'Alpha FC');
    await invite(team, invited);
    await request(team, requester);
    assert.equal((await screenOf(captain)).count, 1);
    await ok(send('DELETE', `/teams/${team.id}`, captain.jwt));

    assert.equal((await screenOf(captain)).count, 0);
    const now = await screenOf(invited);
    assert.deepEqual(now.needsAction.invites, []);
    assert.deepEqual(now.updates.map((update) => update.text), ['Alpha FC, which had invited you, was deleted.']);
    assert.equal(now.count, 1);
  });
});
