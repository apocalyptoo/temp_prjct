// Race tests for updates (docs/features/notifications.md, d.3 and h): whatever happens at
// the same moment, nobody keeps more than 50 updates, and no two actions end up waiting
// for each other. Checked by hand on 2026-11-26: the first group fails without the user
// lock in createUpdates. (Without only its ORDER BY nothing fails here, because Postgres
// happens to visit these few rows in id order; the ORDER BY makes that certain.)
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';
import { MAX_UPDATES, createUpdates, teamUpdate } from '../src/utils/notifications.js';

const ROUNDS = 12;
const NOBODY = 2147483001;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const removed = (user, name) => teamUpdate('memberRemoved', user.id, { id: 2147483000, name });
const countOf = (user) => prisma.notification.count({ where: { userId: user.id } });
const fill = (user) =>
  prisma.notification.createMany({ data: Array.from({ length: MAX_UPDATES }, () => removed(user, 'Old')) });

describe('Two actions telling the same person at once', () => {
  test('exactly 50 stay: the second waits until the first is finished (P18)', async (t) => {
    const user = await createTestUser(t);
    await fill(user);

    const first = prisma.$transaction(async (tx) => {
      await createUpdates(tx, [removed(user, 'First')], { actorId: NOBODY });
      await sleep(300); // still not committed while the second one runs
    });
    await sleep(100);
    const second = prisma.$transaction((tx) => createUpdates(tx, [removed(user, 'Second')], { actorId: NOBODY }));
    await Promise.all([first, second]);

    assert.equal(await countOf(user), 50);
    const newest = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 2 });
    assert.deepEqual(newest.map((update) => update.teamName), ['Second', 'First'], 'the newest has the highest id');
  });

  test(`exactly 50 stay, five at once, ${ROUNDS} rounds`, async (t) => {
    const user = await createTestUser(t);
    await fill(user);
    for (let round = 1; round <= ROUNDS; round += 1) {
      await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          prisma.$transaction((tx) => createUpdates(tx, [removed(user, `Round ${round}.${index}`)], { actorId: NOBODY }))
        )
      );
      assert.equal(await countOf(user), 50, `round ${round}`);
    }
  });

  test(`two actions telling the same people in the opposite order never deadlock, ${ROUNDS} rounds`, async (t) => {
    const people = [await createTestUser(t), await createTestUser(t), await createTestUser(t)];
    for (const person of people) await fill(person);
    const tell = (list, name) =>
      prisma.$transaction((tx) => createUpdates(tx, list.map((person) => removed(person, name)), { actorId: NOBODY }));
    for (let round = 1; round <= ROUNDS; round += 1) {
      await Promise.all([tell(people, 'A'), tell([...people].reverse(), 'B'), tell(people, 'C'), tell([...people].reverse(), 'D')]);
      for (const person of people) assert.equal(await countOf(person), 50, `round ${round}`);
    }
  });
});
