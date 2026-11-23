// The search behind Invite players (GET /teams/:teamId/invite-candidates;
// docs/features/explore.md, d endpoint 7): captain only; the players the captain could
// find in Explore, minus everyone who already has a row in the team; the same filters
// and rows as GET /players. Paging itself is tested in list-paging.test.js.
// Safety rules are in helpers.js. All users and teams here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BASE_URL, prisma, createLoggedInUser, createTestUser } from './helpers.js';

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  return { status: res.status, body: await res.json() };
}

const uniqueWord = () => `Zi${crypto.randomBytes(4).toString('hex')}`;
const names = (reply) => reply.body.items.map((player) => player.name);

const profile = (name, extra = {}) => ({
  playerProfile: { create: { name, phone: '01712345678', position: 'Any', ...extra } },
});
const listedPlayer = (t, name, extra = {}) => createTestUser(t, { verified: true, ...profile(name, extra) });
const loggedInPlayer = (t, name) => createLoggedInUser(t, { role: 'PLAYER', ...profile(name) });

const addRow = (teamId, userId, status, origin) =>
  prisma.teamMember.create({
    data: { teamId, userId, status, origin, acceptedAt: status === 'accepted' ? new Date() : null },
  });

// A captain (whose name contains the word, so a search for it would find them if they
// weren't left out) with a team.
async function captainWithTeam(t, word) {
  const captain = await loggedInPlayer(t, `${word} Captain`);
  const team = await prisma.team.create({
    data: {
      name: `${word} FC`,
      captainId: captain.user.id,
      members: { create: { userId: captain.user.id, status: 'accepted', origin: 'creator', acceptedAt: new Date() } },
    },
  });
  const path = (params = {}) => `/teams/${team.id}/invite-candidates?${new URLSearchParams({ search: word, limit: '50', ...params })}`;
  return { captain, team, path };
}

describe('GET /teams/:teamId/invite-candidates: who is listed', () => {
  test('everyone with a row in the team is left out: the captain, members, invited players and requesters', async (t) => {
    const word = uniqueWord();
    const { captain, team, path } = await captainWithTeam(t, word);
    const member = await listedPlayer(t, `${word} Member`);
    const invited = await listedPlayer(t, `${word} Invited`);
    const requester = await listedPlayer(t, `${word} Requester`);
    const free = await listedPlayer(t, `${word} Free`, { position: 'Goalkeeper', area: 'Mirpur 10' });
    await addRow(team.id, member.id, 'accepted', 'invite');
    await addRow(team.id, invited.id, 'pending', 'invite');
    await addRow(team.id, requester.id, 'pending', 'request');
    // In another team, the same people are still candidates.
    const other = await prisma.team.create({ data: { name: `${word} Other`, captainId: captain.user.id } });
    await addRow(other.id, free.id, 'accepted', 'invite');

    const reply = await getJson(path(), captain.jwt);

    assert.equal(reply.status, 200);
    assert.equal(reply.body.total, 1);
    assert.deepEqual(reply.body.items, [
      {
        id: free.id,
        createdAt: free.createdAt.toISOString(),
        name: `${word} Free`,
        playerProfile: { name: `${word} Free`, position: 'Goalkeeper', area: 'Mirpur 10' },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(reply.body), /email|example\.com|phone|01712345678/);
  });

  test('unverified players and accounts that are not players are left out, as in Explore', async (t) => {
    const word = uniqueWord();
    const { captain, path } = await captainWithTeam(t, word);
    await createTestUser(t, { verified: false, ...profile(`${word} Unverified`) });
    await createTestUser(t, { role: 'OWNER', verified: true, ownerProfile: { create: { indoorName: `${word} Arena` } } });
    await createTestUser(t, { role: 'PLAYER', verified: true });
    await listedPlayer(t, `${word} Findable`);

    assert.deepEqual(names(await getJson(path(), captain.jwt)), [`${word} Findable`]);
  });

  test('the same filters as the player list: name, area and position, all together', async (t) => {
    const word = uniqueWord();
    const { captain, path } = await captainWithTeam(t, word);
    await listedPlayer(t, `${word} Nayeem`, { position: 'Goalkeeper', area: 'Mirpur 10' });
    await listedPlayer(t, `${word} Nasir`, { position: 'Goalkeeper', area: 'Uttara' });
    await listedPlayer(t, `${word} Nabil`, { position: 'Defender', area: 'Mirpur 12' });

    assert.deepEqual(names(await getJson(path(), captain.jwt)), [`${word} Nabil`, `${word} Nasir`, `${word} Nayeem`], 'by name');
    assert.deepEqual(names(await getJson(path({ position: 'Goalkeeper' }), captain.jwt)), [`${word} Nasir`, `${word} Nayeem`]);
    assert.deepEqual(names(await getJson(path({ area: ' MIRPUR ' }), captain.jwt)), [`${word} Nabil`, `${word} Nayeem`]);
    assert.deepEqual(names(await getJson(path({ search: `${word} na`, area: 'mirpur', position: 'Goalkeeper' }), captain.jwt)), [`${word} Nayeem`]);

    const bad = await getJson(path({ position: 'Pivot' }), captain.jwt);
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body, { error: 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any' });
  });

  test('a full team still gets its list (the invite itself is what gets refused)', async (t) => {
    const word = uniqueWord();
    const { captain, team, path } = await captainWithTeam(t, word);
    for (let n = 1; n < 15; n += 1) {
      const filler = await createTestUser(t);
      await addRow(team.id, filler.id, 'accepted', 'invite');
    }
    await listedPlayer(t, `${word} Latecomer`);

    assert.deepEqual(names(await getJson(path(), captain.jwt)), [`${word} Latecomer`]);
  });
});

describe('GET /teams/:teamId/invite-candidates: who may ask', () => {
  test('a member who is not the captain gets 403', async (t) => {
    const word = uniqueWord();
    const { team, path } = await captainWithTeam(t, word);
    const member = await loggedInPlayer(t, `${word} Member`);
    await addRow(team.id, member.user.id, 'accepted', 'invite');
    const stranger = await loggedInPlayer(t, `${word} Stranger`);

    for (const asker of [member, stranger]) {
      const reply = await getJson(path(), asker.jwt);
      assert.equal(reply.status, 403);
      assert.deepEqual(reply.body, { error: 'Only the team captain can invite players.' });
    }
  });

  for (const role of ['OWNER', 'ADMIN']) {
    test(`a ${role} account gets the players-only 403`, async (t) => {
      const { path } = await captainWithTeam(t, uniqueWord());
      const account = await createLoggedInUser(t, { role });

      const reply = await getJson(path(), account.jwt);

      assert.equal(reply.status, 403);
      assert.match(reply.body.error, /only player accounts/i);
    });
  }

  test('an unknown team is 404, a bad id 400, and no login 401', async (t) => {
    const player = await loggedInPlayer(t, 'Asker');

    const unknown = await getJson('/teams/2147483647/invite-candidates', player.jwt);
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { error: 'Team not found' });

    for (const id of ['abc', '0', '1.5', '99999999999']) {
      const bad = await getJson(`/teams/${id}/invite-candidates`, player.jwt);
      assert.equal(bad.status, 400, id);
      assert.deepEqual(bad.body, { error: 'Invalid team id' });
    }

    const res = await fetch(`${BASE_URL}/teams/1/invite-candidates`);
    assert.equal(res.status, 401);
  });
});
