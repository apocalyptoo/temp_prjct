// Tests for the venues migration (docs/features/venues.md, section c): the new venue
// fields, approval stored as approvedAt (null = "Pending review"), the admin's note, and
// the index. These check the database itself, through Prisma. Safety rules are in
// helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';

// The column names of a table, straight from Postgres, with whether each may be empty.
async function columnsOf(table) {
  const rows = await prisma.$queryRaw`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}`;
  return new Map(rows.map((row) => [row.column_name, row.is_nullable === 'YES']));
}

describe('The venues migration', () => {
  test('OwnerProfile has the five new optional columns', async () => {
    const columns = await columnsOf('OwnerProfile');
    for (const name of ['area', 'openingHours', 'pricingInfo', 'approvedAt', 'reviewNote']) {
      assert.equal(columns.get(name), true, `${name} exists and is optional`);
    }
  });

  test('a new venue starts pending: no approval date, no note, no new fields', async (t) => {
    const user = await createTestUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Brand New Arena' } } });
    const { ownerProfile } = await prisma.user.findUnique({ where: { id: user.id }, include: { ownerProfile: true } });
    assert.deepEqual(
      [ownerProfile.approvedAt, ownerProfile.reviewNote, ownerProfile.area, ownerProfile.openingHours, ownerProfile.pricingInfo],
      [null, null, null, null, null],
    );
  });

  test('approvedAt has an index', async () => {
    const rows = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'OwnerProfile' AND indexdef LIKE '%"approvedAt"%'`;
    assert.equal(rows.length, 1);
  });
});
