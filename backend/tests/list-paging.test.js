// Paging, the same on every paged list (docs/features/explore.md, d.1): `page` and
// `limit` in the query, { items, page, limit, total } in the reply, 20 rows by default,
// pages that never overlap, an empty page past the end, and one message per bad value.
// Each list below makes its own rows, named with a word no other row has, and searches
// for that word, so the counts are exact whatever else is in the database.
// Safety rules are in helpers.js. All users, teams and venues here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BASE_URL, prisma, createLoggedInUser, createTestUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

const uniqueWord = () => `Zp${crypto.randomBytes(4).toString('hex')}`;
const twoDigits = (n) => String(n).padStart(2, '0');

// Each paged list: how to make `count` rows whose names contain `word` (named so that
// A-to-Z order is the order they were numbered in), the path that lists them, and the
// field that identifies a row. `setup` returns the jwt to ask with.
const LISTS = [
  {
    name: 'GET /owners (venues)',
    idOf: (row) => row.userId,
    async setup(t, word, count) {
      for (let n = 1; n <= count; n += 1) {
        await createTestUser(t, {
          role: 'OWNER',
          verified: true,
          ownerProfile: {
            create: { indoorName: `${word} Arena ${twoDigits(n)}`, address: 'Road 1', area: 'Banani', phone: '01712345678', approvedAt: new Date() },
          },
        });
      }
      const viewer = await createLoggedInUser(t, { role: 'PLAYER' });
      return { jwt: viewer.jwt, path: (params) => `/owners?${new URLSearchParams({ search: word, ...params })}` };
    },
  },
  {
    name: 'GET /teams',
    idOf: (row) => row.id,
    async setup(t, word, count) {
      // The viewer captains the teams, so they are deleted with the viewer.
      const viewer = await createLoggedInUser(t, { role: 'PLAYER' });
      for (let n = 1; n <= count; n += 1) {
        await prisma.team.create({ data: { name: `${word} Team ${twoDigits(n)}`, captainId: viewer.user.id } });
      }
      return { jwt: viewer.jwt, path: (params) => `/teams?${new URLSearchParams({ search: word, ...params })}` };
    },
  },
];

for (const list of LISTS) {
  describe(`Paging: ${list.name}`, () => {
    test('without page or limit: the first 20 rows, with the total', async (t) => {
      const { jwt, path } = await list.setup(t, uniqueWord(), 21);

      const reply = await getJson(path({}), jwt);

      assert.equal(reply.status, 200);
      assert.deepEqual(Object.keys(reply.body).sort(), ['items', 'limit', 'page', 'total']);
      assert.equal(reply.body.page, 1);
      assert.equal(reply.body.limit, 20);
      assert.equal(reply.body.total, 21);
      assert.equal(reply.body.items.length, 20);

      const second = await getJson(path({ page: '2' }), jwt);
      assert.equal(second.body.items.length, 1, 'the 21st row is on page 2');
      assert.equal(second.body.page, 2);
    });

    test('pages never overlap, together hold every row, and keep one order', async (t) => {
      const { jwt, path } = await list.setup(t, uniqueWord(), 5);

      const whole = await getJson(path({ limit: '50' }), jwt);
      assert.equal(whole.body.total, 5);
      const wholeIds = whole.body.items.map(list.idOf);
      assert.equal(wholeIds.length, 5);

      const paged = [];
      for (const page of ['1', '2', '3']) {
        const reply = await getJson(path({ page, limit: '2' }), jwt);
        assert.equal(reply.status, 200);
        assert.deepEqual([reply.body.page, reply.body.limit, reply.body.total], [Number(page), 2, 5]);
        paged.push(...reply.body.items.map(list.idOf));
      }
      assert.deepEqual(paged, wholeIds, 'pages 1 to 3 of two rows are the whole list, in the same order');
      assert.equal(new Set(paged).size, 5, 'no row twice');
    });

    test('a page past the end is empty, with the real total', async (t) => {
      const { jwt, path } = await list.setup(t, uniqueWord(), 2);

      for (const page of ['2', '1000']) {
        const reply = await getJson(path({ page }), jwt);
        assert.equal(reply.status, 200, page);
        assert.deepEqual(reply.body, { items: [], page: Number(page), limit: 20, total: 2 });
      }
    });

    test('the largest limit is 50', async (t) => {
      const { jwt, path } = await list.setup(t, uniqueWord(), 1);

      const reply = await getJson(path({ limit: '50' }), jwt);

      assert.equal(reply.status, 200);
      assert.equal(reply.body.limit, 50);
    });

    test('a bad page or limit is refused with its message', async (t) => {
      const { jwt, path } = await list.setup(t, uniqueWord(), 1);
      const pageMessage = 'Page must be a whole number from 1 to 1000';
      const limitMessage = 'Limit must be a whole number from 1 to 50';

      const cases = [
        ...['0', '-1', '1.5', 'abc', '1001', '', ' 2', '2 ', '02', '1e2', '+1'].map((page) => [{ page }, pageMessage]),
        ...['0', '-5', '51', '2.5', 'ten', '', '020'].map((limit) => [{ limit }, limitMessage]),
        // The page is checked before the limit.
        [{ page: '0', limit: '0' }, pageMessage],
      ];
      for (const [params, message] of cases) {
        const reply = await getJson(path(params), jwt);
        assert.equal(reply.status, 400, JSON.stringify(params));
        assert.deepEqual(reply.body, { error: message }, JSON.stringify(params));
      }

      // A value given twice arrives as a list, not text.
      const twice = await getJson(`${path({})}&page=1&page=2`, jwt);
      assert.equal(twice.status, 400);
      assert.deepEqual(twice.body, { error: pageMessage });
      const limitTwice = await getJson(`${path({})}&limit=5&limit=6`, jwt);
      assert.deepEqual(limitTwice.body, { error: limitMessage });
    });
  });
}
