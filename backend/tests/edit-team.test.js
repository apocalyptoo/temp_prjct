// Tests for editing a team (PATCH /teams/:teamId; docs/features/team-membership.md,
// endpoint 16): the captain changes the name and description with the same rules as
// creating a team. Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInUser, createLoggedInPlayer, postJson } from './helpers.js';

const patch = (path, body, jwt) =>
  fetch(BASE_URL + path, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function teamWithMember(t) {
  const captain = await createLoggedInPlayer(t);
  const member = await createLoggedInPlayer(t);
  const created = await postJson('/teams/create', { name: 'Before Edit', description: 'Old words' }, captain.jwt);
  assert.equal(created.status, 201);
  const team = await created.json();
  await prisma.teamMember.create({
    data: { teamId: team.id, userId: member.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
  });
  return { team, captain, member };
}

const stored = (teamId) => prisma.team.findUnique({ where: { id: teamId } });

describe('The captain edits the team', () => {
  test('name and description are trimmed and saved; the reply is the team page shape', async (t) => {
    const { team, captain } = await teamWithMember(t);

    const res = await patch(`/teams/${team.id}`, { name: '  After Edit  ', description: '  New words  ' }, captain.jwt);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, team.id);
    assert.equal(body.name, 'After Edit');
    assert.equal(body.description, 'New words');
    assert.equal(body.viewerState, 'captain');
    assert.equal(body.memberCount, 2);
    assert.equal(body.maxMembers, 15);
    assert.ok(Array.isArray(body.members));
    assert.ok(Array.isArray(body.joinRequests));
    const row = await stored(team.id);
    assert.equal(row.name, 'After Edit');
    assert.equal(row.description, 'New words');
    assert.equal(row.captainId, captain.user.id, 'nothing else changes');
  });

  test('a missing, null or blank description removes it, as at create', async (t) => {
    const { team, captain } = await teamWithMember(t);

    for (const body of [{ name: 'No Desc' }, { name: 'No Desc', description: null }, { name: 'No Desc', description: '   ' }]) {
      await prisma.team.update({ where: { id: team.id }, data: { description: 'Something' } });
      const res = await patch(`/teams/${team.id}`, body, captain.jwt);
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal((await stored(team.id)).description, null, JSON.stringify(body));
    }
  });

  test('the same checks and messages as creating a team', async (t) => {
    const { team, captain } = await teamWithMember(t);

    const cases = [
      [{}, 'Team name is required'],
      [{ name: '   ' }, 'Team name is required'],
      [{ name: 123 }, 'Team name must be text'],
      [{ name: 'A' }, 'Team name must be between 2 and 40 characters'],
      [{ name: 'A'.repeat(41) }, 'Team name must be between 2 and 40 characters'],
      [{ name: 'Fine Name', description: 5 }, 'Description must be text'],
      [{ name: 'Fine Name', description: 'x'.repeat(201) }, 'Description must be at most 200 characters'],
    ];
    for (const [body, message] of cases) {
      const res = await patch(`/teams/${team.id}`, body, captain.jwt);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(await res.json(), { error: message }, JSON.stringify(body));
    }
    const row = await stored(team.id);
    assert.equal(row.name, 'Before Edit');
    assert.equal(row.description, 'Old words');
  });

  test('lengths count code points, like at create', async (t) => {
    const { team, captain } = await teamWithMember(t);
    const name = '\u{1F600}'.repeat(40);

    const res = await patch(`/teams/${team.id}`, { name }, captain.jwt);

    assert.equal(res.status, 200);
    assert.equal((await stored(team.id)).name, name);
  });
});

describe('Who can edit', () => {
  test('a member gets 403, and nothing changes', async (t) => {
    const { team, member } = await teamWithMember(t);

    const res = await patch(`/teams/${team.id}`, { name: 'Hijacked' }, member.jwt);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Only the team captain can edit this team.' });
    assert.equal((await stored(team.id)).name, 'Before Edit');
  });

  for (const role of ['OWNER', 'ADMIN']) {
    test(`a ${role} account gets the players-only 403`, async (t) => {
      const { team } = await teamWithMember(t);
      const account = await createLoggedInUser(t, { role });

      const res = await patch(`/teams/${team.id}`, { name: 'Hijacked' }, account.jwt);

      assert.equal(res.status, 403);
      assert.match((await res.json()).error, /only player accounts/i);
      assert.equal((await stored(team.id)).name, 'Before Edit');
    });
  }

  test('an unknown team gets 404', async (t) => {
    const player = await createLoggedInPlayer(t);

    const res = await patch('/teams/2147483647', { name: 'Fine Name' }, player.jwt);

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Team not found' });
  });
});
