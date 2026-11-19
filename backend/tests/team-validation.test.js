// Tests for createTeam input checks (docs/ROADMAP.md, Phase 2 "createTeam must validate
// the team name"). Safety rules are in helpers.js. All users and teams are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, createLoggedInPlayer, postJson } from './helpers.js';

const teamCount = (ownerId) => prisma.team.count({ where: { ownerId } });

// Sends a create request and checks it was refused with 400 and the given message,
// and that no team was created.
async function assertRefused(player, body, expectedError) {
  const res = await postJson('/teams/create', body, player.jwt);
  assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  assert.equal((await res.json()).error, expectedError, `wrong message for ${JSON.stringify(body)}`);
  assert.equal(await teamCount(player.user.id), 0, 'no team should be created');
}

describe('Team name', () => {
  test('is required', async (t) => {
    const player = await createLoggedInPlayer(t);
    for (const body of [{}, { name: null }, { name: '' }, { name: '    ' }, { description: 'no name' }]) {
      await assertRefused(player, body, 'Team name is required');
    }
  });

  test('must be text', async (t) => {
    const player = await createLoggedInPlayer(t);
    for (const name of [42, true, ['Team'], { not: '' }]) {
      await assertRefused(player, { name }, 'Team name must be text');
    }
  });

  test('must be 2 to 40 characters after trimming', async (t) => {
    const player = await createLoggedInPlayer(t);
    const message = 'Team name must be between 2 and 40 characters';
    await assertRefused(player, { name: 'A' }, message);
    await assertRefused(player, { name: '   A   ' }, message);
    await assertRefused(player, { name: 'A'.repeat(41) }, message);
  });

  test('accepts exactly 2 and exactly 40 characters, and stores the name trimmed', async (t) => {
    const player = await createLoggedInPlayer(t);

    const shortRes = await postJson('/teams/create', { name: '  AB  ' }, player.jwt);
    const longRes = await postJson('/teams/create', { name: 'B'.repeat(40) }, player.jwt);

    assert.equal(shortRes.status, 201);
    assert.equal((await shortRes.json()).name, 'AB', 'the stored name has no surrounding spaces');
    assert.equal(longRes.status, 201);
  });

  test('counts characters, not bytes (a Bangla name works)', async (t) => {
    const player = await createLoggedInPlayer(t);

    const res = await postJson('/teams/create', { name: 'ঢাকা টাইগার্স' }, player.jwt);

    assert.equal(res.status, 201);
  });

  test('does not have to be unique', async (t) => {
    const player = await createLoggedInPlayer(t);
    const other = await createLoggedInPlayer(t);

    const first = await postJson('/teams/create', { name: 'Same Name' }, player.jwt);
    const second = await postJson('/teams/create', { name: 'Same Name' }, other.jwt);

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
  });
});

describe('Team description', () => {
  test('is optional: missing, null, empty or only spaces is stored as no description', async (t) => {
    const player = await createLoggedInPlayer(t);

    for (const body of [{}, { description: null }, { description: '' }, { description: '   ' }]) {
      const res = await postJson('/teams/create', { name: 'No Description', ...body }, player.jwt);
      assert.equal(res.status, 201, `expected 201 for ${JSON.stringify(body)}`);
      assert.equal((await res.json()).description, null);
    }
  });

  test('must be text if given', async (t) => {
    const player = await createLoggedInPlayer(t);
    for (const description of [42, false, ['x'], { not: '' }]) {
      await assertRefused(player, { name: 'Valid Name', description }, 'Description must be text');
    }
  });

  test('can be at most 200 characters after trimming, and is stored trimmed', async (t) => {
    const player = await createLoggedInPlayer(t);
    await assertRefused(
      player,
      { name: 'Valid Name', description: 'x'.repeat(201) },
      'Description must be at most 200 characters'
    );

    const res = await postJson(
      '/teams/create',
      { name: 'Valid Name', description: `   ${'y'.repeat(200)}   ` },
      player.jwt
    );
    assert.equal(res.status, 201, 'exactly 200 characters plus surrounding spaces is fine');
    assert.equal((await res.json()).description, 'y'.repeat(200));
  });
});
