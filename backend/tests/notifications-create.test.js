// Tests for which action creates which update (docs/features/notifications.md, b.1, b.2
// and d.4): who is told, the exact sentence, the names and ids it stores, and that nobody
// else hears anything. Real requests to the running server. Safety rules are in
// helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, OLD_PASSWORD, createLoggedInUser, postJson } from './helpers.js';
import { updateText } from '../src/utils/notifications.js';

const send = (method, path, jwt, body) =>
  fetch(BASE_URL + path, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const createPlayer = (t, name) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name, phone: '01712345678', position: 'Any' } },
  });

// A captain (Rahim) with the team Alpha FC, two accepted members, and an outsider.
async function setUp(t) {
  const captain = await createPlayer(t, 'Rahim');
  const member = await createPlayer(t, 'Karim');
  const other = await createPlayer(t, 'Tanvir');
  const outsider = await createPlayer(t, 'Nayeem');
  const team = await (await postJson('/teams/create', { name: 'Alpha FC' }, captain.jwt)).json();
  for (const person of [member, other]) await addRow(team, person, 'accepted', 'invite');
  return { captain, member, other, outsider, team };
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
const invited = (team, person) => addRow(team, person, 'pending', 'invite');
const requested = (team, person) => addRow(team, person, 'pending', 'request', { message: 'Hi, I play on Thursdays' });

const updatesOf = (person) => prisma.notification.findMany({ where: { userId: person.user.id }, orderBy: { id: 'asc' } });

// Exactly one update among these people: `type` for `recipient`, with this sentence.
async function assertOnlyUpdate(people, recipient, { type, text, team, player = null }) {
  for (const person of Object.values(people)) {
    if (!person.user) continue;
    const updates = await updatesOf(person);
    if (person !== recipient) {
      assert.deepEqual(updates.map(updateText), [], 'nobody else is told');
      continue;
    }
    assert.equal(updates.length, 1);
    const [update] = updates;
    assert.equal(update.type, type);
    assert.equal(updateText(update), text);
    assert.deepEqual([update.teamId, update.teamName], [team.id, 'Alpha FC']);
    assert.deepEqual(
      [update.playerId, update.playerName],
      player ? [player.user.id, await nameOf(player)] : [null, null]
    );
    assert.deepEqual([update.venueName, update.note, update.readAt], [null, null, null]);
  }
}
const nameOf = async (person) =>
  (await prisma.playerProfile.findUnique({ where: { userId: person.user.id } })).name;

async function assertNoUpdates(people) {
  for (const person of Object.values(people)) {
    if (person.user) assert.deepEqual((await updatesOf(person)).map(updateText), []);
  }
}

const ok = async (response, status = 200) => assert.equal((await response).status, status);

describe('Join requests', () => {
  test('approving tells the requester', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await requested(team, outsider);
    await ok(send('POST', `/teams/${team.id}/requests/${outsider.user.id}/approve`, captain.jwt));
    await assertOnlyUpdate(people, outsider, {
      type: 'requestApproved',
      text: 'Your request to join Alpha FC was approved.',
      team,
    });
  });

  test('inviting a player who had asked approves the request and tells them so', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await requested(team, outsider);
    await ok(send('POST', `/teams/${team.id}/invite`, captain.jwt, { userId: outsider.user.id }));
    await assertOnlyUpdate(people, outsider, {
      type: 'requestApproved',
      text: 'Your request to join Alpha FC was approved.',
      team,
    });
  });

  test('declining tells the requester', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await requested(team, outsider);
    await ok(send('POST', `/teams/${team.id}/requests/${outsider.user.id}/reject`, captain.jwt));
    await assertOnlyUpdate(people, outsider, {
      type: 'requestDeclined',
      text: 'Your request to join Alpha FC was declined.',
      team,
    });
  });
});

describe('Invites', () => {
  test('accepting tells the captain', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await invited(team, outsider);
    await ok(send('POST', `/teams/${team.id}/accept`, outsider.jwt));
    await assertOnlyUpdate(people, captain, {
      type: 'inviteAccepted',
      text: 'Nayeem accepted the invite to Alpha FC.',
      team,
      player: outsider,
    });
  });

  test('asking to join a team that had invited you accepts the invite and tells the captain so', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await invited(team, outsider);
    await ok(send('POST', `/teams/${team.id}/requests`, outsider.jwt, { message: 'Hi' }));
    await assertOnlyUpdate(people, captain, {
      type: 'inviteAccepted',
      text: 'Nayeem accepted the invite to Alpha FC.',
      team,
      player: outsider,
    });
  });

  test('declining tells the captain', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await invited(team, outsider);
    await ok(send('POST', `/teams/${team.id}/reject`, outsider.jwt));
    await assertOnlyUpdate(people, captain, {
      type: 'inviteDeclined',
      text: 'Nayeem declined the invite to Alpha FC.',
      team,
      player: outsider,
    });
  });

  test('the captain now is told, not the one who sent the invite', async (t) => {
    const people = await setUp(t);
    const { captain, member, outsider, team } = people;
    await ok(send('POST', `/teams/${team.id}/invite`, captain.jwt, { userId: outsider.user.id }), 201);
    await ok(send('POST', `/teams/${team.id}/transfer`, captain.jwt, { userId: member.user.id }));
    await ok(send('POST', `/teams/${team.id}/accept`, outsider.jwt));
    assert.deepEqual((await updatesOf(member)).map(updateText), [
      "You're now the captain of Alpha FC.",
      'Nayeem accepted the invite to Alpha FC.',
    ]);
    assert.deepEqual(await updatesOf(captain), []);
  });
});

describe('Members and captaincy', () => {
  test('removing a member tells them', async (t) => {
    const people = await setUp(t);
    const { captain, member, team } = people;
    await ok(send('DELETE', `/teams/${team.id}/members/${member.user.id}`, captain.jwt));
    await assertOnlyUpdate(people, member, { type: 'memberRemoved', text: 'You were removed from Alpha FC.', team });
  });

  test('a member who leaves: the captain is told', async (t) => {
    const people = await setUp(t);
    const { captain, member, team } = people;
    await ok(send('POST', `/teams/${team.id}/leave`, member.jwt));
    await assertOnlyUpdate(people, captain, {
      type: 'memberLeft',
      text: 'Karim left your team Alpha FC.',
      team,
      player: member,
    });
  });

  test('transferring captaincy tells the new captain', async (t) => {
    const people = await setUp(t);
    const { captain, member, team } = people;
    await ok(send('POST', `/teams/${team.id}/transfer`, captain.jwt, { userId: member.user.id }));
    await assertOnlyUpdate(people, member, {
      type: 'becameCaptain',
      text: "You're now the captain of Alpha FC.",
      team,
    });
  });
});

const textsOf = async (person) => (await updatesOf(person)).map(updateText);
const MEMBER = 'Alpha FC, a team you were in, was deleted.';
const INVITED = 'Alpha FC, which had invited you, was deleted.';
const REQUESTED = 'Alpha FC, which you asked to join, was deleted.';

describe('A team is deleted', () => {
  // Alpha FC with its two members, plus an invited player and one who asked to join.
  async function setUpWaiting(t) {
    const people = await setUp(t);
    const requester = await createPlayer(t, 'Farhan');
    await invited(people.team, people.outsider);
    await requested(people.team, requester);
    return { ...people, requester };
  }

  test('by its captain: members, invited and requesting players are told, the captain is not', async (t) => {
    const { captain, member, other, outsider, requester, team } = await setUpWaiting(t);
    await ok(send('DELETE', `/teams/${team.id}`, captain.jwt));
    assert.deepEqual(await textsOf(captain), []);
    assert.deepEqual(await textsOf(member), [MEMBER]);
    assert.deepEqual(await textsOf(other), [MEMBER]);
    assert.deepEqual(await textsOf(outsider), [INVITED]);
    assert.deepEqual(await textsOf(requester), [REQUESTED]);
    const [update] = await updatesOf(member);
    assert.deepEqual([update.teamId, update.teamName, update.playerId, update.playerName], [team.id, 'Alpha FC', null, null]);
  });

  test('by the admin: the captain is told too', async (t) => {
    const { captain, member, other, outsider, requester, team } = await setUpWaiting(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    await ok(send('DELETE', `/admin/teams/${team.id}`, admin.jwt));
    for (const person of [captain, member, other]) assert.deepEqual(await textsOf(person), [MEMBER]);
    assert.deepEqual(await textsOf(outsider), [INVITED]);
    assert.deepEqual(await textsOf(requester), [REQUESTED]);
    assert.deepEqual(await textsOf(admin), []);
  });

  test('by its last member leaving (Q3): the invited and requesting players are told', async (t) => {
    const { captain, member, other, outsider, requester, team } = await setUpWaiting(t);
    await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: { in: [member.user.id, other.user.id] } } });
    await ok(send('POST', `/teams/${team.id}/leave`, captain.jwt));
    for (const person of [captain, member, other]) assert.deepEqual(await textsOf(person), []);
    assert.deepEqual(await textsOf(outsider), [INVITED]);
    assert.deepEqual(await textsOf(requester), [REQUESTED]);
  });

  test("by its last member's account being deleted: the same people are told", async (t) => {
    const { captain, member, other, outsider, requester, team } = await setUpWaiting(t);
    await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: { in: [member.user.id, other.user.id] } } });
    await deleteOwnAccount(captain);
    for (const person of [member, other]) assert.deepEqual(await textsOf(person), []);
    assert.deepEqual(await textsOf(outsider), [INVITED]);
    assert.deepEqual(await textsOf(requester), [REQUESTED]);
  });

  test('refused deletes tell nobody', async (t) => {
    const people = await setUpWaiting(t);
    await ok(send('DELETE', `/teams/${people.team.id}`, people.member.jwt), 403);
    await ok(send('DELETE', `/admin/teams/${people.team.id}`, people.captain.jwt), 403);
    await assertNoUpdates(people);
  });
});

// Deletes the account the way the app does: preview, then password and code.
async function deleteOwnAccount(person) {
  const { previewCode } = await (await send('GET', '/auth/deletion-preview', person.jwt)).json();
  await ok(postJson('/auth/delete-account', { password: OLD_PASSWORD, previewCode }, person.jwt));
}

describe('An account is deleted', () => {
  test("a captain's: the new captain is told, the other members and waiting players are not", async (t) => {
    const { captain, member, other, outsider, team } = await setUp(t);
    await invited(team, outsider);
    await prisma.teamMember.updateMany({ where: { teamId: team.id, userId: member.user.id }, data: { acceptedAt: new Date('2026-01-01') } });
    await deleteOwnAccount(captain);
    assert.deepEqual(await textsOf(member), ["You're now the captain of Alpha FC."]);
    assert.deepEqual(await textsOf(other), []);
    assert.deepEqual(await textsOf(outsider), []);
  });

  test("a member's: the captain hears that a member left, without a name (Q2)", async (t) => {
    const { captain, member, other, team } = await setUp(t);
    await deleteOwnAccount(member);
    assert.deepEqual(await textsOf(captain), ['A member left your team Alpha FC.']);
    assert.deepEqual(await textsOf(other), []);
    const [update] = await updatesOf(captain);
    assert.deepEqual([update.type, update.teamId, update.playerId, update.playerName], ['memberLeft', team.id, null, null]);
  });

  test('by the admin: the same updates', async (t) => {
    const { captain, member } = await setUp(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    await ok(send('DELETE', `/admin/users/${member.user.id}`, admin.jwt));
    assert.deepEqual(await textsOf(captain), ['A member left your team Alpha FC.']);
    assert.deepEqual(await textsOf(admin), []);
  });

  test('several teams at once: everyone gets what concerns them, in one go', async (t) => {
    const { captain, member, other, outsider, team } = await setUp(t);
    // Karim also captains a team with Rahim in it, and one alone that invited Nayeem.
    const withRahim = await (await postJson('/teams/create', { name: 'Beta FC' }, member.jwt)).json();
    await addRow(withRahim, captain, 'accepted', 'invite');
    const alone = await (await postJson('/teams/create', { name: 'Gamma FC' }, member.jwt)).json();
    await invited(alone, outsider);
    await deleteOwnAccount(member);
    assert.deepEqual(
      (await textsOf(captain)).sort(),
      ['A member left your team Alpha FC.', "You're now the captain of Beta FC."].sort()
    );
    assert.deepEqual(await textsOf(outsider), ['Gamma FC, which had invited you, was deleted.']);
    assert.deepEqual(await textsOf(other), []);
    assert.equal((await prisma.team.findUnique({ where: { id: team.id } })).captainId, captain.user.id);
  });

  test('pending invites and requests of the account create nothing', async (t) => {
    const people = await setUp(t);
    await invited(people.team, people.outsider);
    const second = await createPlayer(t, 'Second');
    await requested(people.team, second);
    await deleteOwnAccount(people.outsider);
    await deleteOwnAccount(second);
    await assertNoUpdates({ captain: people.captain, member: people.member, other: people.other });
  });

  test("the account's own updates go, and those that name it (Q1); nobody else's do", async (t) => {
    const { captain, member, other, team } = await setUp(t);
    await ok(send('POST', `/teams/${team.id}/leave`, member.jwt)); // names Karim, for Rahim
    await ok(send('POST', `/teams/${team.id}/leave`, other.jwt)); // names Tanvir, for Rahim
    await prisma.notification.create({ data: { userId: member.user.id, type: 'memberRemoved', teamName: 'Old FC' } });
    assert.equal((await updatesOf(captain)).length, 2);

    await deleteOwnAccount(member);
    assert.deepEqual(await textsOf(captain), ['Tanvir left your team Alpha FC.']);
    assert.equal(await prisma.notification.count({ where: { OR: [{ userId: member.user.id }, { playerId: member.user.id }] } }), 0);
  });

  test("a venue owner's updates go with the account", async (t) => {
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Arena 71' } } });
    await prisma.notification.create({ data: { userId: owner.user.id, type: 'venueApproved', venueName: 'Arena 71' } });
    await deleteOwnAccount(owner);
    assert.equal(await prisma.notification.count({ where: { userId: owner.user.id } }), 0);
  });

  test('a refused deletion (wrong password) creates and removes nothing', async (t) => {
    const { captain, member, team } = await setUp(t);
    await prisma.notification.create({ data: { userId: member.user.id, type: 'memberRemoved', teamName: 'Old FC' } });
    const { previewCode } = await (await send('GET', '/auth/deletion-preview', member.jwt)).json();
    await ok(postJson('/auth/delete-account', { password: 'Wrong-pass-1!', previewCode }, member.jwt), 400);
    assert.deepEqual(await textsOf(captain), []);
    assert.equal((await updatesOf(member)).length, 1);
    assert.ok(await prisma.team.findUnique({ where: { id: team.id } }));
  });
});

describe('What creates no update', () => {
  test('creating, editing, inviting, cancelling an invite, asking to join and cancelling that', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await ok(send('PATCH', `/teams/${team.id}`, captain.jwt, { name: 'Alpha FC', description: 'New words' }));
    await ok(send('POST', `/teams/${team.id}/invite`, captain.jwt, { userId: outsider.user.id }), 201);
    await ok(send('DELETE', `/teams/${team.id}/invites/${outsider.user.id}`, captain.jwt));
    await ok(send('POST', `/teams/${team.id}/requests`, outsider.jwt, { message: 'Hi' }), 201);
    await ok(send('DELETE', `/teams/${team.id}/requests/me`, outsider.jwt));
    await assertNoUpdates(people);
  });

  test('refused actions: not the captain, not a member, nothing to act on', async (t) => {
    const people = await setUp(t);
    const { captain, member, other, outsider, team } = people;
    const base = `/teams/${team.id}`;
    await requested(team, outsider);
    await ok(send('POST', `${base}/requests/${outsider.user.id}/approve`, member.jwt), 403);
    await ok(send('POST', `${base}/requests/${outsider.user.id}/reject`, member.jwt), 403);
    await ok(send('POST', `${base}/invite`, member.jwt, { userId: outsider.user.id }), 403);
    await ok(send('DELETE', `${base}/members/${other.user.id}`, member.jwt), 403);
    await ok(send('POST', `${base}/transfer`, member.jwt, { userId: other.user.id }), 403);
    await ok(send('POST', `${base}/accept`, outsider.jwt), 404);
    await ok(send('POST', `${base}/reject`, outsider.jwt), 404);
    await ok(send('POST', `${base}/leave`, outsider.jwt), 404);
    await ok(send('POST', `${base}/leave`, captain.jwt), 409);
    await ok(send('POST', `${base}/requests/${other.user.id}/approve`, captain.jwt), 404);
    await ok(send('POST', `${base}/requests/${other.user.id}/reject`, captain.jwt), 404);
    await ok(send('DELETE', `${base}/members/${outsider.user.id}`, captain.jwt), 404);
    await ok(send('POST', `${base}/transfer`, captain.jwt, { userId: outsider.user.id }), 404);
    await assertNoUpdates(people);
  });

  test('a full team: accepting and approving are refused and nobody is told', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    for (let index = 0; index < 12; index += 1) {
      await addRow(team, await createPlayer(t, `Filler ${index}`), 'accepted', 'invite');
    }
    const second = await createPlayer(t, 'Second');
    await invited(team, outsider);
    await requested(team, second);
    await ok(send('POST', `/teams/${team.id}/accept`, outsider.jwt), 409);
    await ok(send('POST', `/teams/${team.id}/requests`, outsider.jwt, {}), 409);
    await ok(send('POST', `/teams/${team.id}/requests/${second.user.id}/approve`, captain.jwt), 409);
    await ok(send('POST', `/teams/${team.id}/invite`, captain.jwt, { userId: second.user.id }), 409);
    await assertNoUpdates({ ...people, second });
  });

  test('the same action from two devices at once creates one update', async (t) => {
    const people = await setUp(t);
    const { captain, outsider, team } = people;
    await requested(team, outsider);
    const path = `/teams/${team.id}/requests/${outsider.user.id}/approve`;
    const replies = await Promise.all([send('POST', path, captain.jwt), send('POST', path, captain.jwt)]);
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 404]);
    assert.equal((await updatesOf(outsider)).length, 1);
  });
});

describe('The names are a snapshot (D2)', () => {
  test('renaming the team and the player afterwards changes nothing in old updates', async (t) => {
    const { captain, member, team } = await setUp(t);
    await ok(send('POST', `/teams/${team.id}/leave`, member.jwt));
    await ok(send('PATCH', `/teams/${team.id}`, captain.jwt, { name: 'Beta FC' }));
    await prisma.playerProfile.update({ where: { userId: member.user.id }, data: { name: 'Somebody Else' } });
    assert.deepEqual((await updatesOf(captain)).map(updateText), ['Karim left your team Alpha FC.']);
  });

  test('the name is the team\'s at that moment, with any letters in it', async (t) => {
    const { captain, member, team } = await setUp(t);
    await ok(send('PATCH', `/teams/${team.id}`, captain.jwt, { name: "O'Neil's ঢাকা FC" }));
    await ok(send('POST', `/teams/${team.id}/leave`, member.jwt));
    assert.deepEqual((await updatesOf(captain)).map(updateText), ["Karim left your team O'Neil's ঢাকা FC."]);
  });
});
