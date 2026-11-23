// The team list of Explore (GET /teams; docs/features/explore.md, d endpoint 1): light
// rows (no member rows, no profiles), search by name, an area filter, teams with a free
// spot first, and where the viewer stands with each team. The page is read with one raw
// SQL query, so the tests at the end check that nothing typed into the search can act
// as a wildcard or change the query. Paging itself is tested in list-paging.test.js.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BASE_URL, prisma, createLoggedInUser, createTestUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

// A word no other team has, so a search for it finds only this test's teams.
const uniqueWord = () => `Zt${crypto.randomBytes(4).toString('hex')}`;
const query = (params) => `/teams?${new URLSearchParams({ limit: '50', ...params })}`;
const names = (reply) => reply.body.items.map((team) => team.name);

const player = (t, name = 'List Viewer') =>
  createLoggedInUser(t, { role: 'PLAYER', playerProfile: { create: { name, phone: '01712345678', position: 'Any' } } });

// A team made directly in the database, with its captain's own accepted row.
async function teamOf(captainId, { name, area = null, description = null }) {
  return prisma.team.create({
    data: {
      name,
      area,
      description,
      captainId,
      members: { create: { userId: captainId, status: 'accepted', origin: 'creator', acceptedAt: new Date() } },
    },
  });
}

const addRow = (teamId, userId, status, origin) =>
  prisma.teamMember.create({
    data: { teamId, userId, status, origin, acceptedAt: status === 'accepted' ? new Date() : null },
  });

// Throwaway players who fill a team up to `count` accepted members (the captain included).
async function fillTeam(t, teamId, count) {
  for (let n = 1; n < count; n += 1) {
    const filler = await createTestUser(t);
    await addRow(teamId, filler.id, 'accepted', 'invite');
  }
}

describe('GET /teams: each row', () => {
  test('is the team, its captain, its counts and the viewer state, and nothing else', async (t) => {
    const word = uniqueWord();
    const captain = await player(t, 'Rahim Captain');
    const member = await player(t, 'Accepted Member');
    const invited = await player(t, 'Invited Player');
    const viewer = await player(t);
    const team = await teamOf(captain.user.id, { name: `${word} Strikers`, area: 'Dhanmondi 27', description: 'Weekend crew.' });
    await addRow(team.id, member.user.id, 'accepted', 'invite');
    await addRow(team.id, invited.user.id, 'pending', 'invite');
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: viewer.user.id, status: 'pending', origin: 'request', message: 'A private message' },
    });

    const reply = await getJson(query({ search: word }), viewer.jwt);

    assert.equal(reply.status, 200);
    assert.equal(reply.body.total, 1);
    const [row] = reply.body.items;
    assert.deepEqual(row, {
      id: team.id,
      name: `${word} Strikers`,
      description: 'Weekend crew.',
      area: 'Dhanmondi 27',
      createdAt: team.createdAt.toISOString(),
      captainId: captain.user.id,
      captain: { id: captain.user.id, name: 'Rahim Captain' },
      memberCount: 2,
      maxMembers: 15,
      viewerState: 'requested',
    });
    // Nothing about the members, their profiles, or the request's message.
    assert.doesNotMatch(JSON.stringify(reply.body), /members"|pendingInvites|email|phone|A private message|password/);
  });

  test('the captain no longer gets pendingInvites here; an area and description may be empty', async (t) => {
    const word = uniqueWord();
    const captain = await player(t, 'Solo Captain');
    const invited = await player(t);
    const team = await teamOf(captain.user.id, { name: `${word} Solo` });
    await addRow(team.id, invited.user.id, 'pending', 'invite');

    const [row] = (await getJson(query({ search: word }), captain.jwt)).body.items;

    assert.equal(row.viewerState, 'captain');
    assert.equal(row.memberCount, 1, 'a pending invite is not a member');
    assert.equal(row.area, null);
    assert.equal(row.description, null);
    assert.equal('pendingInvites' in row, false);
    assert.equal('members' in row, false);
  });

  test('viewerState: captain, member, invited, requested, none; always none for a venue owner and the admin', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    const member = await player(t);
    const invited = await player(t);
    const requester = await player(t);
    const stranger = await player(t);
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Viewer Arena' } } });
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const team = await teamOf(captain.user.id, { name: `${word} States` });
    await addRow(team.id, member.user.id, 'accepted', 'request');
    await addRow(team.id, invited.user.id, 'pending', 'invite');
    await addRow(team.id, requester.user.id, 'pending', 'request');

    const expected = [
      [captain, 'captain'],
      [member, 'member'],
      [invited, 'invited'],
      [requester, 'requested'],
      [stranger, 'none'],
      [owner, 'none'],
      [admin, 'none'],
    ];
    for (const [viewer, state] of expected) {
      const reply = await getJson(query({ search: word }), viewer.jwt);
      assert.equal(reply.status, 200);
      assert.equal(reply.body.items[0].viewerState, state, state);
      assert.equal(reply.body.items[0].memberCount, 2);
    }
  });

  test('a login is needed', async () => {
    const res = await fetch(`${BASE_URL}/teams`);
    assert.equal(res.status, 401);
  });
});

describe('GET /teams: search and the area filter', () => {
  test('search matches part of the name, ignoring case', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    await teamOf(captain.user.id, { name: `${word} Floodlight FC` });
    await teamOf(captain.user.id, { name: `${word} Kickers` });

    for (const search of [word.toLowerCase() + ' flood', `${word} FLOODLIGHT`.toUpperCase(), `${word.slice(2)} floodLIGHT f`]) {
      assert.deepEqual(names(await getJson(query({ search }), captain.jwt)), [`${word} Floodlight FC`], search);
    }
    assert.deepEqual(names(await getJson(query({ search: `${word} nobody` }), captain.jwt)), []);
  });

  test('the area filter matches part of the area, ignoring case, after tidying; a team without an area never matches it', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    await teamOf(captain.user.id, { name: `${word} A`, area: 'Dhanmondi 27' });
    await teamOf(captain.user.id, { name: `${word} B`, area: 'Mirpur 10' });
    await teamOf(captain.user.id, { name: `${word} C` });

    assert.deepEqual(names(await getJson(query({ search: word, area: 'dhanmondi' }), captain.jwt)), [`${word} A`]);
    assert.deepEqual(names(await getJson(query({ search: word, area: '  DHANMONDI   27 ' }), captain.jwt)), [`${word} A`]);
    assert.deepEqual(names(await getJson(query({ search: word, area: 'pur 1' }), captain.jwt)), [`${word} B`]);
    assert.deepEqual(names(await getJson(query({ search: word }), captain.jwt)), [`${word} A`, `${word} B`, `${word} C`]);
  });

  test('search and area together must both match; blank ones are ignored', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    await teamOf(captain.user.id, { name: `${word} Strikers`, area: 'Uttara 4' });
    await teamOf(captain.user.id, { name: `${word} Kickers`, area: 'Uttara 6' });

    assert.deepEqual(names(await getJson(query({ search: `${word} strik`, area: 'uttara' }), captain.jwt)), [`${word} Strikers`]);
    assert.deepEqual(names(await getJson(query({ search: `${word} strik`, area: 'banani' }), captain.jwt)), []);
    assert.deepEqual(names(await getJson(query({ search: `  ${word} strik `, area: '   ' }), captain.jwt)), [`${word} Strikers`]);
  });

  test('a Bangla name and area are found', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    await teamOf(captain.user.id, { name: `${word} ঢাকা টাইগার্স`, area: 'মিরপুর ১০' });

    assert.deepEqual(names(await getJson(query({ search: `${word} ঢাকা`, area: 'মিরপুর' }), captain.jwt)), [`${word} ঢাকা টাইগার্স`]);
  });

  test('the limits and wrong types have their messages', async (t) => {
    const me = await player(t);
    const cases = [
      ['?search=' + 's'.repeat(61), 'Search must be at most 60 characters'],
      ['?area=' + 'a'.repeat(41), 'Area must be at most 40 characters'],
      ['?search=a&search=b', 'Search must be text'],
      ['?area=a&area=b', 'Area must be text'],
      // The first problem wins: search, then area, then page, then limit.
      ['?limit=0&page=0&area=' + 'a'.repeat(41), 'Area must be at most 40 characters'],
    ];
    for (const [params, message] of cases) {
      const reply = await getJson(`/teams${params}`, me.jwt);
      assert.equal(reply.status, 400, params);
      assert.deepEqual(reply.body, { error: message }, params);
    }
    assert.equal((await getJson('/teams?search=' + 'ঢ'.repeat(60), me.jwt)).status, 200, '60 Bangla letters fit');
  });
});

describe('GET /teams: the order', () => {
  test('teams with a free spot first, then by name A to Z ignoring case, then by id', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    // "Alpha" is full, so it goes last although its name comes first.
    const full = await teamOf(captain.user.id, { name: `${word} Alpha` });
    await fillTeam(t, full.id, 15);
    const almostFull = await teamOf(captain.user.id, { name: `${word} delta` });
    await fillTeam(t, almostFull.id, 14);
    const twinOne = await teamOf(captain.user.id, { name: `${word} Charlie` });
    const twinTwo = await teamOf(captain.user.id, { name: `${word} Charlie` });
    await teamOf(captain.user.id, { name: `${word} bravo` });
    // A pending invite doesn't fill a team: 14 accepted and one invited is still free.
    const invited = await createTestUser(t);
    await addRow(almostFull.id, invited.id, 'pending', 'invite');

    const reply = await getJson(query({ search: word }), captain.jwt);

    assert.deepEqual(names(reply), [`${word} bravo`, `${word} Charlie`, `${word} Charlie`, `${word} delta`, `${word} Alpha`]);
    const ids = reply.body.items.map((team) => team.id);
    assert.deepEqual(ids.slice(1, 3), [twinOne.id, twinTwo.id], 'the same name: the lower id first');
    assert.deepEqual(reply.body.items.map((team) => team.memberCount), [1, 1, 1, 14, 15]);
    assert.equal(reply.body.items[4].maxMembers, 15);
  });
});

describe("GET /teams: what's typed can't act as a wildcard or change the query", () => {
  test('% and _ match only themselves, in the search and in the area', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    await teamOf(captain.user.id, { name: `${word} 100% Futsal`, area: `${word} 5_a_side` });
    await teamOf(captain.user.id, { name: `${word} Camp`, area: `${word} 5xaxside` });

    assert.deepEqual(names(await getJson(query({ search: `${word} 100%` }), captain.jwt)), [`${word} 100% Futsal`]);
    assert.deepEqual(names(await getJson(query({ search: `${word} C_mp` }), captain.jwt)), [], '_ is not "any one character"');
    assert.deepEqual(names(await getJson(query({ search: `${word}%Camp` }), captain.jwt)), [], '% is not "anything"');
    assert.deepEqual(names(await getJson(query({ area: `${word} 5_a_side` }), captain.jwt)), [`${word} 100% Futsal`]);
    assert.deepEqual(names(await getJson(query({ area: `${word} 5%side` }), captain.jwt)), []);

    // A bare % would match every team as a wildcard. Escaped, it finds only names with a %.
    const withPercent = await getJson(query({ search: '%' }), captain.jwt);
    assert.ok(withPercent.body.items.every((team) => team.name.includes('%')));
    const everything = await getJson(query({}), captain.jwt);
    assert.ok(withPercent.body.total < everything.body.total);
    const underscore = await getJson(query({ search: '_' }), captain.jwt);
    assert.ok(underscore.body.items.every((team) => team.name.includes('_')));
  });

  test('quotes and a backslash are matched as plain characters', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    const tricky = `${word} O'Brien's "A" \\ Team`;
    await teamOf(captain.user.id, { name: tricky, area: `${word} Cox's Bazar` });
    await teamOf(captain.user.id, { name: `${word} OBriens A Team`, area: `${word} Coxs Bazar` });

    for (const search of [`${word} O'Brien`, `O'Brien's "A"`, `"A" \\ Team`, `${word} o'brien's "a" \\ team`]) {
      const reply = await getJson(query({ search: `${search}` }), captain.jwt);
      assert.equal(reply.status, 200, search);
      assert.ok(names(reply).includes(tricky), search);
      assert.ok(!names(reply).includes(`${word} OBriens A Team`), search);
    }
    assert.deepEqual(names(await getJson(query({ area: `${word} cox's` }), captain.jwt)), [tricky]);
    // A lone backslash is the pattern's escape character: it must match a real backslash only.
    const backslash = await getJson(query({ search: '\\' }), captain.jwt);
    assert.equal(backslash.status, 200);
    assert.ok(backslash.body.items.every((team) => team.name.includes('\\')));
  });

  test('SQL typed into the search or the area is only text to look for', async (t) => {
    const word = uniqueWord();
    const captain = await player(t);
    const team = await teamOf(captain.user.id, { name: `${word} Still Here`, area: 'Banani' });
    const everything = (await getJson(query({}), captain.jwt)).body.total;

    const attacks = [
      "' OR '1'='1",
      "' OR 1=1 --",
      "%' OR 't.name' ILIKE '%",
      `'; DROP TABLE "Team"; --`,
      `'; DELETE FROM "TeamMember"; --`,
      "\\' OR 1=1 --",
      // (Each fits the area filter's 40 characters, so both filters take it.)
      `') UNION SELECT password FROM "User" --`,
      'NULL',
      '$1',
    ];
    for (const text of attacks) {
      for (const params of [{ search: text }, { area: text }, { search: text, area: text }]) {
        const reply = await getJson(query(params), captain.jwt);
        assert.equal(reply.status, 200, JSON.stringify(params));
        assert.equal(reply.body.total, 0, `${JSON.stringify(params)} must not match every team`);
        assert.deepEqual(reply.body.items, []);
      }
    }

    // Nothing was changed or deleted: the team, its row and the full list are as before.
    assert.ok(await prisma.team.findUnique({ where: { id: team.id } }));
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
    assert.equal((await getJson(query({}), captain.jwt)).body.total, everything);
    assert.deepEqual(names(await getJson(query({ search: word }), captain.jwt)), [`${word} Still Here`]);
  });
});
