// Venue discovery (docs/features/venues.md, d endpoints 3 and 4): GET /owners lists only
// live venues, with search by name and an area filter (part of the text, ignoring case,
// % and _ literal), sorted by name, in pages (the paging itself is tested in
// list-paging.test.js); GET /owners/:userId shows one live venue. Neither
// ever shows the owner's email (to others), the review state or the admin's note.
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BASE_URL, prisma, createLoggedInUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

// A word no other venue has, so a search for it finds only this test's venues.
const uniqueWord = () => `Zq${crypto.randomBytes(4).toString('hex')}`;

// A venue owner with a listing; live unless `live: false`.
async function venue(t, { name, area = 'Dhanmondi 27', live = true, note = null } = {}) {
  return createLoggedInUser(t, {
    role: 'OWNER',
    ownerProfile: {
      create: {
        indoorName: name,
        address: 'Road 1',
        area,
        phone: '01712345678',
        openingHours: 'Sat–Thu 8am–2am',
        pricingInfo: '৳2,000 per hour',
        approvedAt: live ? new Date() : null,
        reviewNote: note,
      },
    },
  });
}

const player = (t) =>
  createLoggedInUser(t, { role: 'PLAYER', playerProfile: { create: { name: 'Venue Seeker', phone: '01712345678', position: 'Any' } } });

const names = (list) => list.map((v) => v.indoorName);
const query = (params) => `/owners?${new URLSearchParams(params)}`;

describe('GET /owners: the venue list', () => {
  test('only live venues are listed', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} Live Arena` });
    await venue(t, { name: `${word} Pending Arena`, live: false });
    const me = await player(t);
    const reply = await getJson(query({ search: word }), me.jwt);
    assert.equal(reply.status, 200);
    assert.deepEqual(names(reply.body.items), [`${word} Live Arena`]);
  });

  test('search matches part of the name, ignoring case', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} Floodlight Arena` });
    const me = await player(t);
    for (const search of [word.toLowerCase(), `${word} flood`.toUpperCase(), `${word.slice(2)} floodLIGHT`]) {
      const reply = await getJson(query({ search }), me.jwt);
      assert.deepEqual(names(reply.body.items), [`${word} Floodlight Arena`], search);
    }
  });

  test('the area filter matches part of the area, ignoring case, after tidying', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} A`, area: 'Dhanmondi 27' });
    await venue(t, { name: `${word} B`, area: 'Mirpur 10' });
    const me = await player(t);
    assert.deepEqual(names((await getJson(query({ search: word, area: 'dhanmondi' }), me.jwt)).body.items), [`${word} A`]);
    assert.deepEqual(names((await getJson(query({ search: word, area: '  DHANMONDI   27 ' }), me.jwt)).body.items), [`${word} A`]);
    assert.deepEqual(names((await getJson(query({ search: word, area: 'pur 1' }), me.jwt)).body.items), [`${word} B`]);
  });

  test('search and area together must both match', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} Strikers`, area: 'Uttara 4' });
    await venue(t, { name: `${word} Kickers`, area: 'Uttara 6' });
    const me = await player(t);
    assert.deepEqual(names((await getJson(query({ search: `${word} strik`, area: 'uttara' }), me.jwt)).body.items), [`${word} Strikers`]);
    assert.deepEqual(names((await getJson(query({ search: `${word} strik`, area: 'banani' }), me.jwt)).body.items), []);
  });

  test('% and _ match only themselves, never as wildcards', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} 100% Futsal` });
    await venue(t, { name: `${word} Camp` });
    const me = await player(t);
    assert.deepEqual(names((await getJson(query({ search: `${word} 100%` }), me.jwt)).body.items), [`${word} 100% Futsal`]);
    assert.deepEqual(names((await getJson(query({ search: `${word} C_mp` }), me.jwt)).body.items), []);
    // A bare "%" would match every venue as a wildcard; escaped, it finds only names with a %.
    const withPercent = names((await getJson(query({ search: '% futsal' }), me.jwt)).body.items);
    assert.ok(withPercent.includes(`${word} 100% Futsal`));
    assert.ok(!withPercent.includes(`${word} Camp`));
  });

  test('blank filters are ignored', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} Blank Arena` });
    const me = await player(t);
    const reply = await getJson(query({ search: `  ${word}  `, area: '   ' }), me.jwt);
    assert.equal(reply.status, 200);
    assert.deepEqual(names(reply.body.items), [`${word} Blank Arena`]);
  });

  test('sorted by venue name, A to Z', async (t) => {
    const word = uniqueWord();
    for (const name of ['Charlie', 'Alpha', 'Bravo']) await venue(t, { name: `${word} ${name}` });
    const me = await player(t);
    const reply = await getJson(query({ search: word }), me.jwt);
    assert.deepEqual(names(reply.body.items), ['Alpha', 'Bravo', 'Charlie'].map((name) => `${word} ${name}`));
  });

  test('the limits and wrong types have their messages', async (t) => {
    const me = await player(t);
    const cases = [
      ['?search=' + 's'.repeat(61), 'Search must be at most 60 characters'],
      ['?area=' + 'a'.repeat(41), 'Area must be at most 40 characters'],
      ['?search=a&search=b', 'Search must be text'],
      ['?area=a&area=b', 'Area must be text'],
    ];
    for (const [params, message] of cases) {
      const reply = await getJson(`/owners${params}`, me.jwt);
      assert.equal(reply.status, 400, params);
      assert.equal(reply.body.error, message, params);
    }
    assert.equal((await getJson('/owners?search=' + 'ঢ'.repeat(60), me.jwt)).status, 200, '60 Bangla letters fit');
  });

  test('each venue has the public listing, and never the email, review state or note', async (t) => {
    const word = uniqueWord();
    await venue(t, { name: `${word} Public Arena`, note: 'A leftover note' });
    const me = await player(t);
    const [listed] = (await getJson(query({ search: word }), me.jwt)).body.items;
    assert.deepEqual(Object.keys(listed).sort(), [
      'address', 'area', 'createdAt', 'description', 'indoorName', 'openingHours', 'phone', 'pricingInfo', 'userId', 'website',
    ]);
  });

  test('a login is needed', async () => {
    const res = await fetch(`${BASE_URL}/owners`);
    assert.equal(res.status, 401);
  });
});

describe('GET /owners/:userId: one venue', () => {
  test('a live venue: its public listing', async (t) => {
    const word = uniqueWord();
    const owner = await venue(t, { name: `${word} Detail Arena`, note: 'Not for players' });
    const me = await player(t);
    const reply = await getJson(`/owners/${owner.user.id}`, me.jwt);
    assert.equal(reply.status, 200);
    assert.equal(reply.body.indoorName, `${word} Detail Arena`);
    assert.equal(reply.body.area, 'Dhanmondi 27');
    assert.equal(reply.body.openingHours, 'Sat–Thu 8am–2am');
    for (const hidden of ['email', 'approvedAt', 'reviewNote', 'missingFields']) {
      assert.equal(hidden in reply.body, false, `${hidden} is hidden`);
    }
  });

  test("the owner themselves get their email back here, like in the list", async (t) => {
    const owner = await venue(t, { name: `${uniqueWord()} Own Arena` });
    const reply = await getJson(`/owners/${owner.user.id}`, owner.jwt);
    assert.equal(reply.body.email, owner.user.email);
  });

  test('a pending venue, a player and an unknown id are all "Venue not found"', async (t) => {
    const pending = await venue(t, { name: `${uniqueWord()} Hidden Arena`, live: false });
    const me = await player(t);
    for (const id of [pending.user.id, me.user.id, 2147483646]) {
      const reply = await getJson(`/owners/${id}`, me.jwt);
      assert.equal(reply.status, 404, String(id));
      assert.equal(reply.body.error, 'Venue not found');
    }
  });

  test('a bad id is "Invalid venue id"', async (t) => {
    const me = await player(t);
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const reply = await getJson(`/owners/${id}`, me.jwt);
      assert.equal(reply.status, 400, id);
      assert.equal(reply.body.error, 'Invalid venue id');
    }
  });

  test('/owners/me still answers the owner, not the detail route', async (t) => {
    const owner = await venue(t, { name: `${uniqueWord()} Me Arena`, live: false });
    const reply = await getJson('/owners/me', owner.jwt);
    assert.equal(reply.status, 200);
    assert.equal(reply.body.ownerProfile.approvedAt, null);
  });
});
