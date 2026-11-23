// Tests for the team_area migration (docs/features/explore.md, section c): an optional
// area on teams. These check the database itself, through Prisma. Safety rules are in
// helpers.js. All users and teams here are throwaway.
//
// "Existing teams start without an area" was checked by hand right after the migration
// (2026-11-23: all 7 local teams had none). It isn't a test, because a captain may
// since have added one.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';

describe('The team_area migration', () => {
  test('Team has an optional area column', async () => {
    const rows = await prisma.$queryRaw`
      SELECT is_nullable, data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Team' AND column_name = 'area'`;
    assert.equal(rows.length, 1, 'the column exists');
    assert.equal(rows[0].is_nullable, 'YES');
    assert.equal(rows[0].data_type, 'text');
  });

  test('a team made without an area has none, and one can be stored', async (t) => {
    const captain = await createTestUser(t);
    const team = await prisma.team.create({ data: { name: 'Data Test Team', captainId: captain.id } });
    assert.equal(team.area, null);

    const updated = await prisma.team.update({ where: { id: team.id }, data: { area: 'Mirpur 10' } });
    assert.equal(updated.area, 'Mirpur 10');
  });
});
