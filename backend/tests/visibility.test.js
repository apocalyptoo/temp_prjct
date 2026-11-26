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

// A player with a full profile (phone and an area).
const playerWithProfile = (t, extra = {}) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: {
      create: { name: 'Test Player', phone: '01700000000', position: 'Forward', height: 175, weight: null, area: 'Dhanmondi 27' },
    },
    ...extra,
  });

const venueOwner = (t) =>
  createLoggedInUser(t, {
    role: 'OWNER',
    ownerProfile: {
      create: { indoorName: 'Test Arena', phone: '01800000000', address: 'Arena Street 1', area: 'Banani', description: 'test', website: 'https://example.com', approvedAt: new Date() },
    },
  });

// captain + accepted teammate + pending (invited, not accepted) member, all with profiles.
async function teamWithMembers(t) {
  const captain = await playerWithProfile(t);
  const teammate = await playerWithProfile(t);
  const pending = await playerWithProfile(t);
  const team = await (await postJson('/teams/create', { name: 'Test Team' }, captain.jwt)).json();
  await prisma.teamMember.create({
    data: { teamId: team.id, userId: teammate.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
  });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: pending.user.id, status: 'pending', origin: 'invite' } });
  return { captain, teammate, pending, team };
}

describe('Other users never see email or phone', () => {
  test('GET /players: other players have no email or phone, but their area is public', async (t) => {
    const player = await playerWithProfile(t);
    const stranger = await playerWithProfile(t);

    const list = (await get('/players?search=Test+Player&limit=50', stranger.jwt)).items;
    const entry = list.find((p) => p.id === player.user.id);

    assert.ok(entry, 'the player should be listed');
    assert.equal(entry.name, 'Test Player');
    for (const hidden of ['email', 'phone']) assert.equal(hidden in entry, false, `${hidden} must be hidden`);
    assert.equal(entry.playerProfile.area, 'Dhanmondi 27', 'Area is public (PRODUCT.md, "Profile visibility")');
    assert.equal('phone' in entry.playerProfile, false);
  });

  test('GET /teams/me: members other than yourself have no email or phone; their area shows', async (t) => {
    const { teammate, team } = await teamWithMembers(t);

    for (const path of ['/teams/me']) {
      const teams = await get(path, teammate.jwt);
      const found = teams.find((tm) => tm.id === team.id);
      assert.ok(found, `${path} should include the team`);
      for (const member of found.members) {
        if (member.userId === teammate.user.id) continue; // your own entry may show your email
        for (const hidden of ['email', 'phone']) {
          assert.equal(hidden in member.user, false, `${path}: another member's ${hidden} must be hidden`);
        }
        assert.equal('phone' in member.user.playerProfile, false, `${path}: no phone in the profile either`);
        assert.equal(member.user.playerProfile.area, 'Dhanmondi 27', `${path}: the area is public`);
      }
    }
  });

  test("GET /notifications: the inviting captain's email is hidden", async (t) => {
    const { pending } = await teamWithMembers(t);

    const { invites } = (await get('/notifications', pending.jwt)).needsAction;

    assert.ok(invites.length >= 1);
    for (const invite of invites) assert.equal('email' in invite.team.captain, false);
  });

  test("GET /owners: venue listings are public, but the owner's login email is hidden", async (t) => {
    const owner = await venueOwner(t);
    const viewer = await playerWithProfile(t);

    const venues = (await get('/owners?search=Test+Arena&limit=50', viewer.jwt)).items;
    const venue = venues.find((v) => v.userId === owner.user.id);

    assert.ok(venue, 'the venue should be listed');
    assert.equal('email' in venue, false, "the owner's login email must be hidden");
    assert.deepEqual(
      { indoorName: venue.indoorName, phone: venue.phone, address: venue.address, website: venue.website, description: venue.description },
      { indoorName: 'Test Arena', phone: '01800000000', address: 'Arena Street 1', website: 'https://example.com', description: 'test' },
      'the business listing itself stays public'
    );
  });

  test('GET /players/:id: a stranger gets the public profile, nothing private', async (t) => {
    const player = await playerWithProfile(t);
    const viewer = await playerWithProfile(t);

    const seen = await get(`/players/${player.user.id}`, viewer.jwt);

    assert.deepEqual(Object.keys(seen).sort(), ['createdAt', 'id', 'inviteOptions', 'name', 'playerProfile', 'role', 'teams']);
    // height is set, weight isn't; no phone for a stranger, and never the email.
    assert.deepEqual(seen.playerProfile, { name: 'Test Player', position: 'Forward', height: 175, area: 'Dhanmondi 27' });
  });
});

describe('Yourself and the admin see everything', () => {
  test('GET /players/me shows your own email, phone and area', async (t) => {
    const player = await playerWithProfile(t);

    const me = await get('/players/me', player.jwt);

    assert.equal(me.email, player.user.email);
    assert.equal(me.playerProfile.phone, '01700000000');
    assert.equal(me.playerProfile.area, 'Dhanmondi 27');
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

describe('A join request message is seen only by the captain, the requester and the admin', () => {
  test('every team and player endpoint, for every kind of viewer', async (t) => {
    const { captain, teammate, pending, team } = await teamWithMembers(t);
    const requester = await playerWithProfile(t);
    const outsider = await playerWithProfile(t);
    const owner = await venueOwner(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const MESSAGE = 'Secret note for the captain';
    assert.equal((await postJson(`/teams/${team.id}/requests`, { message: MESSAGE }, requester.jwt)).status, 201);

    // Who may see it, and where.
    const asCaptain = await get(`/teams/${team.id}`, captain.jwt);
    const asAdmin = await get(`/teams/${team.id}`, admin.jwt);
    const asRequester = await get(`/teams/${team.id}`, requester.jwt);
    const ownList = await get('/players/requests', requester.jwt);
    assert.equal(asCaptain.joinRequests[0].message, MESSAGE);
    assert.equal(asAdmin.joinRequests[0].message, MESSAGE);
    assert.equal(asRequester.myRequest.message, MESSAGE);
    assert.equal(ownList[0].message, MESSAGE);

    // Everywhere else, for everyone else (and in the team lists, even for the captain).
    const elsewhere = [];
    for (const viewer of [teammate, pending, outsider, owner]) {
      elsewhere.push(await get(`/teams/${team.id}`, viewer.jwt), await get('/teams', viewer.jwt));
    }
    for (const viewer of [captain, teammate, requester]) {
      elsewhere.push(await get('/teams', viewer.jwt), await get('/teams/me', viewer.jwt));
    }
    elsewhere.push(await get('/notifications', pending.jwt), await get('/players', outsider.jwt), await get('/admin/teams', admin.jwt));
    assert.doesNotMatch(JSON.stringify(elsewhere), new RegExp(MESSAGE));
  });
});

describe('No response ever contains passwords or tokens', () => {
  test('every data endpoint, for a player, a venue owner and an admin', async (t) => {
    // Give the users real-looking tokens so a leak would show up.
    const tokens = () => ({
      verifyToken: sha256Hex(randomToken()), verifyTokenExpires: inOneDay(),
      resetToken: sha256Hex(randomToken()), resetTokenExpires: inOneHour(),
    });
    const { captain, pending, team } = await teamWithMembers(t);
    await prisma.user.updateMany({ where: { id: { in: [captain.user.id, pending.user.id] } }, data: tokens() });
    const owner = await venueOwner(t);
    const admin = await createLoggedInUser(t, { role: 'ADMIN', ...tokens() });

    const responses = [
      await get('/players', captain.jwt),
      await get('/players/me', captain.jwt),
      await get(`/players/${captain.user.id}`, pending.jwt),
      await get('/notifications', pending.jwt),
      await get('/teams', captain.jwt),
      await get('/teams/me', captain.jwt),
      await get(`/teams/${team.id}`, captain.jwt),
      await get(`/teams/${team.id}`, admin.jwt),
      await get('/players/requests', pending.jwt),
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
  const profile = { name: 'P', position: 'Forward', height: 180, weight: null, phone: '01700000000', area: 'Mirpur 10' };

  test('a stranger sees name, position, and height, weight and area only if set', async () => {
    const { toPublicPlayer } = await import('../src/utils/visibility.js');

    assert.deepEqual(toPublicPlayer(profile, { canSeePhone: false }), { name: 'P', position: 'Forward', height: 180, area: 'Mirpur 10' });
    assert.deepEqual(toPublicPlayer({ ...profile, area: null }), { name: 'P', position: 'Forward', height: 180 });
  });

  test('an accepted teammate also sees the phone', async () => {
    const { toPublicPlayer } = await import('../src/utils/visibility.js');

    assert.deepEqual(toPublicPlayer(profile, { canSeePhone: true }), { name: 'P', position: 'Forward', height: 180, area: 'Mirpur 10', phone: '01700000000' });
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

  test('venue listings drop the owner email, the review state and the note, but keep the business details', async () => {
    const { toPublicVenue } = await import('../src/utils/visibility.js');
    const venue = {
      userId: 1, email: 'owner@example.com', createdAt: 'x', indoorName: 'A', phone: '1', address: 'B', description: 'C', website: 'D',
      area: 'E', openingHours: 'F', pricingInfo: 'G', approvedAt: new Date(), reviewNote: 'H', missingFields: [],
    };

    assert.deepEqual(toPublicVenue(venue, { canSeeEmail: false }), {
      userId: 1, createdAt: 'x', indoorName: 'A', phone: '1', address: 'B', area: 'E', description: 'C', website: 'D', openingHours: 'F', pricingInfo: 'G',
    });
    assert.equal(toPublicVenue(venue, { canSeeEmail: true }).email, 'owner@example.com');
  });
});
