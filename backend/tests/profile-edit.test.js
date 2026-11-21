// PATCH /players/me: a player's Edit profile (docs/features/profiles-and-registration.md,
// d endpoint 3). Every field is sent each time; empty optional fields clear. Safety rules
// are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, prisma, createLoggedInUser } from './helpers.js';

const PHONE_RULE = 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
const POSITION_RULE = 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any';

async function patchMe(jwt, body) {
  const res = await fetch(`${BASE_URL}/players/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function getJson(path, jwt) {
  const res = await fetch(BASE_URL + path, { headers: { Authorization: `Bearer ${jwt}` } });
  assert.equal(res.status, 200, `GET ${path}`);
  return res.json();
}

const player = (t) =>
  createLoggedInUser(t, {
    role: 'PLAYER',
    playerProfile: { create: { name: 'Before Edit', phone: '01712345678', position: 'Forward', height: 170, weight: 65 } },
  });

// A complete, valid edit body.
const edit = (overrides = {}) => ({
  name: 'After Edit',
  phone: '01898765432',
  position: 'Goalkeeper',
  height: 182,
  weight: 74.5,
  area: 'Dhanmondi 27',
  ...overrides,
});

const storedProfile = async (userId) => {
  const { name, phone, position, height, weight, area } = await prisma.playerProfile.findUnique({ where: { userId } });
  return { name, phone, position, height, weight, area };
};

describe('PATCH /players/me saves the profile', () => {
  test('every field is saved, and the reply has the GET /players/me shape', async (t) => {
    const me = await player(t);
    const reply = await patchMe(me.jwt, edit());
    assert.equal(reply.status, 200, JSON.stringify(reply.body));

    const expected = { name: 'After Edit', phone: '01898765432', position: 'Goalkeeper', height: 182, weight: 74.5, area: 'Dhanmondi 27' };
    assert.deepEqual(await storedProfile(me.user.id), expected);
    assert.deepEqual(reply.body, await getJson('/players/me', me.jwt));
    assert.deepEqual(reply.body.playerProfile, expected);
    assert.equal(reply.body.email, me.user.email);
  });

  test('null, "" or a missing optional field clears it', async (t) => {
    const me = await player(t);
    await patchMe(me.jwt, edit());
    assert.equal((await patchMe(me.jwt, edit({ height: null, weight: undefined, area: '' }))).status, 200);
    const stored = await storedProfile(me.user.id);
    assert.deepEqual([stored.height, stored.weight, stored.area], [null, null, null]);
  });

  test('the new name shows in GET /auth/me', async (t) => {
    const me = await player(t);
    await patchMe(me.jwt, edit({ name: 'Renamed Player' }));
    assert.equal((await getJson('/auth/me', me.jwt)).name, 'Renamed Player');
  });

  test('extra fields are ignored (the email and role can\'t be changed here)', async (t) => {
    const me = await player(t);
    const reply = await patchMe(me.jwt, edit({ email: 'someone-else@example.com', role: 'ADMIN', verified: false }));
    assert.equal(reply.status, 200);
    const user = await prisma.user.findUnique({ where: { id: me.user.id } });
    assert.equal(user.email, me.user.email);
    assert.equal(user.role, 'PLAYER');
    assert.equal(user.verified, true);
  });
});

describe('Area', () => {
  test('spaces are tidied and the letters stay as typed', async (t) => {
    const me = await player(t);
    await patchMe(me.jwt, edit({ area: '  dhanmondi \t  27\n DOHS ' }));
    assert.equal((await storedProfile(me.user.id)).area, 'dhanmondi 27 DOHS');
  });

  test('only spaces become empty', async (t) => {
    const me = await player(t);
    await patchMe(me.jwt, edit({ area: '    ' }));
    assert.equal((await storedProfile(me.user.id)).area, null);
  });

  test('2 to 40 characters after tidying, counted in code points (Bangla letters count as one)', async (t) => {
    const me = await player(t);
    for (const ok of ['Ab', 'a'.repeat(40), 'মিরপুর'.padEnd(40, 'র'), ' Ab ']) {
      assert.equal((await patchMe(me.jwt, edit({ area: ok }))).status, 200, ok);
    }
    for (const bad of ['A', ' A ', 'a'.repeat(41), 'র'.repeat(41)]) {
      const reply = await patchMe(me.jwt, edit({ area: bad }));
      assert.equal(reply.status, 400, bad);
      assert.equal(reply.body.error, 'Area must be between 2 and 40 characters');
    }
  });

  test('a non-text area is refused', async (t) => {
    const me = await player(t);
    for (const bad of [12, { not: '' }, ['Mirpur'], true]) {
      const reply = await patchMe(me.jwt, edit({ area: bad }));
      assert.equal(reply.body.error, 'Area must be text', JSON.stringify(bad));
    }
  });
});

describe('Every field has its message', () => {
  const cases = [
    // [label, body, message]
    ['missing name', edit({ name: undefined }), 'Name is required'],
    ['blank name', edit({ name: '   ' }), 'Name is required'],
    ['name not text', edit({ name: 42 }), 'Name must be text'],
    ['name of 1 character', edit({ name: 'A' }), 'Name must be between 2 and 50 characters'],
    ['name of 51 characters', edit({ name: 'n'.repeat(51) }), 'Name must be between 2 and 50 characters'],
    ['missing phone', edit({ phone: undefined }), 'Phone number is required'],
    ['blank phone', edit({ phone: '' }), 'Phone number is required'],
    ['phone not a mobile number', edit({ phone: '01212345678' }), PHONE_RULE],
    ['phone as a number', edit({ phone: 1712345678 }), PHONE_RULE],
    ['missing position', edit({ position: undefined }), 'Position is required'],
    ['position not in the list', edit({ position: 'Pivot' }), POSITION_RULE],
    ['height as text', edit({ height: '180' }), 'Height must be a number'],
    ['height out of range', edit({ height: 99 }), 'Height must be between 100 and 250 cm'],
    ['weight as text', edit({ weight: '70' }), 'Weight must be a number'],
    ['weight out of range', edit({ weight: 201 }), 'Weight must be between 30 and 200 kg'],
  ];

  for (const [label, body, message] of cases) {
    test(label, async (t) => {
      const me = await player(t);
      const reply = await patchMe(me.jwt, body);
      assert.equal(reply.status, 400);
      assert.equal(reply.body.error, message);
      assert.equal((await storedProfile(me.user.id)).name, 'Before Edit', 'nothing changed');
    });
  }

  test('several problems: the first field in order wins (name, then phone)', async (t) => {
    const me = await player(t);
    const reply = await patchMe(me.jwt, edit({ name: 'A', phone: '1' }));
    assert.equal(reply.body.error, 'Name must be between 2 and 50 characters');
  });
});

describe('Only players', () => {
  test('a venue owner and the admin get 403 "Players only", even with a bad body', async (t) => {
    const owner = await createLoggedInUser(t, { role: 'OWNER', ownerProfile: { create: { indoorName: 'Not A Player' } } });
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    for (const someone of [owner, admin]) {
      for (const body of [edit(), {}]) {
        const reply = await patchMe(someone.jwt, body);
        assert.equal(reply.status, 403);
        assert.equal(reply.body.error, 'Players only');
      }
    }
  });

  test('no token gets 401', async () => {
    const res = await fetch(`${BASE_URL}/players/me`, { method: 'PATCH', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(res.status, 401);
  });

  test('a player without a profile gets 404', async (t) => {
    const bare = await createLoggedInUser(t, { role: 'PLAYER' });
    const reply = await patchMe(bare.jwt, edit());
    assert.equal(reply.status, 404);
    assert.equal(reply.body.error, 'Player profile not found');
  });
});
