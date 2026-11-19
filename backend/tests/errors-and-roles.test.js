// Tests for Phase 1 items 7 (no error details in responses) and 13 (team role checks).
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, fakeClientIp, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Text that must never reach a client: Prisma internals, error class names, stack traces.
const LEAK_PATTERN = /prisma|invocation|PrismaClient|Error:|\bat .+\(|node_modules|stack/i;

describe('Error responses never include internal details (item 7)', () => {
  test('a server error returns only a generic message', async (t) => {
    // No route crashes on bad input any more (bad ids get 400), so make a real database
    // error on purpose and hand it to the error handler the way Express would.
    const prismaError = await prisma.team.findUnique({ where: { id: 'abc' } }).catch((err) => err);
    assert.match(String(prismaError), /prisma|invocation/i, 'setup: this should be a real Prisma error');

    t.mock.method(console, 'error', () => {}); // the handler logs the real error; keep test output quiet
    const reply = {};
    const res = {
      headersSent: false,
      status(code) { reply.status = code; return this; },
      json(body) { reply.body = body; return this; },
      send(body) { reply.body = body; return this; },
    };
    errorHandler(prismaError, { method: 'POST', originalUrl: '/teams/1/accept', is: () => false }, res, () => {});

    assert.equal(reply.status, 500);
    assert.deepEqual(reply.body, { error: 'Something went wrong' });
    assert.doesNotMatch(JSON.stringify(reply.body), LEAK_PATTERN);
  });

  test('a malformed JSON body gets a short 400, with no stack trace', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': fakeClientIp() },
      body: '{"email": ',
    });
    const text = await res.text();

    assert.equal(res.status, 400);
    assert.deepEqual(JSON.parse(text), { error: 'Invalid request body' });
    assert.doesNotMatch(text, LEAK_PATTERN);
  });
});

describe('Only players can use team actions (item 13)', () => {
  for (const role of ['OWNER', 'ADMIN']) {
    test(`a ${role} account can't create a team`, async (t) => {
      const account = await createLoggedInUser(t, { role });

      const res = await postJson('/teams/create', { name: 'Test Team' }, account.jwt);

      assert.equal(res.status, 403);
      assert.match((await res.json()).error, /only player accounts/i);
      assert.equal(await prisma.team.count({ where: { ownerId: account.user.id } }), 0);
    });

    test(`a ${role} account can't invite, accept or reject`, async (t) => {
      const account = await createLoggedInUser(t, { role });
      const player = await createLoggedInPlayer(t);
      // A team owned by the non-player, made directly in the database (old data could
      // look like this, because owners used to be able to create teams).
      const team = await prisma.team.create({ data: { name: 'Test Team', ownerId: account.user.id } });

      const invite = await postJson(`/teams/${team.id}/invite`, { userId: player.user.id }, account.jwt);
      const accept = await postJson(`/teams/${team.id}/accept`, {}, account.jwt);
      const reject = await postJson(`/teams/${team.id}/reject`, {}, account.jwt);

      for (const res of [invite, accept, reject]) {
        assert.equal(res.status, 403);
        assert.match((await res.json()).error, /only player accounts/i);
      }
      assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 0);
    });
  }

  test('inviting a user id that does not exist returns 404 "Player not found"', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await (await postJson('/teams/create', { name: 'Test Team' }, captain.jwt)).json();
    const { _max } = await prisma.user.aggregate({ _max: { id: true } });
    const missingId = (_max.id ?? 0) + 1000000;

    const res = await postJson(`/teams/${team.id}/invite`, { userId: missingId }, captain.jwt);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Player not found');
  });

  test('only PLAYER accounts can be invited', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const owner = await createLoggedInUser(t, { role: 'OWNER' });
    const team = await (await postJson('/teams/create', { name: 'Test Team' }, captain.jwt)).json();

    const res = await postJson(`/teams/${team.id}/invite`, { userId: owner.user.id }, captain.jwt);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Player not found');
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id, userId: owner.user.id } }), 0);
  });
});
