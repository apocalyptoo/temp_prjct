// Tests for the profiles and registration migration (docs/features/profiles-and-
// registration.md, section c): the position list, address renamed to area, the venue's
// phone and address optional, and termsAcceptedAt. These check the database itself,
// through Prisma. Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createTestUser } from './helpers.js';

// The column names of a table, straight from Postgres.
async function columnsOf(table) {
  const rows = await prisma.$queryRaw`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}`;
  return new Map(rows.map((row) => [row.column_name, row.is_nullable === 'YES']));
}

describe('The profiles and registration migration', () => {
  test('position only takes the five values of the list', async (t) => {
    const ok = await createTestUser(t, {
      playerProfile: { create: { name: 'Listed', phone: '01712345678', position: 'Midfielder' } },
    });
    const { playerProfile } = await prisma.user.findUnique({ where: { id: ok.id }, include: { playerProfile: true } });
    assert.equal(playerProfile.position, 'Midfielder');

    await assert.rejects(
      createTestUser(t, { playerProfile: { create: { name: 'Free Text', phone: '01712345678', position: 'Pivot' } } }),
      'a value outside the list is refused by the database client',
    );

    const [{ labels }] = await prisma.$queryRaw`
      SELECT array_agg(enumlabel::text ORDER BY enumsortorder) AS labels
      FROM pg_enum e JOIN pg_type ty ON ty.oid = e.enumtypid WHERE ty.typname = 'Position'`;
    assert.deepEqual(labels, ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any']);
  });

  test('PlayerProfile has an optional area and no address', async () => {
    const columns = await columnsOf('PlayerProfile');
    assert.equal(columns.get('area'), true, 'area exists and is optional');
    assert.equal(columns.has('address'), false, 'address is gone (renamed)');
  });

  test("a venue's phone and address can be empty", async (t) => {
    const user = await createTestUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Name Only Arena' } } });
    const { ownerProfile } = await prisma.user.findUnique({ where: { id: user.id }, include: { ownerProfile: true } });
    assert.equal(ownerProfile.phone, null);
    assert.equal(ownerProfile.address, null);
  });

  test('User has an optional termsAcceptedAt, empty unless set', async (t) => {
    const columns = await columnsOf('User');
    assert.equal(columns.get('termsAcceptedAt'), true);
    const user = await createTestUser(t);
    assert.equal(user.termsAcceptedAt, null);
  });
});
