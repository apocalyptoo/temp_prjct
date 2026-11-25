// Tests for marking updates as read (docs/features/notifications.md, d.2 endpoint 3):
// POST /notifications/read marks the caller's own unread updates up to an id, and replies
// with the badge's new number. Safety rules are in helpers.js. All users and teams here
// are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser } from './helpers.js';

const post = async (jwt, body) => {
  const res = await fetch(`${BASE_URL}/notifications/read`, {
    method: 'POST',
    headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const read = (person, upToId) => post(person.jwt, { upToId });

const createPlayer = (t, name = 'Rahim') =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name, phone: '01712345678', position: 'Any' } },
  });

// Adds `count` unread updates and returns them, oldest first.
async function addUpdates(person, count) {
  const updates = [];
  for (let index = 0; index < count; index += 1) {
    updates.push(await prisma.notification.create({ data: { userId: person.user.id, type: 'memberRemoved', teamName: `Team ${index + 1}` } }));
  }
  return updates;
}
const unreadIds = async (person) =>
  (await prisma.notification.findMany({ where: { userId: person.user.id, readAt: null }, orderBy: { id: 'asc' } })).map((update) => update.id);

describe('POST /notifications/read', () => {
  test('marks everything up to and including the id, and replies with the new number', async (t) => {
    const player = await createPlayer(t);
    const [, second, third] = await addUpdates(player, 3);
    const before = Date.now();

    assert.deepEqual(await read(player, second.id), { status: 200, body: { count: 1 } });

    assert.deepEqual(await unreadIds(player), [third.id]);
    const { readAt } = await prisma.notification.findUnique({ where: { id: second.id } });
    assert.ok(Math.abs(readAt.getTime() - before) < 10_000, `read about now: ${readAt.toISOString()}`);
  });

  test('an update that arrived after the list was loaded stays unread (P16)', async (t) => {
    const player = await createPlayer(t);
    const [shown] = await addUpdates(player, 1);
    const [later] = await addUpdates(player, 1);
    assert.deepEqual((await read(player, shown.id)).body, { count: 1 });
    assert.deepEqual(await unreadIds(player), [later.id]);
  });

  test("the number still counts what's waiting for an answer", async (t) => {
    const captain = await createPlayer(t, 'Rahim');
    const [invited, requester] = [await createPlayer(t, 'Nayeem'), await createPlayer(t, 'Karim')];
    const team = await prisma.team.create({
      data: {
        name: 'Alpha FC',
        captainId: captain.user.id,
        members: {
          create: [
            { userId: captain.user.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() },
            { userId: invited.user.id, status: 'pending', origin: 'invite' },
            { userId: requester.user.id, status: 'pending', origin: 'request' },
          ],
        },
      },
    });
    for (const person of [captain, invited]) {
      const [update] = await addUpdates(person, 1);
      assert.deepEqual((await read(person, update.id)).body, { count: 1 });
      assert.deepEqual(await unreadIds(person), []);
    }
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id, status: 'pending' } }), 2, 'reading answers nothing');
  });

  test('twice changes nothing more: the first time stays', async (t) => {
    const player = await createPlayer(t);
    const [update] = await addUpdates(player, 1);
    await read(player, update.id);
    const first = await prisma.notification.findUnique({ where: { id: update.id } });
    assert.deepEqual((await read(player, update.id)).body, { count: 0 });
    assert.deepEqual(await prisma.notification.findUnique({ where: { id: update.id } }), first);
  });

  test("never another user's updates, whatever the id", async (t) => {
    const [mine, theirs] = [await createPlayer(t, 'Rahim'), await createPlayer(t, 'Karim')];
    const [own] = await addUpdates(mine, 1);
    const [other] = await addUpdates(theirs, 1);

    assert.deepEqual((await read(mine, other.id)).body, { count: 0 }); // their id is higher than mine
    assert.deepEqual(await unreadIds(mine), [], 'my own, up to that id');
    assert.deepEqual(await unreadIds(theirs), [other.id]);
    assert.deepEqual((await read(theirs, own.id)).body, { count: 1 }); // my id is lower than theirs
    assert.deepEqual(await unreadIds(theirs), [other.id]);
  });

  test("an id that's gone, or with no updates at all, isn't an error", async (t) => {
    const player = await createPlayer(t);
    assert.deepEqual(await read(player, 2147483647), { status: 200, body: { count: 0 } });
    const [update] = await addUpdates(player, 1);
    await prisma.notification.delete({ where: { id: update.id } });
    assert.deepEqual(await read(player, update.id), { status: 200, body: { count: 0 } });
  });

  test('a venue owner too', async (t) => {
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Arena 71' } } });
    const [update] = await addUpdates(owner, 1);
    assert.deepEqual(await read(owner, update.id), { status: 200, body: { count: 0 } });
  });

  test('the same read from two phones at once: both 200, everything read', async (t) => {
    const player = await createPlayer(t);
    const updates = await addUpdates(player, 5);
    const last = updates[4].id;
    const replies = await Promise.all([read(player, last), read(player, last), read(player, updates[2].id)]);
    assert.deepEqual(replies.map((reply) => reply.status), [200, 200, 200]);
    assert.deepEqual(await unreadIds(player), []);
  });

  test('every bad body: 400 "Invalid notification id", and nothing is marked', async (t) => {
    const player = await createPlayer(t);
    const [update] = await addUpdates(player, 1);
    const bad = [undefined, [], {}, ...['88', 0, -1, 1.5, 2147483648, null, true, [update.id], { gt: 0 }].map((upToId) => ({ upToId }))];
    for (const body of bad) {
      assert.deepEqual(await post(player.jwt, body), { status: 400, body: { error: 'Invalid notification id' } }, JSON.stringify(body));
    }
    assert.deepEqual(await unreadIds(player), [update.id]);
  });

  test('403 for the admin, whatever the body; 401 without a login', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    for (const body of [{ upToId: 1 }, { upToId: 'x' }]) {
      assert.deepEqual(await post(admin.jwt, body), { status: 403, body: { error: 'The admin account has no notifications.' } });
    }
    assert.equal((await post(undefined, { upToId: 1 })).status, 401);
  });
});
