// Tests for createUpdates (docs/features/notifications.md, d.3), the one function that
// adds updates, and for the wording (b.1). It's called directly, inside real transactions
// on the local database. Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';
import { MAX_UPDATES, createUpdates, teamUpdate, venueUpdate, updateText } from '../src/utils/notifications.js';

const TEAM = { id: 2147483000, name: 'Alpha FC' };
const NOBODY = 2147483001; // an actor who isn't one of the recipients
const send = (updates, actorId = NOBODY) => prisma.$transaction((tx) => createUpdates(tx, updates, { actorId }));
const updatesOf = (user) => prisma.notification.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
const removed = (user, name = TEAM.name) => teamUpdate('memberRemoved', user.id, { ...TEAM, name });

// Puts `count` updates straight into the table, named "Old 1", "Old 2" and so on.
const fill = (user, count = MAX_UPDATES) =>
  prisma.notification.createMany({
    data: Array.from({ length: count }, (_, index) => removed(user, `Old ${index + 1}`)),
  });

describe('createUpdates', () => {
  test('stores who, what, the names and the ids, unread', async (t) => {
    const user = await createTestUser(t);
    await send([teamUpdate('inviteAccepted', user.id, TEAM, { id: 12, name: 'Rahim' })]);

    const [{ id, createdAt, ...update }, ...more] = await updatesOf(user);
    assert.equal(more.length, 0);
    assert.ok(id > 0 && createdAt instanceof Date);
    assert.deepEqual(update, {
      userId: user.id,
      type: 'inviteAccepted',
      teamId: TEAM.id,
      teamName: 'Alpha FC',
      playerId: 12,
      playerName: 'Rahim',
      venueName: null,
      note: null,
      readAt: null,
    });
  });

  test("a venue update stores the venue's name and the note", async (t) => {
    const user = await createTestUser(t, { role: 'OWNER' });
    await send([venueUpdate('venueMovedToReview', user.id, 'Arena 71', 'Closed for repairs')]);
    const [{ type, venueName, note, teamId, playerId }] = await updatesOf(user);
    assert.deepEqual([type, venueName, note, teamId, playerId], ['venueMovedToReview', 'Arena 71', 'Closed for repairs', null, null]);
  });

  test('the person who did the action gets nothing; everyone else does (D3)', async (t) => {
    const [actor, other] = [await createTestUser(t), await createTestUser(t)];
    await send([removed(actor), removed(other)], actor.id);
    assert.equal((await updatesOf(actor)).length, 0);
    assert.equal((await updatesOf(other)).length, 1);
  });

  test('nothing to tell, or only the actor: nothing happens', async (t) => {
    const actor = await createTestUser(t);
    await send([]);
    await send([removed(actor)], actor.id);
    assert.equal((await updatesOf(actor)).length, 0);
  });

  test("the actor can't be forgotten", async (t) => {
    const user = await createTestUser(t);
    await assert.rejects(prisma.$transaction((tx) => createUpdates(tx, [removed(user)], {})), TypeError);
    assert.equal((await updatesOf(user)).length, 0);
  });

  test('a recipient whose account is gone is skipped; the others are told', async (t) => {
    const user = await createTestUser(t);
    await send([removed({ id: 2147483647 }), removed(user)]);
    await send([removed({ id: 2147483647 })]);
    assert.equal((await updatesOf(user)).length, 1);
  });

  test('several updates for one person are all kept, in the order given', async (t) => {
    const user = await createTestUser(t);
    await send([removed(user, 'First'), removed(user, 'Second')]);
    assert.deepEqual((await updatesOf(user)).map((update) => update.teamName), ['First', 'Second']);
  });
});

describe('An action and its update are all or nothing (D1)', () => {
  test('if the action fails after createUpdates, there is no update', async (t) => {
    const user = await createTestUser(t);
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await createUpdates(tx, [removed(user)], { actorId: NOBODY });
        throw new Error('forced failure');
      }),
      /forced failure/
    );
    assert.equal((await updatesOf(user)).length, 0);
  });

  test('if createUpdates fails, the action is undone', async (t) => {
    const user = await createTestUser(t);
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { tokenVersion: 99 } });
        await createUpdates(tx, [teamUpdate('noSuchType', user.id, TEAM)], { actorId: NOBODY });
      })
    );
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).tokenVersion, 0);
  });
});

describe('Only the newest 50 stay', () => {
  test('50 are kept as they are', async (t) => {
    const user = await createTestUser(t);
    await fill(user, MAX_UPDATES - 1);
    await send([removed(user, 'New')]);
    const updates = await updatesOf(user);
    assert.equal(updates.length, 50);
    assert.deepEqual([updates[0].teamName, updates[49].teamName], ['Old 1', 'New']);
  });

  test('the 51st removes exactly the oldest, read or unread, and only for that user', async (t) => {
    const [user, bystander] = [await createTestUser(t), await createTestUser(t)];
    await fill(user);
    await fill(bystander);
    await prisma.notification.updateMany({ where: { userId: user.id, teamName: 'Old 2' }, data: { readAt: new Date() } });

    await send([removed(user, 'New')]);
    const updates = await updatesOf(user);
    assert.equal(updates.length, 50);
    assert.deepEqual([updates[0].teamName, updates[49].teamName], ['Old 2', 'New']);
    assert.equal((await updatesOf(bystander)).length, 50);
    assert.equal((await updatesOf(bystander))[0].teamName, 'Old 1');
  });

  test('more than one over the limit: all of them go', async (t) => {
    const user = await createTestUser(t);
    await fill(user, 60);
    await send([removed(user, 'New A'), removed(user, 'New B')]);
    const updates = await updatesOf(user);
    assert.equal(updates.length, 50);
    assert.deepEqual([updates[0].teamName, updates[49].teamName], ['Old 13', 'New B']);
  });

  test('several recipients at once: each keeps their own newest 50', async (t) => {
    const [full, empty] = [await createTestUser(t), await createTestUser(t)];
    await fill(full);
    await send([removed(full, 'New'), removed(empty, 'New')]);
    assert.equal((await updatesOf(full)).length, 50);
    assert.equal((await updatesOf(empty)).length, 1);
  });

  test("a row someone else has locked is skipped, so the action doesn't wait, and goes next time (P19)", async (t) => {
    const user = await createTestUser(t);
    await fill(user);
    const [oldest] = await updatesOf(user);

    await prisma.$transaction(async (holder) => {
      await holder.$queryRaw`SELECT id FROM "Notification" WHERE id = ${oldest.id} FOR UPDATE`;
      // Waiting for the lock would never end here: the holder is waiting for this.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
        await createUpdates(tx, [removed(user, 'New 1')], { actorId: NOBODY });
      });
    });
    assert.equal((await updatesOf(user)).length, 51);

    await send([removed(user, 'New 2')]);
    const updates = await updatesOf(user);
    assert.equal(updates.length, 50);
    assert.equal(updates[0].teamName, 'Old 3');
  });
});

describe('The wording', () => {
  const names = { teamName: 'Alpha FC', playerName: 'Rahim', venueName: 'Arena 71', note: 'Closed' };
  for (const [type, text] of [
    ['requestApproved', 'Your request to join Alpha FC was approved.'],
    ['requestDeclined', 'Your request to join Alpha FC was declined.'],
    ['inviteAccepted', 'Rahim accepted the invite to Alpha FC.'],
    ['inviteDeclined', 'Rahim declined the invite to Alpha FC.'],
    ['memberRemoved', 'You were removed from Alpha FC.'],
    ['memberLeft', 'Rahim left your team Alpha FC.'],
    ['becameCaptain', "You're now the captain of Alpha FC."],
    ['teamDeleted', 'Alpha FC, a team you were in, was deleted.'],
    ['teamDeletedInvite', 'Alpha FC, which had invited you, was deleted.'],
    ['teamDeletedRequest', 'Alpha FC, which you asked to join, was deleted.'],
    ['venueApproved', 'Arena 71 was approved. Players can find it now.'],
    ['venueMovedToReview', 'Arena 71 was moved back to review.'],
  ]) {
    test(type, () => assert.equal(updateText({ type, ...names }), text));
  }

  test('a member whose account was deleted has no name', () => {
    assert.equal(updateText({ type: 'memberLeft', teamName: 'Alpha FC', playerName: null }), 'A member left your team Alpha FC.');
  });

  test('every type in the database has a sentence', async () => {
    const rows = await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"NotificationType"))::text AS type`;
    for (const { type } of rows) assert.equal(typeof updateText({ type, ...names }), 'string', type);
  });
});
