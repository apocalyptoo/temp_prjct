// Tests for what deleting an account would do (planAccountDeletion and previewCodeFor in
// src/utils/deletion.js) and for lockTeams (src/utils/membership.js), called directly
// (docs/features/account-deletion.md, d.2). The preview endpoints have their own tests.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';
import { planAccountDeletion, previewCodeFor } from '../src/utils/deletion.js';
import { inMemberOrder, lockTeams } from '../src/utils/membership.js';

const player = (t, name) =>
  createTestUser(t, {
    verified: true,
    playerProfile: { create: { name, phone: '01712345678', position: 'Any' } },
  });

const day = (n) => new Date(Date.UTC(2026, 0, n));

// A team with its captain accepted on day 1. `rows` are more membership rows:
// { user, accepted: <day number> } or { user, origin: 'invite' | 'request' } (pending).
const teamOf = (captain, name, rows = []) =>
  prisma.team.create({
    data: {
      name,
      captainId: captain.id,
      members: {
        create: [
          { userId: captain.id, status: 'accepted', origin: 'creator', acceptedAt: day(1) },
          ...rows.map(({ user, accepted, origin = 'invite' }) =>
            accepted
              ? { userId: user.id, status: 'accepted', origin, acceptedAt: day(accepted) }
              : { userId: user.id, status: 'pending', origin }
          ),
        ],
      },
    },
  });

const codeFor = async (user) => previewCodeFor(await planAccountDeletion(prisma, user.id));

describe('The deletion plan (planAccountDeletion)', () => {
  test('an unknown id has no plan', async () => {
    assert.equal(await planAccountDeletion(prisma, 2147483647), null);
  });

  test('a player with no teams: nothing but the account', async (t) => {
    const user = await player(t, 'Karim');

    assert.deepEqual(await planAccountDeletion(prisma, user.id), {
      user: { id: user.id, role: 'PLAYER', email: user.email, displayName: 'Karim', verified: true },
      captainedTeams: [],
      otherTeams: [],
      pendingCount: 0,
      venue: null,
    });
  });

  test('a captained team goes to the longest-standing other member', async (t) => {
    const captain = await player(t, 'Captain');
    const newer = await player(t, 'Newer');
    const older = await player(t, 'Older');
    const team = await teamOf(captain, 'Handover FC', [
      { user: newer, accepted: 9 },
      { user: older, accepted: 5 },
    ]);

    const plan = await planAccountDeletion(prisma, captain.id);

    assert.deepEqual(plan.captainedTeams, [
      { id: team.id, name: 'Handover FC', outcome: 'handover', newCaptain: { id: older.id, name: 'Older' } },
    ]);
  });

  test('when two members joined at the same moment, the lower membership id goes first', async (t) => {
    const captain = await player(t, 'Captain');
    const first = await player(t, 'First');
    const second = await player(t, 'Second');
    const team = await teamOf(captain, 'Tie FC');
    // The second user gets the lower membership id.
    for (const user of [second, first]) {
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, status: 'accepted', origin: 'invite', acceptedAt: day(3) },
      });
    }

    const plan = await planAccountDeletion(prisma, captain.id);

    assert.equal(plan.captainedTeams[0].newCaptain.id, second.id);
  });

  test('pending invites and requests never become captain: the team is deleted', async (t) => {
    const captain = await player(t, 'Captain');
    const team = await teamOf(captain, 'Solo FC', [
      { user: await player(t, 'Invited'), origin: 'invite' },
      { user: await player(t, 'Asked'), origin: 'request' },
    ]);

    const plan = await planAccountDeletion(prisma, captain.id);

    assert.deepEqual(plan.captainedTeams, [{ id: team.id, name: 'Solo FC', outcome: 'delete' }]);
  });

  test('teams to be deleted come first, then by name ignoring case; other teams and pending rows are listed apart', async (t) => {
    const user = await player(t, 'Busy');
    const mate = await player(t, 'Mate');
    await teamOf(user, 'alpha kept', [{ user: mate, accepted: 2 }]);
    await teamOf(user, 'Zeta gone');
    await teamOf(user, 'Beta kept', [{ user: mate, accepted: 2 }]);
    await teamOf(user, 'gamma gone');
    const member = await teamOf(mate, 'Member FC', [{ user, accepted: 4 }]);
    await teamOf(mate, 'Invited FC', [{ user, origin: 'invite' }]);
    await teamOf(mate, 'Asked FC', [{ user, origin: 'request' }]);

    const plan = await planAccountDeletion(prisma, user.id);

    assert.deepEqual(
      plan.captainedTeams.map((team) => `${team.name}: ${team.outcome}`),
      ['gamma gone: delete', 'Zeta gone: delete', 'alpha kept: handover', 'Beta kept: handover']
    );
    assert.deepEqual(plan.otherTeams, [{ id: member.id, name: 'Member FC' }]);
    assert.equal(plan.pendingCount, 2);
  });

  test("a venue owner's listing, live or waiting for review", async (t) => {
    const ownerProfile = { indoorName: 'Arena 71', phone: '01712345678', address: 'Road 1', area: 'Mirpur' };
    const live = await createTestUser(t, { role: 'OWNER', ownerProfile: { create: { ...ownerProfile, approvedAt: day(1) } } });
    const pending = await createTestUser(t, { role: 'OWNER', ownerProfile: { create: ownerProfile } });

    assert.deepEqual((await planAccountDeletion(prisma, live.id)).venue, { name: 'Arena 71', live: true });
    const plan = await planAccountDeletion(prisma, pending.id);
    assert.deepEqual(plan.venue, { name: 'Arena 71', live: false });
    assert.equal(plan.user.displayName, 'Arena 71');
    assert.equal(plan.user.verified, false);
  });

  test('changes nothing', async (t) => {
    const captain = await player(t, 'Captain');
    const mate = await player(t, 'Mate');
    const team = await teamOf(captain, 'Untouched FC', [{ user: mate, accepted: 2 }]);

    await planAccountDeletion(prisma, captain.id);

    assert.equal((await prisma.team.findUnique({ where: { id: team.id } })).captainId, captain.id);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 2);
  });
});

describe('The preview code (previewCodeFor)', () => {
  test('is 64 hex characters and stays the same while nothing changes', async (t) => {
    const captain = await player(t, 'Captain');
    await teamOf(captain, 'Same FC');

    const code = await codeFor(captain);

    assert.match(code, /^[0-9a-f]{64}$/);
    assert.equal(await codeFor(captain), code);
  });

  test('changes when a team gets another outcome, and only then', async (t) => {
    const captain = await player(t, 'Captain');
    const older = await player(t, 'Older');
    const newer = await player(t, 'Newer');
    const team = await teamOf(captain, 'AAA', [
      { user: older, accepted: 2 },
      { user: newer, accepted: 3 },
    ]);
    const second = await teamOf(captain, 'BBB', [{ user: older, accepted: 2 }]);
    const before = await codeFor(captain);

    // Not part of it: names (even one that changes the list's order), pending rows, a
    // member who isn't next in line, and teams they don't captain.
    await prisma.team.update({ where: { id: team.id }, data: { name: 'ZZZ' } });
    const invited = await player(t, 'Invited');
    await prisma.teamMember.create({ data: { teamId: team.id, userId: invited.id, status: 'pending', origin: 'invite' } });
    await prisma.teamMember.deleteMany({ where: { teamId: team.id, userId: newer.id } });
    await teamOf(older, 'Other', [{ user: captain, accepted: 2 }]);
    assert.equal(await codeFor(captain), before);

    // The next in line leaves the second team: it would now be deleted.
    await prisma.teamMember.deleteMany({ where: { teamId: second.id, userId: older.id } });
    const without = await codeFor(captain);
    assert.notEqual(without, before);

    // Somebody else joins it: a handover again, but to another player.
    await prisma.teamMember.create({
      data: { teamId: second.id, userId: newer.id, status: 'accepted', origin: 'invite', acceptedAt: day(6) },
    });
    const other = await codeFor(captain);
    assert.notEqual(other, before);
    assert.notEqual(other, without);

    // A new team of their own.
    await teamOf(captain, 'New');
    assert.notEqual(await codeFor(captain), other);
  });
});

describe('The shared order (inMemberOrder)', () => {
  test('the captain first, then the earliest acceptedAt, ties to the lower id', () => {
    const rows = [
      { id: 4, userId: 40, acceptedAt: day(2) },
      { id: 3, userId: 30, acceptedAt: day(2) },
      { id: 2, userId: 20, acceptedAt: day(1) },
      { id: 5, userId: 50, acceptedAt: day(9) },
    ];
    assert.deepEqual(inMemberOrder(rows, 50).map((row) => row.id), [5, 2, 3, 4]);
    assert.equal(rows[0].id, 4, 'the rows it was given stay as they were');
  });
});

describe('lockTeams', () => {
  test('locks the teams that exist, lowest id first, with their current name and captain', async (t) => {
    const captain = await player(t, 'Captain');
    const one = await teamOf(captain, 'One');
    const two = await teamOf(captain, 'Two');

    const locked = await prisma.$transaction((tx) => lockTeams(tx, [two.id, 2147483647, one.id]));

    assert.deepEqual(locked, [
      { id: one.id, name: 'One', captainId: captain.id },
      { id: two.id, name: 'Two', captainId: captain.id },
    ]);
    assert.deepEqual(await prisma.$transaction((tx) => lockTeams(tx, [])), []);
  });

  test('waits for another change to the team, then sees its result', async (t) => {
    const captain = await player(t, 'Captain');
    const mate = await player(t, 'Mate');
    const team = await teamOf(captain, 'Wait FC', [{ user: mate, accepted: 2 }]);

    let release;
    let isHeld;
    const held = new Promise((resolve) => { isHeld = resolve; });
    const transfer = prisma.$transaction(async (tx) => {
      await lockTeams(tx, [team.id]);
      isHeld();
      await new Promise((resolve) => { release = resolve; });
      await tx.team.update({ where: { id: team.id }, data: { captainId: mate.id } });
    });
    await held;

    let waited = true;
    const second = prisma.$transaction((tx) => lockTeams(tx, [team.id])).then((rows) => {
      waited = false;
      return rows;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(waited, true, 'the second lock waits while the first is held');
    release();
    await transfer;

    assert.deepEqual(await second, [{ id: team.id, name: 'Wait FC', captainId: mate.id }]);
  });
});
