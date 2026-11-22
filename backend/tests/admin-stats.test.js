// GET /admin/stats (the admin Dashboard's counts), including pendingVenueCount, the
// "Venues waiting for review" count (docs/features/venues.md, d endpoint 9).
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, prisma, createLoggedInUser } from './helpers.js';

async function stats(jwt) {
  const res = await fetch(`${BASE_URL}/admin/stats`, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200);
  return res.json();
}

const owner = (t, live) =>
  createLoggedInUser(t, {
    role: 'OWNER',
    ownerProfile: {
      create: { indoorName: 'Stats Arena', address: 'Road 1', area: 'Banani', phone: '01712345678', approvedAt: live ? new Date() : null },
    },
  });

describe('GET /admin/stats', () => {
  test('has every count, and pendingVenueCount matches the venues without approval', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const reply = await stats(admin.jwt);
    for (const field of ['userCount', 'teamCount', 'playerCount', 'ownerCount', 'adminCount', 'pendingVenueCount']) {
      assert.equal(typeof reply[field], 'number', field);
    }
    assert.equal(reply.pendingVenueCount, await prisma.ownerProfile.count({ where: { approvedAt: null } }));
  });

  test('a new pending venue adds one; a live one adds none; approving takes it off', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const before = (await stats(admin.jwt)).pendingVenueCount;
    const pending = await owner(t, false);
    await owner(t, true);
    assert.equal((await stats(admin.jwt)).pendingVenueCount, before + 1);

    const res = await fetch(`${BASE_URL}/admin/indoors/${pending.user.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.jwt}` },
    });
    assert.equal(res.status, 200);
    assert.equal((await stats(admin.jwt)).pendingVenueCount, before);
  });
});
