// Tests for the team's area (docs/features/explore.md, d endpoints 2–4; docs/PRODUCT.md,
// "Team area"): the captain sets it when creating or editing the team, with exactly the
// player Area rules, and the team carries it in the team replies. Safety rules are in
// helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, BASE_URL, createLoggedInPlayer, postJson } from './helpers.js';

const patch = (path, body, jwt) =>
  fetch(BASE_URL + path, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const getJson = async (path, jwt) => {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, path);
  return res.json();
};

async function createTeam(captain, body) {
  const res = await postJson('/teams/create', body, captain.jwt);
  assert.equal(res.status, 201, JSON.stringify(body));
  return res.json();
}

const storedArea = async (teamId) => (await prisma.team.findUnique({ where: { id: teamId } })).area;

describe('Creating a team with an area', () => {
  test('the area is tidied, stored and in the reply', async (t) => {
    const captain = await createLoggedInPlayer(t);

    const team = await createTeam(captain, { name: 'Area FC', area: '  mirpur   10 ' });

    assert.equal(team.area, 'mirpur 10', 'ends trimmed, inner spaces made one, letters as typed');
    assert.equal(await storedArea(team.id), 'mirpur 10');
  });

  test('a missing, null or blank area means no area', async (t) => {
    const captain = await createLoggedInPlayer(t);

    for (const body of [{ name: 'No Area' }, { name: 'No Area', area: null }, { name: 'No Area', area: '' }, { name: 'No Area', area: '  \n ' }]) {
      const team = await createTeam(captain, body);
      assert.equal(team.area, null, JSON.stringify(body));
      assert.equal(await storedArea(team.id), null, JSON.stringify(body));
    }
  });

  test('the player Area rules and messages apply, after the name and description', async (t) => {
    const captain = await createLoggedInPlayer(t);

    const cases = [
      [{ name: 'Fine Name', area: 7 }, 'Area must be text'],
      [{ name: 'Fine Name', area: ['Mirpur'] }, 'Area must be text'],
      [{ name: 'Fine Name', area: { contains: 'M' } }, 'Area must be text'],
      [{ name: 'Fine Name', area: 'M' }, 'Area must be between 2 and 40 characters'],
      [{ name: 'Fine Name', area: 'M'.repeat(41) }, 'Area must be between 2 and 40 characters'],
      // The first problem wins: name, then description, then area.
      [{ name: 'A', description: 5, area: 7 }, 'Team name must be between 2 and 40 characters'],
      [{ name: 'Fine Name', description: 5, area: 7 }, 'Description must be text'],
    ];
    for (const [body, message] of cases) {
      const res = await postJson('/teams/create', body, captain.jwt);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(await res.json(), { error: message }, JSON.stringify(body));
    }
    assert.equal(await prisma.team.count({ where: { captainId: captain.user.id } }), 0, 'no team was created');
  });

  test('40 Bangla letters fit: the limit counts characters, not bytes', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const area = 'ঢ'.repeat(40);

    const team = await createTeam(captain, { name: 'Bangla Area', area });

    assert.equal(team.area, area);
  });
});

describe('Editing the area', () => {
  test('the captain sets, changes and clears it; the reply is the team page with the area', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await createTeam(captain, { name: 'Edit Area', description: 'Words' });

    const set = await patch(`/teams/${team.id}`, { name: 'Edit Area', description: 'Words', area: ' Dhanmondi  27' }, captain.jwt);
    assert.equal(set.status, 200);
    const body = await set.json();
    assert.equal(body.area, 'Dhanmondi 27');
    assert.equal(body.viewerState, 'captain', 'still the team page shape');
    assert.equal(await storedArea(team.id), 'Dhanmondi 27');

    // The app sends every field each time: leaving the area out clears it, like the
    // description (spec P12).
    for (const cleared of [{ name: 'Edit Area' }, { name: 'Edit Area', area: null }, { name: 'Edit Area', area: '   ' }]) {
      await prisma.team.update({ where: { id: team.id }, data: { area: 'Uttara' } });
      const res = await patch(`/teams/${team.id}`, cleared, captain.jwt);
      assert.equal(res.status, 200, JSON.stringify(cleared));
      assert.equal((await res.json()).area, null, JSON.stringify(cleared));
      assert.equal(await storedArea(team.id), null, JSON.stringify(cleared));
    }
  });

  test('a bad area is refused with the same messages, and nothing changes', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const team = await createTeam(captain, { name: 'Keep Area', area: 'Banani' });

    for (const [area, message] of [
      [5, 'Area must be text'],
      ['B', 'Area must be between 2 and 40 characters'],
      ['B'.repeat(41), 'Area must be between 2 and 40 characters'],
    ]) {
      const res = await patch(`/teams/${team.id}`, { name: 'Changed', area }, captain.jwt);
      assert.equal(res.status, 400, String(area));
      assert.deepEqual(await res.json(), { error: message });
    }
    const row = await prisma.team.findUnique({ where: { id: team.id } });
    assert.equal(row.name, 'Keep Area');
    assert.equal(row.area, 'Banani');
  });

  test("a member can't change the area", async (t) => {
    const captain = await createLoggedInPlayer(t);
    const member = await createLoggedInPlayer(t);
    const team = await createTeam(captain, { name: 'Not Yours', area: 'Banani' });
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: member.user.id, status: 'accepted', origin: 'invite', acceptedAt: new Date() },
    });

    const res = await patch(`/teams/${team.id}`, { name: 'Not Yours', area: 'Gulshan' }, member.jwt);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'Only the team captain can edit this team.' });
    assert.equal(await storedArea(team.id), 'Banani');
  });
});

describe('The area in team replies', () => {
  test('GET /teams/:teamId, GET /teams/me and the invites on GET /notifications carry it', async (t) => {
    const captain = await createLoggedInPlayer(t);
    const invited = await createLoggedInPlayer(t);
    const withArea = await createTeam(captain, { name: 'Has Area', area: 'Mirpur' });
    const without = await createTeam(captain, { name: 'No Area Yet' });
    for (const team of [withArea, without]) {
      const res = await postJson(`/teams/${team.id}/invite`, { userId: invited.user.id }, captain.jwt);
      assert.equal(res.status, 201);
    }

    assert.equal((await getJson(`/teams/${withArea.id}`, invited.jwt)).area, 'Mirpur');
    assert.equal((await getJson(`/teams/${without.id}`, invited.jwt)).area, null);

    const mine = await getJson('/teams/me', captain.jwt);
    assert.equal(mine.find((team) => team.id === withArea.id).area, 'Mirpur');
    assert.equal(mine.find((team) => team.id === without.id).area, null);

    const { invites } = (await getJson('/notifications', invited.jwt)).needsAction;
    assert.equal(invites.find((invite) => invite.teamId === withArea.id).team.area, 'Mirpur');
    assert.equal(invites.find((invite) => invite.teamId === without.id).team.area, null);
  });
});
