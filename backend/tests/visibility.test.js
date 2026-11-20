// Tests for Phase 1 item 12: profile visibility on the backend (docs/PRODUCT.md,
// "Profile visibility"). Every response with user data must contain only what the
// person asking may see. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma, BASE_URL, OLD_PASSWORD, randomToken, sha256Hex, inOneDay, inOneHour,
  createLoggedInUser, postJson,
} from './helpers.js';

const SECRET_KEYS = ['password', 'verifyToken', 'verifyTokenExpires', 'resetToken', 'resetTokenExpires'];

const get = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path} should succeed`);
  return res.json();
};

// Every key anywhere in a JSON value (objects inside arrays inside objects...).
function allKeys(value, keys = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      allKeys(v, keys);
    }
  }
  return keys;
}

// A player with a full profile (phone and an address that might be a home address).
const playerWithProfile = (t, extra = {}) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: {
      create: { name: 'Test Player', phone: '01700000000', position: 'Forward', height: 175, weight: null, address: '12 Private Road, Dhaka' },
    },
    ...extra,
  });

const venueOwner = (t) =>
  createLoggedInUser(t, {
    role: 'OWNER',
    ownerProfile: {
      create: { indoorName: 'Test Arena', phone: '01800000000', address: 'Arena Street 1', description: 'test', website: 'https://example.com' },
    },
  });

// captain + accepted teammate + pending (invited, not accepted) member, all with profiles.
async function teamWithMembers(t) {
  const captain = await playerWithProfile(t);
  const teammate = await playerWithProfile(t);
  const pending = await playerWithProfile(t);
  const team = await (await postJson('/teams/create', { name: 'Test Team' }, captain.jwt)).json();
  await prisma.teamMember.create({ data: { teamId: team.id, userId: teammate.user.id, status: 'accepted' } });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: pending.user.id, status: 'pending' } });
  return { captain, teammate, pending, team };
}

describe('Other users never see email, phone or address', () => {
  test('GET /players: other players have no email, phone or address', async (t) => {
    const player = await playerWithProfile(t);
    const stranger = await playerWithProfile(t);

    const list = await get('/players', stranger.jwt);
    const entry = list.find((p) => p.id === player.user.id);

    assert.ok(entry, 'the player should be listed');
    assert.equal(entry.name, 'Test Player');
    for (const hidden of ['email', 'phone', 'address']) assert.equal(hidden in entry, false, `${hidden} must be hidden`);
  });

  test('GET /teams and /teams/me: members other than yourself have no email', async (t) => {
    const { teammate, team } = await teamWithMembers(t);

    for (const path of ['/teams', '/teams/me']) {
      const teams = await get(path, teammate.jwt);
      const found = teams.find((tm) => tm.id === team.id);
      assert.ok(found, `${path} should include the team`);
      for (const member of found.members) {
        if (member.userId === teammate.user.id) continue; // your own entry may show your email
        for (const hidden of ['email', 'phone', 'address']) {
          assert.equal(hidden in member.user, false, `${path}: another member's ${hidden} must be hidden`);
        }
      }
    }
  });

  test("GET /players/invites: the inviting captain's email is hidden", async (t) => {
    const { pending } = await teamWithMembers(t);

    const invites = await get('/players/invites', pending.jwt);

    assert.ok(invites.length >= 1);
    for (const invite of invites) assert.equal('email' in invite.team.captain, false);
  });

  test("GET /owners: venue listings are public, but the owner's login email is hidden", async (t) => {
    const owner = await venueOwner(t);
    const viewer = await playerWithProfile(t);

    const venues = await get('/owners', viewer.jwt);
    const venue = venues.find((v) => v.userId === owner.user.id);

    assert.ok(venue, 'the venue should be listed');
    assert.equal('email' in venue, false, "the owner's login email must be hidden");
    assert.deepEqual(
      { indoorName: venue.indoorName, phone: venue.phone, address: venue.address, website: venue.website, description: venue.description },
      { indoorName: 'Test Arena', phone: '01800000000', address: 'Arena Street 1', website: 'https://example.com', description: 'test' },
      'the business listing itself stays public'
    );
  });

  test('GET /players/:id returns only the stats, nothing private', async (t) => {
    const player = await playerWithProfile(t);
    const viewer = await playerWithProfile(t);

    const stats = await get(`/players/${player.user.id}`, viewer.jwt);

    assert.deepEqual(Object.keys(stats).sort(), ['joinedAt', 'totalTeams']);
  });
});

describe('Yourself and the admin see everything', () => {
  test('GET /players/me shows your own email, phone and address', async (t) => {
    const player = await playerWithProfile(t);

    const me = await get('/players/me', player.jwt);

    assert.equal(me.email, player.user.email);
    assert.equal(me.playerProfile.phone, '01700000000');
    assert.equal(me.playerProfile.address, '12 Private Road, Dhaka');
  });

  test('admin routes still return emails and venue details', async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const owner = await venueOwner(t);

    const users = await get('/admin/users', admin.jwt);
    const indoors = await get('/admin/indoors', admin.jwt);

    assert.equal(users.find((u) => u.id === owner.user.id)?.email, owner.user.email);
    const venue = indoors.find((v) => v.userId === owner.user.id);
    assert.equal(venue.email, owner.user.email);
    assert.equal(venue.phone, '01800000000');
  });
});

describe('No response ever contains passwords or tokens', () => {
  test('every data endpoint, for a player, a venue owner and an admin', async (t) => {
    // Give the users real-looking tokens so a leak would show up.
    const tokens = () => ({
      verifyToken: sha256Hex(randomToken()), verifyTokenExpires: inOneDay(),
      resetToken: sha256Hex(randomToken()), resetTokenExpires: inOneHour(),
    });
    const { captain, pending } = await teamWithMembers(t);
    await prisma.user.updateMany({ where: { id: { in: [captain.user.id, pending.user.id] } }, data: tokens() });
    const owner = await venueOwner(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN', ...tokens() });

    const responses = [
      await get('/players', captain.jwt),
      await get('/players/me', captain.jwt),
      await get(`/players/${captain.user.id}`, pending.jwt),
      await get('/players/invites', pending.jwt),
      await get('/teams', captain.jwt),
      await get('/teams/me', captain.jwt),
      await get('/owners', captain.jwt),
      await get('/owners/me', owner.jwt),
      await get('/admin/users', admin.jwt),
      await get('/admin/teams', admin.jwt),
      await get('/admin/indoors', admin.jwt),
      await (await postJson('/auth/login', { email: captain.user.email, password: OLD_PASSWORD })).json(),
    ];

    const keys = allKeys(responses);
    for (const secret of SECRET_KEYS) assert.equal(keys.has(secret), false, `"${secret}" must never be sent`);
  });
});

describe('The visibility rules (src/utils/visibility.js)', () => {
  const profile = { name: 'P', position: 'Forward', height: 180, weight: null, phone: '01700000000', address: 'Home 1' };

  test('a stranger sees name, position, and height/weight only if set', async () => {
    const { toPublicPlayer } = await import('../src/utils/visibility.js');

    assert.deepEqual(toPublicPlayer(profile, { canSeePhone: false }), { name: 'P', position: 'Forward', height: 180 });
  });

  test('an accepted teammate also sees the phone, but never the address', async () => {
    const { toPublicPlayer } = await import('../src/utils/visibility.js');

    assert.deepEqual(toPublicPlayer(profile, { canSeePhone: true }), { name: 'P', position: 'Forward', height: 180, phone: '01700000000' });
  });

  test('teammates are only people in the same team with both memberships accepted', async (t) => {
    const { findAcceptedTeammateIds } = await import('../src/utils/visibility.js');
    const { captain, teammate, pending } = await teamWithMembers(t);

    const ofTeammate = await findAcceptedTeammateIds(prisma, teammate.user.id);
    const ofPending = await findAcceptedTeammateIds(prisma, pending.user.id);

    assert.ok(ofTeammate.has(captain.user.id), 'an accepted member is a teammate of the captain');
    assert.equal(ofTeammate.has(pending.user.id), false, 'a pending member is not a teammate');
    assert.equal(ofTeammate.has(teammate.user.id), false, 'you are not your own teammate');
    assert.equal(ofPending.size, 0, 'a pending member has no teammates, so sees no phone numbers');
  });

  test('venue listings drop the owner email for others but keep the business details', async () => {
    const { toPublicVenue } = await import('../src/utils/visibility.js');
    const venue = { userId: 1, email: 'owner@example.com', createdAt: 'x', indoorName: 'A', phone: '1', address: 'B', description: 'C', website: 'D' };

    assert.deepEqual(toPublicVenue(venue, { canSeeEmail: false }), {
      userId: 1, createdAt: 'x', indoorName: 'A', phone: '1', address: 'B', description: 'C', website: 'D',
    });
    assert.equal(toPublicVenue(venue, { canSeeEmail: true }).email, 'owner@example.com');
  });
});
