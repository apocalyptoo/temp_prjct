// The admin's venue review (docs/features/venues.md, d endpoints 5–8): the admin list
// (pending first), approve (refused when live, when the owner is unverified, or when
// incomplete, with the missing fields), the note on a pending venue, and moving a live
// venue back to review with a note. Plus the race: an owner emptying a field and the
// admin approving at the same moment never leave an incomplete venue live.
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, prisma, createLoggedInUser, fakeClientIp } from './helpers.js';

async function send(method, path, jwt, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': fakeClientIp(),
      Authorization: `Bearer ${jwt}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const approve = (jwt, id) => send('POST', `/admin/indoors/${id}/approve`, jwt);
const setNote = (jwt, id, note) => send('PUT', `/admin/indoors/${id}/note`, jwt, { note });
const moveToReview = (jwt, id, body) => send('POST', `/admin/indoors/${id}/move-to-review`, jwt, body);

const admin = (t) => createLoggedInUser(t, { role: 'ADMIN' });

const COMPLETE = { address: 'Road 5, Dhanmondi', area: 'Dhanmondi', phone: '01712345678' };

// A venue owner: pending and complete unless told otherwise.
async function venueOwner(t, { listing = COMPLETE, live = false, note = null, verified = true, name = 'Review Arena' } = {}) {
  return createLoggedInUser(t, {
    role: 'OWNER',
    verified,
    ownerProfile: { create: { indoorName: name, ...listing, approvedAt: live ? new Date() : null, reviewNote: note } },
  });
}

// createLoggedInUser logs in, which needs a verified email; an unverified owner is made
// verified for the login, then unverified again.
async function unverifiedOwner(t, options = {}) {
  const owner = await venueOwner(t, options);
  await prisma.user.update({ where: { id: owner.user.id }, data: { verified: false } });
  return owner;
}

const stored = (userId) =>
  prisma.ownerProfile.findUnique({ where: { userId }, select: { approvedAt: true, reviewNote: true, area: true, address: true, phone: true } });

async function listedIds(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return (await res.json()).map((v) => v.userId);
}

describe('POST /admin/indoors/:id/approve', () => {
  test('a complete pending venue goes live; the note is cleared; it appears in discovery', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { note: 'Please add the road number' });
    const reply = await approve(me.jwt, owner.user.id);
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.ok(reply.body.approvedAt, 'approvedAt is set');
    assert.equal(reply.body.reviewNote, null);
    assert.deepEqual(reply.body.missingFields, []);
    const row = await stored(owner.user.id);
    assert.ok(row.approvedAt instanceof Date);
    assert.equal(row.reviewNote, null);
    assert.ok((await listedIds('/owners', owner.jwt)).includes(owner.user.id));
  });

  test('an incomplete venue: 409 with the missing fields, in order, and nothing changes', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { listing: { address: null, area: null, phone: '01712345678' } });
    const reply = await approve(me.jwt, owner.user.id);
    assert.equal(reply.status, 409);
    assert.deepEqual(reply.body, {
      error: "This venue can't go live yet. Missing: address, area",
      missingFields: ['address', 'area'],
    });
    assert.equal((await stored(owner.user.id)).approvedAt, null);
  });

  test('an unverified owner: 409, checked before completeness', async (t) => {
    const me = await admin(t);
    const owner = await unverifiedOwner(t, { listing: { address: null, area: null, phone: null } });
    const reply = await approve(me.jwt, owner.user.id);
    assert.equal(reply.status, 409);
    assert.equal(reply.body.error, "The owner hasn't verified their email yet");
    assert.equal((await stored(owner.user.id)).approvedAt, null);
  });

  test('an already live venue: 409 "This venue is already live"', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { live: true });
    const reply = await approve(me.jwt, owner.user.id);
    assert.equal(reply.status, 409);
    assert.equal(reply.body.error, 'This venue is already live');
  });

  test('bad and unknown ids, and a player instead of a venue owner', async (t) => {
    const me = await admin(t);
    const player = await createLoggedInUser(t, { role: 'PLAYER' });
    assert.deepEqual((await approve(me.jwt, 'abc')).body, { error: 'Invalid venue id' });
    for (const id of [player.user.id, 2147483646]) {
      const reply = await approve(me.jwt, id);
      assert.equal(reply.status, 404);
      assert.equal(reply.body.error, 'Venue not found');
    }
  });

  test('only the admin: a venue owner and a player get 403', async (t) => {
    const owner = await venueOwner(t);
    const player = await createLoggedInUser(t, { role: 'PLAYER' });
    for (const someone of [owner, player]) {
      assert.equal((await approve(someone.jwt, owner.user.id)).status, 403);
      assert.equal((await setNote(someone.jwt, owner.user.id, 'x')).status, 403);
      assert.equal((await moveToReview(someone.jwt, owner.user.id, { note: 'x' })).status, 403);
    }
    assert.equal((await stored(owner.user.id)).approvedAt, null);
  });
});

describe('PUT /admin/indoors/:id/note', () => {
  test('sets, replaces and clears the note on a pending venue; the owner sees it', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t);
    let reply = await setNote(me.jwt, owner.user.id, '  Please add the road number  ');
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.reviewNote, 'Please add the road number');
    const mine = await fetch(`${BASE_URL}/owners/me`, { headers: { Authorization: `Bearer ${owner.jwt}` } });
    assert.equal((await mine.json()).ownerProfile.reviewNote, 'Please add the road number');

    reply = await setNote(me.jwt, owner.user.id, 'Please add your phone');
    assert.equal((await stored(owner.user.id)).reviewNote, 'Please add your phone');

    for (const blank of ['   ', '', null]) {
      await setNote(me.jwt, owner.user.id, 'Something');
      reply = await setNote(me.jwt, owner.user.id, blank);
      assert.equal(reply.status, 200);
      assert.equal((await stored(owner.user.id)).reviewNote, null, JSON.stringify(blank));
    }
  });

  test('at most 200 characters (Bangla counted as one each), and text only', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t);
    assert.equal((await setNote(me.jwt, owner.user.id, 'ঢ'.repeat(200))).status, 200);
    assert.deepEqual((await setNote(me.jwt, owner.user.id, 'n'.repeat(201))).body, { error: 'Note must be at most 200 characters' });
    assert.deepEqual((await setNote(me.jwt, owner.user.id, 42)).body, { error: 'Note must be text' });
  });

  test('a live venue: 409, and no note is saved', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { live: true });
    const reply = await setNote(me.jwt, owner.user.id, 'Too late');
    assert.equal(reply.status, 409);
    assert.equal(reply.body.error, 'This venue is live. Move it back to review to leave a note');
    assert.equal((await stored(owner.user.id)).reviewNote, null);
  });

  test('unknown venue: 404', async (t) => {
    const me = await admin(t);
    assert.deepEqual((await setNote(me.jwt, 2147483646, 'x')).body, { error: 'Venue not found' });
  });
});

describe('POST /admin/indoors/:id/move-to-review', () => {
  test('a live venue goes back to pending with the note, and leaves discovery at once', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { live: true });
    assert.ok((await listedIds('/owners', owner.jwt)).includes(owner.user.id));
    const reply = await moveToReview(me.jwt, owner.user.id, { note: '  The venue is closed for renovation ' });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.approvedAt, null);
    assert.equal(reply.body.reviewNote, 'The venue is closed for renovation');
    assert.ok(!(await listedIds('/owners', owner.jwt)).includes(owner.user.id));
    const detail = await fetch(`${BASE_URL}/owners/${owner.user.id}`, { headers: { Authorization: `Bearer ${owner.jwt}` } });
    assert.equal(detail.status, 404);
  });

  test('the note is required, text, at most 200 characters', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { live: true });
    for (const [body, message] of [
      [{}, 'Add a note for the owner'],
      [{ note: null }, 'Add a note for the owner'],
      [{ note: '   ' }, 'Add a note for the owner'],
      [{ note: 7 }, 'Note must be text'],
      [{ note: 'n'.repeat(201) }, 'Note must be at most 200 characters'],
    ]) {
      const reply = await moveToReview(me.jwt, owner.user.id, body);
      assert.equal(reply.status, 400, JSON.stringify(body));
      assert.equal(reply.body.error, message);
    }
    assert.ok((await stored(owner.user.id)).approvedAt, 'still live');
  });

  test('an already pending venue: 409', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t);
    const reply = await moveToReview(me.jwt, owner.user.id, { note: 'Why' });
    assert.equal(reply.status, 409);
    assert.equal(reply.body.error, 'This venue is already waiting for review');
  });

  test('after moving back, approving again works and clears the note', async (t) => {
    const me = await admin(t);
    const owner = await venueOwner(t, { live: true });
    await moveToReview(me.jwt, owner.user.id, { note: 'Fix the address' });
    const reply = await approve(me.jwt, owner.user.id);
    assert.equal(reply.status, 200);
    assert.equal((await stored(owner.user.id)).reviewNote, null);
  });
});

describe('GET /admin/indoors', () => {
  test('pending venues first (oldest first), then live ones by name, with the admin fields', async (t) => {
    const me = await admin(t);
    const older = await venueOwner(t, { name: 'Zz Older Pending' });
    const newer = await venueOwner(t, { name: 'Aa Newer Pending' });
    await prisma.user.update({ where: { id: older.user.id }, data: { createdAt: new Date('2020-01-01') } });
    const live = await venueOwner(t, { name: 'Mm Live', live: true });

    const res = await fetch(`${BASE_URL}/admin/indoors`, { headers: { Authorization: `Bearer ${me.jwt}` } });
    const venues = await res.json();
    const ids = venues.map((v) => v.userId);
    const firstLive = venues.findIndex((v) => v.approvedAt !== null);
    assert.ok(venues.slice(0, firstLive).every((v) => v.approvedAt === null), 'every pending venue comes before the live ones');
    assert.ok(ids.indexOf(older.user.id) < ids.indexOf(newer.user.id), 'older pending first');
    assert.ok(ids.indexOf(live.user.id) >= firstLive);

    const liveNames = venues.slice(firstLive).map((v) => v.indoorName);
    assert.deepEqual(liveNames, [...liveNames].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'live venues by name');

    const row = venues.find((v) => v.userId === newer.user.id);
    for (const field of ['email', 'verified', 'createdAt', 'area', 'openingHours', 'pricingInfo', 'approvedAt', 'reviewNote', 'missingFields']) {
      assert.ok(field in row, `${field} is in the admin reply`);
    }
    assert.equal('password' in row, false);
  });
});

describe('The race: an emptying edit and an approval at the same moment', () => {
  test('never leave an incomplete venue live (20 rounds)', async (t) => {
    const me = await admin(t);
    for (let round = 0; round < 20; round += 1) {
      const owner = await venueOwner(t, { name: `Race Arena ${round}` });
      const emptyingEdit = send('PATCH', '/owners/me', owner.jwt, {
        indoorName: `Race Arena ${round}`,
        address: COMPLETE.address,
        area: null,
        phone: COMPLETE.phone,
      });
      const [edit, approval] = await Promise.all([emptyingEdit, approve(me.jwt, owner.user.id)]);
      const row = await stored(owner.user.id);
      const liveAndIncomplete = row.approvedAt !== null && (row.area === null || row.address === null || row.phone === null);
      assert.equal(liveAndIncomplete, false, `round ${round}: edit ${edit.status}, approve ${approval.status}`);
      // Exactly one of them won: either the edit (still pending, area empty) or the approval
      // (live, the edit refused with "A live venue needs an area").
      if (row.approvedAt !== null) {
        assert.equal(edit.status, 400, `round ${round}`);
        assert.equal(edit.body.error, 'A live venue needs an area');
      } else {
        assert.equal(edit.status, 200, `round ${round}`);
        assert.equal(approval.status, 409, `round ${round}`);
      }
    }
  });
});
