// Tests for admin delete safety: the admin routes can't delete the admin's own account
// or any ADMIN account, /admin/indoors/:id deletes only venue owners, and
// /admin/users/:id deletes only players and venue owners.
// Safety rules are in helpers.js. All users here are throwaway (including the admins).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createTestUser } from './helpers.js';

const sendDelete = (path, jwt) =>
  fetch(BASE_URL + path, { method: 'DELETE', headers: { Authorization: `Bearer ${jwt}` } });

const createLoggedInAdmin = (t) => createLoggedInUser(t, { role: 'ADMIN' });
const stillExists = async (id) => (await prisma.user.findUnique({ where: { id } })) !== null;

const createOwner = (t) =>
  createTestUser(t, {
    role: 'OWNER',
    verified: true,
    ownerProfile: { create: { indoorName: 'Safety Arena', phone: '01700000000', address: 'Test Road' } },
  });

describe('Admins are protected from the admin delete routes', () => {
  test("an admin can't delete their own account (403), on either route", async (t) => {
    const admin = await createLoggedInAdmin(t);

    for (const route of ['/admin/users', '/admin/indoors']) {
      const res = await sendDelete(`${route}/${admin.user.id}`, admin.jwt);
      assert.equal(res.status, 403, route);
      assert.equal((await res.json()).error, "You can't delete your own account from the admin screens.");
    }
    assert.ok(await stillExists(admin.user.id));
  });

  test("an admin can't delete another ADMIN account (403), on either route", async (t) => {
    const admin = await createLoggedInAdmin(t);
    const otherAdmin = await createTestUser(t, { role: 'ADMIN', verified: true });

    for (const route of ['/admin/users', '/admin/indoors']) {
      const res = await sendDelete(`${route}/${otherAdmin.id}`, admin.jwt);
      assert.equal(res.status, 403, route);
      assert.equal((await res.json()).error, "Admin accounts can't be deleted from the admin screens.");
    }
    assert.ok(await stillExists(otherAdmin.id));
  });
});

describe('/admin/indoors/:id deletes only venue owners', () => {
  test('a player id gets 404 "Venue not found" and the player is kept', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const player = await createTestUser(t, { verified: true });

    const res = await sendDelete(`/admin/indoors/${player.id}`, admin.jwt);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Venue not found');
    assert.ok(await stillExists(player.id));
  });

  test('an unknown id gets 404 "Venue not found"', async (t) => {
    const admin = await createLoggedInAdmin(t);

    const res = await sendDelete('/admin/indoors/2147483647', admin.jwt);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Venue not found');
  });

  test('a venue owner is deleted', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const owner = await createOwner(t);

    const res = await sendDelete(`/admin/indoors/${owner.id}`, admin.jwt);

    assert.equal(res.status, 200);
    assert.equal(await stillExists(owner.id), false);
  });
});

describe('/admin/users/:id deletes players and venue owners', () => {
  test('a player and a venue owner are both deleted', async (t) => {
    const admin = await createLoggedInAdmin(t);
    const player = await createTestUser(t, { verified: true });
    const owner = await createOwner(t);

    assert.equal((await sendDelete(`/admin/users/${player.id}`, admin.jwt)).status, 200);
    assert.equal((await sendDelete(`/admin/users/${owner.id}`, admin.jwt)).status, 200);
    assert.equal(await stillExists(player.id), false);
    assert.equal(await stillExists(owner.id), false);
  });
});
