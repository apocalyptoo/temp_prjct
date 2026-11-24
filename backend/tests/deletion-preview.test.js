// Tests for the deletion previews: what deleting an account would do to its teams and
// its venue listing (docs/features/account-deletion.md, d.4). The plan behind them is
// tested in deletion-plan.test.js.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createTestUser } from './helpers.js';

const getJson = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
};

const playerProfile = (name) => ({ create: { name, phone: '01712345678', position: 'Any' } });
const day = (n) => new Date(Date.UTC(2026, 0, n));

// A team with the captain and these other members, accepted in this order.
const teamOf = (captain, name, members = []) =>
  prisma.team.create({
    data: {
      name,
      captainId: captain.id,
      members: {
        create: [captain, ...members].map((user, index) => ({
          userId: user.id,
          status: 'accepted',
          origin: index === 0 ? 'creator' : 'invite',
          acceptedAt: day(index + 1),
        })),
      },
    },
  });

// A captain with a team to hand over, a team to delete, a team they only play in, and
// one pending request. Returns the preview reply it should give, without its code.
async function setUpCaptain(t, captain) {
  const mate = await createTestUser(t, { verified: true, playerProfile: playerProfile('Rahim') });
  const third = await createTestUser(t, { verified: true, playerProfile: playerProfile('Tanvir') });
  const kept = await teamOf(captain, 'Dhanmondi Strikers', [mate, third]);
  const solo = await teamOf(captain, 'Mirpur Mavericks');
  const other = await teamOf(mate, 'Gulshan FC', [captain]);
  const asked = await teamOf(third, 'Banani Boys');
  await prisma.teamMember.create({ data: { teamId: asked.id, userId: captain.id, status: 'pending', origin: 'request' } });
  return {
    mate,
    expected: {
      captainedTeams: [
        { id: solo.id, name: 'Mirpur Mavericks', outcome: 'delete' },
        { id: kept.id, name: 'Dhanmondi Strikers', outcome: 'handover', newCaptain: { id: mate.id, name: 'Rahim' } },
      ],
      otherTeams: [{ id: other.id, name: 'Gulshan FC' }],
      pendingCount: 1,
      venue: null,
    },
  };
}

const ownerProfile = { create: { indoorName: 'Arena 71', phone: '01712345678', approvedAt: day(1) } };

function assertPreview({ status, body }, expected) {
  assert.equal(status, 200);
  const { previewCode, ...rest } = body;
  assert.match(previewCode, /^[0-9a-f]{64}$/);
  // Exactly these fields: no email or phone of anybody, and no secrets.
  assert.deepEqual(rest, expected);
}

describe("The admin's deletion previews", () => {
  test("a captain's teams, and the rest of what goes", async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const captain = await createTestUser(t, { verified: true, playerProfile: playerProfile('Captain') });
    const { expected } = await setUpCaptain(t, captain);

    assertPreview(await getJson(`/admin/users/${captain.id}/deletion-preview`, admin.jwt), expected);
  });

  test("a venue owner's listing, on both routes", async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const owner = await createTestUser(t, { role: 'OWNER', verified: true, ownerProfile });

    for (const route of ['/admin/users', '/admin/indoors']) {
      assertPreview(await getJson(`${route}/${owner.id}/deletion-preview`, admin.jwt), {
        captainedTeams: [],
        otherTeams: [],
        pendingCount: 0,
        venue: { name: 'Arena 71', live: true },
      });
    }
  });

  test('the same refusals as the delete routes', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const otherAdmin = await createTestUser(t, { role: 'ADMIN' });
    const player = await createTestUser(t, { playerProfile: playerProfile('Player') });
    const ask = async (path) => {
      const { status, body } = await getJson(`${path}/deletion-preview`, admin.jwt);
      return [status, body.error];
    };

    for (const badId of ['abc', '0', '-1', '1.5', '99999999999']) {
      assert.deepEqual(await ask(`/admin/users/${badId}`), [400, 'Invalid user id']);
      assert.deepEqual(await ask(`/admin/indoors/${badId}`), [400, 'Invalid venue id']);
    }
    for (const route of ['/admin/users', '/admin/indoors']) {
      assert.deepEqual(await ask(`${route}/${admin.user.id}`), [403, "You can't delete your own account from the admin screens."]);
      assert.deepEqual(await ask(`${route}/${otherAdmin.id}`), [403, "Admin accounts can't be deleted from the admin screens."]);
    }
    assert.deepEqual(await ask('/admin/users/2147483647'), [404, 'User not found']);
    assert.deepEqual(await ask('/admin/indoors/2147483647'), [404, 'Venue not found']);
    assert.deepEqual(await ask(`/admin/indoors/${player.id}`), [404, 'Venue not found']);
  });

  test('only the admin may ask', async (t) => {
    const player = await createLoggedInUser(t, { playerProfile: playerProfile('Player') });
    const victim = await createTestUser(t);

    assert.equal((await getJson(`/admin/users/${victim.id}/deletion-preview`, player.jwt)).status, 403);
    assert.equal((await getJson(`/admin/indoors/${victim.id}/deletion-preview`, player.jwt)).status, 403);
    assert.equal((await getJson(`/admin/users/${victim.id}/deletion-preview`, 'nonsense')).status, 401);
  });
});
