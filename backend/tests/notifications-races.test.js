// Race tests for updates (docs/features/notifications.md, d.3 and h): whatever happens at
// the same moment, nobody keeps more than 50 updates, and no two actions end up waiting
// for each other. Checked by hand on 2026-11-26: the first group fails without the user
// lock in createUpdates, and the venue group without the owner lock in withLockedOwner
// (adminController.js). (Without only its ORDER BY nothing fails here, because Postgres
// happens to visit these few rows in id order; the ORDER BY makes that certain.)
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createTestUser, createLoggedInPlayer, createLoggedInUser } from './helpers.js';
import { deleteUserAndData } from '../src/utils/deletion.js';
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

const call = async (method, path, jwt) =>
  (await fetch(BASE_URL + path, { method, headers: { Authorization: `Bearer ${jwt}` } })).status;

// A team in the database: the first person is captain, everyone is an accepted member.
const teamOf = (name, ...people) =>
  prisma.team.create({
    data: {
      name,
      captainId: people[0].id,
      members: {
        create: people.map((user, index) => ({
          userId: user.id,
          status: 'accepted',
          origin: index === 0 ? 'creator' : 'invite',
          acceptedAt: new Date(Date.UTC(2026, 0, index + 1)),
        })),
      },
    },
  });
const player = (t) =>
  createTestUser(t, { verified: true, playerProfile: { create: { name: 'Race', phone: '01712345678', position: 'Any' } } });
// 50 updates for `user` that name `mentioned`.
const fillNaming = (user, mentioned) =>
  prisma.notification.createMany({
    data: Array.from({ length: MAX_UPDATES }, () =>
      teamUpdate('memberLeft', user.id, { id: 2147483000, name: 'Old FC' }, { id: mentioned.id, name: 'Race' })
    ),
  });

describe('Deletions at the same moment as other actions', () => {
  test(`two teams with the same members are deleted at once, ${ROUNDS} rounds`, async (t) => {
    const [one, two] = [await createLoggedInPlayer(t), await createLoggedInPlayer(t)];
    const shared = [await player(t), await player(t), await player(t)];
    for (const person of shared) await fill(person);
    for (let round = 1; round <= ROUNDS; round += 1) {
      const first = await teamOf('First FC', one.user, ...shared);
      const second = await teamOf('Second FC', two.user, ...[...shared].reverse());
      const statuses = await Promise.all([
        call('DELETE', `/teams/${first.id}`, one.jwt),
        call('DELETE', `/teams/${second.id}`, two.jwt),
      ]);
      assert.deepEqual(statuses, [200, 200], `round ${round}`);
      for (const person of shared) {
        assert.equal(await countOf(person), 50, `round ${round}`);
        const newest = await prisma.notification.findMany({ where: { userId: person.id }, orderBy: { id: 'desc' }, take: 2 });
        assert.deepEqual(newest.map((update) => update.teamId).sort((a, b) => a - b), [first.id, second.id]);
      }
    }
  });

  test(`an account named in many full lists is deleted while those people get new updates, ${ROUNDS} rounds`, async (t) => {
    const captain = await createLoggedInPlayer(t);
    const [a, b] = [await player(t), await player(t)];
    for (let round = 1; round <= ROUNDS; round += 1) {
      // a and b keep 50 updates each, all naming the leaver, so the actions below want to
      // remove the very rows the deletion is removing.
      const leaver = await player(t);
      await prisma.notification.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await fillNaming(a, leaver);
      await fillNaming(b, leaver);
      await teamOf('Other FC', a, leaver); // a also hears that a member left
      const teams = [
        await teamOf('One FC', captain.user, a, b),
        await teamOf('Two FC', captain.user, b, a),
        await teamOf('Three FC', captain.user, a, b),
      ];

      const [deletion, ...statuses] = await Promise.all([
        deleteUserAndData(prisma, leaver.id),
        ...teams.map((team) => call('DELETE', `/teams/${team.id}`, captain.jwt)),
      ]);
      assert.equal(deletion.status, 'deleted', `round ${round}`);
      assert.deepEqual(statuses, [200, 200, 200], `round ${round}`);
      assert.equal(await prisma.notification.count({ where: { playerId: leaver.id } }), 0, 'no update names them');
      assert.equal(await countOf(a), 4, 'three teams deleted and one member left');
      assert.equal(await countOf(b), 3);
      await prisma.team.deleteMany({ where: { captainId: a.id } });
    }
  });

  test(`two people who name each other delete their accounts at once, ${ROUNDS} rounds`, async (t) => {
    for (let round = 1; round <= ROUNDS; round += 1) {
      const [a, b, c] = [await player(t), await player(t), await player(t)];
      await fillNaming(a, b);
      await fillNaming(b, a);
      await fillNaming(c, a);
      await teamOf('A FC', a, b, c);
      await teamOf('B FC', b, a, c);
      const results = await Promise.all([deleteUserAndData(prisma, a.id), deleteUserAndData(prisma, b.id)]);
      assert.deepEqual(results.map((result) => result.status), ['deleted', 'deleted'], `round ${round}`);
      const left = await prisma.notification.findMany({ where: { userId: c.id } });
      assert.ok(left.length > 0 && left.every((update) => update.playerId === null), 'only updates without a name are left');
    }
  });
});

describe('The admin reviews a venue while its owner deletes the account (P20)', () => {
  const ACTIONS = [
    ['approve', undefined, false],
    ['move-to-review', { note: 'Closed for repairs' }, true],
  ];
  const venueOwner = (t, live) =>
    createTestUser(t, {
      role: 'OWNER',
      verified: true,
      ownerProfile: {
        create: {
          indoorName: 'Race Arena',
          address: 'Road 5',
          area: 'Mirpur',
          phone: '01712345678',
          approvedAt: live ? new Date() : null,
        },
      },
    });
  const review = async (admin, owner, action, body) => {
    const res = await fetch(`${BASE_URL}/admin/indoors/${owner.id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return { status: res.status, body: await res.json() };
  };

  // The real Prisma client, except that `between` runs inside the deletion's transaction
  // once it holds the owner's row, just before it deletes the venue.
  const bindAll = (obj, override) =>
    new Proxy(obj, {
      get(target, prop) {
        if (prop in override) return override[prop];
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  const pausedBeforeTheVenue = (between) => ({
    $transaction: (work, options) =>
      prisma.$transaction((tx) => {
        const deleteMany = async (...args) => {
          await between();
          return tx.ownerProfile.deleteMany(...args);
        };
        return work(bindAll(tx, { ownerProfile: bindAll(tx.ownerProfile, { deleteMany }) }));
      }, options),
  });

  for (const [action, body, live] of ACTIONS) {
    test(`${action} in the middle of the deletion waits, then finds nobody`, async (t) => {
      const admin = await createLoggedInUser(t, { role: 'ADMIN' });
      const owner = await venueOwner(t, live);
      let reply;
      const result = await deleteUserAndData(
        pausedBeforeTheVenue(async () => {
          reply = review(admin, owner, action, body);
          await sleep(300);
        }),
        owner.id
      );
      assert.equal(result.status, 'deleted');
      assert.deepEqual(await reply, { status: 404, body: { error: 'Venue not found' } });
      assert.equal(await prisma.notification.count({ where: { userId: owner.id } }), 0);
    });

    test(`${action} and the deletion at the same moment, ${ROUNDS} rounds: no server error`, async (t) => {
      const admin = await createLoggedInUser(t, { role: 'ADMIN' });
      for (let round = 1; round <= ROUNDS; round += 1) {
        const owner = await venueOwner(t, live);
        const [deletion, reply] = await Promise.all([
          sleep(round).then(() => deleteUserAndData(prisma, owner.id)),
          review(admin, owner, action, body),
        ]);
        assert.equal(deletion.status, 'deleted', `round ${round}`);
        assert.ok([200, 404].includes(reply.status), `round ${round}: ${reply.status}`);
        assert.equal(await prisma.notification.count({ where: { userId: owner.id } }), 0);
      }
    });
  }
});
