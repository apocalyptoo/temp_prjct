// The short sign-up forms of feature 2 (docs/features/profiles-and-registration.md,
// d endpoint 1): the Terms checkbox, the Bangladeshi mobile number rule, the position
// list, and the old long-form fields being ignored. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, testEmail, deleteUserAfter, postJson } from './helpers.js';

const PHONE_RULE = 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
const POSITION_RULE = 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any';
const PLAYER_REQUIRED = 'PLAYER profile requires phone and position';
const TERMS_REQUIRED = 'Please accept the Terms of Use and Privacy Policy';

const player = (overrides = {}, profile = {}) => ({
  email: testEmail(),
  password: 'Valid-pass-123!',
  role: 'PLAYER',
  name: 'Short Form',
  acceptedTerms: true,
  ...overrides,
  profileData: { phone: '01712345678', position: 'Forward', ...profile },
});

const owner = (overrides = {}, profile = {}) => ({
  email: testEmail(),
  password: 'Valid-pass-123!',
  role: 'OWNER',
  acceptedTerms: true,
  ...overrides,
  profileData: { indoorName: 'Short Arena', ...profile },
});

// Sends a registration, and deletes the account afterwards if one was made.
async function register(t, body) {
  deleteUserAfter(t, body.email);
  const res = await postJson('/auth/register', body);
  return { status: res.status, body: await res.json() };
}

const stored = (email) =>
  prisma.user.findUnique({ where: { email }, include: { playerProfile: true, ownerProfile: true } });

// True when `date` is within a minute of now (the server and the test run on one PC).
const isAboutNow = (date) => date instanceof Date && Math.abs(Date.now() - date.getTime()) < 60_000;

describe('The short forms create the right rows', () => {
  test('a player gets name, phone and position; the rest stays empty; the Terms date is set', async (t) => {
    const body = player();
    const reply = await register(t, body);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));

    const user = await stored(body.email);
    assert.ok(isAboutNow(user.termsAcceptedAt), 'termsAcceptedAt is the moment of sign-up');
    const { name, phone, position, height, weight, area } = user.playerProfile;
    assert.deepEqual({ name, phone, position, height, weight, area }, {
      name: 'Short Form',
      phone: '01712345678',
      position: 'Forward',
      height: null,
      weight: null,
      area: null,
    });
  });

  test('a venue owner gets only the venue name; phone, address, description and website stay empty', async (t) => {
    const body = owner();
    const reply = await register(t, body);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));

    const user = await stored(body.email);
    assert.ok(isAboutNow(user.termsAcceptedAt));
    const { indoorName, phone, address, description, website } = user.ownerProfile;
    assert.deepEqual(
      { indoorName, phone, address, description, website },
      { indoorName: 'Short Arena', phone: null, address: null, description: null, website: null },
    );
  });

  test('fields the short forms no longer have are ignored, not stored', async (t) => {
    const playerBody = player({}, { height: 180, weight: 70, address: 'House 1, Road 2', area: 'Mirpur' });
    assert.equal((await register(t, playerBody)).status, 201);
    const { playerProfile } = await stored(playerBody.email);
    assert.deepEqual([playerProfile.height, playerProfile.weight, playerProfile.area], [null, null, null]);

    const ownerBody = owner({}, { phone: '01812345678', address: 'Road 1', description: 'Nice', website: 'https://x.com' });
    assert.equal((await register(t, ownerBody)).status, 201);
    const { ownerProfile } = await stored(ownerBody.email);
    assert.deepEqual(
      [ownerProfile.phone, ownerProfile.address, ownerProfile.description, ownerProfile.website],
      [null, null, null, null],
    );
  });

  test('a venue owner with no venue name gets "Venue name is required"', async (t) => {
    for (const profileData of [{}, { indoorName: '' }, { indoorName: '   ' }]) {
      const reply = await register(t, { ...owner(), profileData });
      assert.equal(reply.status, 400, JSON.stringify(profileData));
      assert.equal(reply.body.error, 'Venue name is required');
    }
  });
});

describe('The Terms checkbox', () => {
  test('acceptedTerms must be exactly true', async (t) => {
    for (const acceptedTerms of [undefined, false, 'true', 1, null]) {
      for (const body of [player({ acceptedTerms }), owner({ acceptedTerms })]) {
        const reply = await register(t, body);
        assert.equal(reply.status, 400, `${body.role} acceptedTerms = ${JSON.stringify(acceptedTerms)}`);
        assert.equal(reply.body.error, TERMS_REQUIRED);
        assert.equal(await stored(body.email), null, 'no account is made');
      }
    }
  });

  test('it is checked last: a bad phone and no Terms gives the phone message', async (t) => {
    const reply = await register(t, player({ acceptedTerms: false }, { phone: '12345678901' }));
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, PHONE_RULE);
  });
});

describe('The position list', () => {
  for (const value of ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any']) {
    test(`"${value}" is accepted and stored as it is`, async (t) => {
      const body = player({}, { position: value });
      assert.equal((await register(t, body)).status, 201);
      assert.equal((await stored(body.email)).playerProfile.position, value);
    });
  }

  test('anything else is refused, including other spellings and futsal terms', async (t) => {
    for (const value of ['Pivot', 'forward', 'FORWARD', ' Forward ', 'Striker']) {
      const reply = await register(t, player({}, { position: value }));
      assert.equal(reply.status, 400, value);
      assert.equal(reply.body.error, POSITION_RULE, value);
    }
  });

  test('a missing or empty position gets the "requires" message', async (t) => {
    for (const value of [undefined, '']) {
      const reply = await register(t, player({}, { position: value }));
      assert.equal(reply.body.error, PLAYER_REQUIRED, JSON.stringify(value));
    }
  });
});

describe('The phone number rule (Bangladeshi mobile)', () => {
  test('01, then 3–9, then 8 more digits is accepted', async (t) => {
    for (const phone of ['01312345678', '01712345678', '01912345678']) {
      assert.equal((await register(t, player({}, { phone }))).status, 201, phone);
    }
  });

  test('spaces at both ends are trimmed before storing', async (t) => {
    const body = player({}, { phone: '  01812345678 ' });
    assert.equal((await register(t, body)).status, 201);
    assert.equal((await stored(body.email)).playerProfile.phone, '01812345678');
  });

  test('anything else gets the rule message', async (t) => {
    const bad = [
      '01212345678', // third digit 2
      '01012345678', // third digit 0
      '0171234567', // 10 digits
      '017123456789', // 12 digits
      '+8801712345678',
      '8801712345678',
      '01712 345678', // a space inside
      '01712-345678', // a dash inside
      '0171234567a',
      '12345678901',
    ];
    for (const phone of bad) {
      const reply = await register(t, player({}, { phone }));
      assert.equal(reply.status, 400, phone);
      assert.equal(reply.body.error, PHONE_RULE, phone);
    }
  });

  test('a missing or blank phone gets the "requires" message', async (t) => {
    for (const phone of [undefined, '', '   ']) {
      const reply = await register(t, player({}, { phone }));
      assert.equal(reply.body.error, PLAYER_REQUIRED, JSON.stringify(phone));
    }
  });
});
