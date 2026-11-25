// Tests for a request that's already past its login check when the account it needs is
// deleted (docs/features/account-deletion.md, d.5): a clean reply, never a 500.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createLoggedInPlayer, createTestUser, postJson } from './helpers.js';
import { deleteUserAndData } from '../src/utils/deletion.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Deletes the account, and once its row is locked (but not yet gone) starts `request`,
// which then has to wait for the deletion. Returns the request's reply.
async function duringDeletion(user, request) {
  let reply;
  const client = {
    $transaction: (fn, options) =>
      prisma.$transaction(async (tx) => {
        const result = await fn(
          new Proxy(tx, {
            get(target, prop) {
              // playerProfile is first used after the locks are held.
              if (prop === 'playerProfile' && !reply) reply = request();
              const value = target[prop];
              return typeof value === 'function' ? value.bind(target) : value;
            },
          })
        );
        await sleep(400); // the request reaches its write while the row is still locked
        return result;
      }, options),
  };
  assert.equal((await deleteUserAndData(client, user.id)).status, 'deleted');
  const res = await reply;
  return { status: res.status, body: await res.json() };
}

const GONE = { status: 401, body: { error: 'Invalid token' } };

describe('An account deleted in the middle of a request', () => {
  test('creating a team: 401, and no team', async (t) => {
    const me = await createLoggedInPlayer(t);

    const reply = await duringDeletion(me.user, () => postJson('/teams/create', { name: 'Too Late' }, me.jwt));

    assert.deepEqual(reply, GONE);
    assert.equal(await prisma.team.count({ where: { captainId: me.user.id } }), 0);
  });

  test('asking to join a team: 401, and no request', async (t) => {
    const me = await createLoggedInPlayer(t);
    const captain = await createLoggedInPlayer(t);
    const team = await (await postJson('/teams/create', { name: 'Asked FC' }, captain.jwt)).json();

    const reply = await duringDeletion(me.user, () => postJson(`/teams/${team.id}/requests`, {}, me.jwt));

    assert.deepEqual(reply, GONE);
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
  });

  test('inviting a player who is being deleted: 404, and the team can still be used', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const player = await createTestUser(t, { verified: true });
    const other = await createTestUser(t, { verified: true });
    const team = await (await postJson('/teams/create', { name: 'Invite FC' }, captain.jwt)).json();

    const reply = await duringDeletion(player, () => postJson(`/teams/${team.id}/invite`, { userId: player.id }, captain.jwt));

    assert.deepEqual(reply, { status: 404, body: { error: 'Player not found' } });
    assert.equal(await prisma.teamMember.count({ where: { teamId: team.id } }), 1);
    assert.equal((await postJson(`/teams/${team.id}/invite`, { userId: other.id }, captain.jwt)).status, 201);
  });
});
