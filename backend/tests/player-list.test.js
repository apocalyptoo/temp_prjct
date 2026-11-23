// The player list of Explore (GET /players; docs/features/explore.md, d endpoint 5):
// search by name, filters by area and by position, who is left out (the viewer,
// unverified accounts, anything that isn't a player with a profile), the order, and
// rows that never carry an email or a phone. Paging itself is tested in
// list-paging.test.js. Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BASE_URL, createLoggedInUser, createTestUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

// A word no other player has, so a search for it finds only this test's players.
const uniqueWord = () => `Zy${crypto.randomBytes(4).toString('hex')}`;
const query = (params) => `/players?${new URLSearchParams({ limit: '50', ...params })}`;
const names = (reply) => reply.body.items.map((player) => player.name);

const profile = (name, extra = {}) => ({
  playerProfile: { create: { name, phone: '01712345678', position: 'Any', ...extra } },
});

// A verified player with a profile, made directly in the database (not logged in).
const listedPlayer = (t, name, extra = {}) => createTestUser(t, { verified: true, ...profile(name, extra) });
const viewerPlayer = (t, name = 'List Viewer') => createLoggedInUser(t, { role: 'PLAYER', ...profile(name) });

describe('GET /players: each row', () => {
  test('is the public profile: id, createdAt, name, position and area, never an email or a phone', async (t) => {
    const word = uniqueWord();
    const listed = await listedPlayer(t, `${word} Nayeem`, { position: 'Goalkeeper', area: 'Mirpur 10', height: 178, weight: 70 });
    const noArea = await listedPlayer(t, `${word} Tanvir`, { position: 'Forward' });
    const viewer = await viewerPlayer(t);
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Viewer Arena' } } });
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });

    for (const asker of [viewer, owner, admin]) {
      const reply = await getJson(query({ search: word }), asker.jwt);
      assert.equal(reply.status, 200);
      assert.deepEqual(reply.body.items, [
        {
          id: listed.id,
          createdAt: listed.createdAt.toISOString(),
          name: `${word} Nayeem`,
          playerProfile: { name: `${word} Nayeem`, position: 'Goalkeeper', area: 'Mirpur 10' },
        },
        {
          id: noArea.id,
          createdAt: noArea.createdAt.toISOString(),
          name: `${word} Tanvir`,
          playerProfile: asker === admin ? { name: `${word} Tanvir`, position: 'Forward', area: null } : { name: `${word} Tanvir`, position: 'Forward' },
        },
      ]);
      // Not even the admin gets an email or a phone from the list.
      assert.doesNotMatch(JSON.stringify(reply.body), /email|example\.com|phone|01712345678|password|height|weight/);
    }
  });

  test('a login is needed', async () => {
    const res = await fetch(`${BASE_URL}/players`);
    assert.equal(res.status, 401);
  });
});

describe('GET /players: who is left out', () => {
  test('the viewer themselves', async (t) => {
    const word = uniqueWord();
    const viewer = await viewerPlayer(t, `${word} Me`);
    const other = await listedPlayer(t, `${word} Other`);

    const reply = await getJson(query({ search: word }), viewer.jwt);

    assert.deepEqual(reply.body.items.map((player) => player.id), [other.id]);
    assert.equal(reply.body.total, 1, 'the total leaves the viewer out too');
  });

  test('players who have not verified their email', async (t) => {
    const word = uniqueWord();
    await createTestUser(t, { verified: false, ...profile(`${word} Unverified`) });
    const verified = await listedPlayer(t, `${word} Verified`);
    const viewer = await viewerPlayer(t);

    const reply = await getJson(query({ search: word }), viewer.jwt);

    assert.deepEqual(reply.body.items.map((player) => player.id), [verified.id]);
    assert.equal(reply.body.total, 1);
  });

  test('venue owners, the admin, and player accounts without a profile', async (t) => {
    const word = uniqueWord();
    await createTestUser(t, { role: 'OWNER', verified: true, ownerProfile: { create: { indoorName: `${word} Arena` } } });
    // An owner or admin account that somehow has a player profile is still not a player.
    await createTestUser(t, { role: 'OWNER', verified: true, ...profile(`${word} Owner With Profile`) });
    await createTestUser(t, { role: 'ADMIN', verified: true, ...profile(`${word} Admin With Profile`) });
    const noProfile = await createTestUser(t, { role: 'PLAYER', verified: true });
    const viewer = await viewerPlayer(t);

    const found = await getJson(query({ search: word }), viewer.jwt);
    assert.deepEqual(found.body.items, []);
    assert.equal(found.body.total, 0);

    // Unfiltered, the account without a profile isn't there either.
    let page = 1;
    const ids = [];
    for (;;) {
      const reply = await getJson(query({ page: String(page) }), viewer.jwt);
      ids.push(...reply.body.items.map((player) => player.id));
      if (page * 50 >= reply.body.total) break;
      page += 1;
    }
    assert.equal(ids.includes(noProfile.id), false);
    assert.equal(ids.includes(viewer.user.id), false);
  });
});

describe('GET /players: search and filters', () => {
  test('search matches part of the name, ignoring case', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} Rahim Uddin`);
    await listedPlayer(t, `${word} Karim Ahmed`);
    const viewer = await viewerPlayer(t);

    for (const search of [`${word} rahim`, `${word} RAHIM UD`.toUpperCase(), `${word.slice(2)} rahim uddin`]) {
      assert.deepEqual(names(await getJson(query({ search }), viewer.jwt)), [`${word} Rahim Uddin`], search);
    }
    assert.deepEqual(names(await getJson(query({ search: `${word} nobody` }), viewer.jwt)), []);
  });

  test('the area filter matches part of the area, ignoring case, after tidying; no area never matches', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} A`, { area: 'Dhanmondi 27' });
    await listedPlayer(t, `${word} B`, { area: 'Mirpur 10' });
    await listedPlayer(t, `${word} C`);
    const viewer = await viewerPlayer(t);

    assert.deepEqual(names(await getJson(query({ search: word, area: 'dhanmondi' }), viewer.jwt)), [`${word} A`]);
    assert.deepEqual(names(await getJson(query({ search: word, area: '  DHANMONDI   27 ' }), viewer.jwt)), [`${word} A`]);
    assert.deepEqual(names(await getJson(query({ search: word, area: 'pur 1' }), viewer.jwt)), [`${word} B`]);
  });

  test('the position filter is exact: "Any" is its own filter, not part of the others', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} Keeper`, { position: 'Goalkeeper' });
    await listedPlayer(t, `${word} Anywhere`, { position: 'Any' });
    await listedPlayer(t, `${word} Striker`, { position: 'Forward' });
    const viewer = await viewerPlayer(t);

    assert.deepEqual(names(await getJson(query({ search: word, position: 'Goalkeeper' }), viewer.jwt)), [`${word} Keeper`]);
    assert.deepEqual(names(await getJson(query({ search: word, position: 'Any' }), viewer.jwt)), [`${word} Anywhere`]);
    assert.deepEqual(names(await getJson(query({ search: word, position: 'Defender' }), viewer.jwt)), []);
    assert.deepEqual(names(await getJson(query({ search: word, position: '  ' }), viewer.jwt)).length, 3, 'a blank position is ignored');
  });

  test('search, area and position together must all match', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} Nayeem`, { position: 'Goalkeeper', area: 'Mirpur 10' });
    await listedPlayer(t, `${word} Nasir`, { position: 'Goalkeeper', area: 'Uttara' });
    await listedPlayer(t, `${word} Nabil`, { position: 'Defender', area: 'Mirpur 12' });
    const viewer = await viewerPlayer(t);

    const all = { search: `${word} na`, area: 'mirpur', position: 'Goalkeeper' };
    assert.deepEqual(names(await getJson(query(all), viewer.jwt)), [`${word} Nayeem`]);
    assert.deepEqual(names(await getJson(query({ ...all, position: 'Forward' }), viewer.jwt)), []);
    assert.deepEqual(names(await getJson(query({ search: `${word} na`, area: 'mirpur' }), viewer.jwt)), [`${word} Nabil`, `${word} Nayeem`]);
    assert.deepEqual(names(await getJson(query({ search: `${word} na`, position: 'Goalkeeper' }), viewer.jwt)), [`${word} Nasir`, `${word} Nayeem`]);
  });

  test('%, _ and quotes in the search match only themselves', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} 100% O'Neil`);
    await listedPlayer(t, `${word} Camp`);
    const viewer = await viewerPlayer(t);

    assert.deepEqual(names(await getJson(query({ search: `${word} 100%` }), viewer.jwt)), [`${word} 100% O'Neil`]);
    assert.deepEqual(names(await getJson(query({ search: `${word} C_mp` }), viewer.jwt)), []);
    assert.deepEqual(names(await getJson(query({ search: `% o'neil` }), viewer.jwt)), [`${word} 100% O'Neil`]);
    const injected = await getJson(query({ search: "' OR '1'='1" }), viewer.jwt);
    assert.equal(injected.status, 200);
    assert.equal(injected.body.total, 0);
  });

  test('a Bangla name and area are found', async (t) => {
    const word = uniqueWord();
    await listedPlayer(t, `${word} রাহাত হাসান`, { area: 'মিরপুর ১০' });
    const viewer = await viewerPlayer(t);

    assert.deepEqual(names(await getJson(query({ search: `${word} রাহাত`, area: 'মিরপুর' }), viewer.jwt)), [`${word} রাহাত হাসান`]);
  });

  test('the limits and wrong values have their messages, the first problem first', async (t) => {
    const viewer = await viewerPlayer(t);
    const positionMessage = 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any';
    const cases = [
      ['?search=' + 's'.repeat(61), 'Search must be at most 60 characters'],
      ['?area=' + 'a'.repeat(41), 'Area must be at most 40 characters'],
      ['?search=a&search=b', 'Search must be text'],
      ['?area=a&area=b', 'Area must be text'],
      ['?position=goalkeeper', positionMessage],
      ['?position=Pivot', positionMessage],
      ['?position=Goalkeeper%20', positionMessage],
      ['?position=Goalkeeper&position=Any', positionMessage],
      // search, then area, then position, then page, then limit.
      ['?limit=0&page=0&position=Pivot&area=' + 'a'.repeat(41), 'Area must be at most 40 characters'],
      ['?limit=0&page=0&position=Pivot', positionMessage],
      ['?limit=0&page=0', 'Page must be a whole number from 1 to 1000'],
    ];
    for (const [params, message] of cases) {
      const reply = await getJson(`/players${params}`, viewer.jwt);
      assert.equal(reply.status, 400, params);
      assert.deepEqual(reply.body, { error: message }, params);
    }
    for (const position of ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any']) {
      assert.equal((await getJson(`/players?position=${position}`, viewer.jwt)).status, 200, position);
    }
  });
});

describe('GET /players: the order', () => {
  test('by name A to Z, the same name by id', async (t) => {
    const word = uniqueWord();
    const twinOne = await listedPlayer(t, `${word} Bravo`);
    await listedPlayer(t, `${word} Charlie`);
    const twinTwo = await listedPlayer(t, `${word} Bravo`);
    await listedPlayer(t, `${word} Alpha`);
    const viewer = await viewerPlayer(t);

    const reply = await getJson(query({ search: word }), viewer.jwt);

    assert.deepEqual(names(reply), [`${word} Alpha`, `${word} Bravo`, `${word} Bravo`, `${word} Charlie`]);
    assert.deepEqual(reply.body.items.slice(1, 3).map((player) => player.id), [twinOne.id, twinTwo.id]);
  });
});
