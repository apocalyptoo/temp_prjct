// Tests for the notifications migration (docs/features/notifications.md, section c): the
// table's columns, the list of types, the two indexes, and what happens to a user's
// updates when the account goes. These check the database itself, through Prisma. Safety
// rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';

const TYPES = [
  'requestApproved',
  'requestDeclined',
  'inviteAccepted',
  'inviteDeclined',
  'memberRemoved',
  'memberLeft',
  'becameCaptain',
  'teamDeleted',
  'teamDeletedInvite',
  'teamDeletedRequest',
  'venueApproved',
  'venueMovedToReview',
];

describe('The notifications migration', () => {
  test('Notification has its columns, and only who, what and when are required', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Notification'`;
    const columns = Object.fromEntries(rows.map((row) => [row.column_name, row.is_nullable === 'YES' ? 'optional' : 'required']));
    assert.deepEqual(columns, {
      id: 'required',
      userId: 'required',
      type: 'required',
      teamId: 'optional',
      teamName: 'optional',
      playerId: 'optional',
      playerName: 'optional',
      venueName: 'optional',
      note: 'optional',
      readAt: 'optional',
      createdAt: 'required',
    });
  });

  test('the types are exactly the ones in the spec, and the database refuses any other', async (t) => {
    const rows = await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"NotificationType"))::text AS type`;
    assert.deepEqual(rows.map((row) => row.type), TYPES);

    const user = await createTestUser(t);
    await assert.rejects(
      prisma.$executeRaw`INSERT INTO "Notification" ("userId", type) VALUES (${user.id}, ${'teamDelted'}::"NotificationType")`,
      /invalid input value for enum/
    );
  });

  test('there is an index by user and id, and one by the player mentioned', async () => {
    const rows = await prisma.$queryRaw`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'Notification'`;
    const definitions = rows.map((row) => row.indexdef);
    assert.ok(definitions.some((text) => text.includes('("userId", id)')), definitions.join('\n'));
    assert.ok(definitions.some((text) => text.includes('("playerId")')), definitions.join('\n'));
  });

  test('a new update is unread', async (t) => {
    const user = await createTestUser(t);
    const update = await prisma.notification.create({ data: { userId: user.id, type: 'memberRemoved', teamName: 'Alpha FC' } });
    assert.equal(update.readAt, null);
  });

  test("the team and player it mentions needn't exist", async (t) => {
    const user = await createTestUser(t);
    const update = await prisma.notification.create({
      data: { userId: user.id, type: 'inviteDeclined', teamId: 2147483647, playerId: 2147483646 },
    });
    assert.deepEqual([update.teamId, update.playerId], [2147483647, 2147483646]);
  });

  test("deleting a user deletes their updates (the safety net) and nobody else's", async (t) => {
    const [gone, stays] = [await createTestUser(t), await createTestUser(t)];
    await prisma.notification.createMany({
      data: [
        { userId: gone.id, type: 'memberRemoved', teamName: 'Alpha FC' },
        { userId: stays.id, type: 'memberRemoved', teamName: 'Alpha FC' },
      ],
    });
    await prisma.user.delete({ where: { id: gone.id } });
    assert.equal(await prisma.notification.count({ where: { userId: gone.id } }), 0);
    assert.equal(await prisma.notification.count({ where: { userId: stays.id } }), 1);
  });

  test('the recipient must exist', async () => {
    await assert.rejects(
      prisma.notification.create({ data: { userId: 2147483647, type: 'memberRemoved' } }),
      (error) => error.code === 'P2003'
    );
  });
});
