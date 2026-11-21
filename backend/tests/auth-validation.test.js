// Tests the zod request checks on the /auth routes (src/validation/authSchemas.js):
// wrong types get 400 with a message (never 500), the limits added in Task 3.2, and
// unknown fields being ignored. The short sign-up forms of feature 2 (Terms, phone
// rule, position list) are tested in registration-short.test.js. Safety rules are in
// helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  OLD_PASSWORD,
  testEmail,
  deleteUserAfter,
  createTestUser,
  postJson,
  postForm,
  randomToken,
  sha256Hex,
  inOneHour,
  passwordIs,
} from './helpers.js';

const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
const PASSWORD_TOO_LONG =
  'Password must be at most 72 characters (emoji and non-English letters count as more than one)';

// Wrong-type values for a field that should be text.
const NOT_TEXT = [{ not: '' }, ['01712345678'], 12345, true];

const validPlayer = (overrides = {}, profile = {}) => ({
  email: testEmail(),
  password: 'Valid-pass-123!',
  role: 'PLAYER',
  name: 'Test Player',
  acceptedTerms: true,
  ...overrides,
  profileData: { phone: '01700000000', position: 'Forward', ...profile },
});

const validOwner = (overrides = {}, profile = {}) => ({
  email: testEmail(),
  password: 'Valid-pass-123!',
  role: 'OWNER',
  acceptedTerms: true,
  ...overrides,
  profileData: { indoorName: 'Test Arena', ...profile },
});

// Sends a registration, and deletes the account afterwards if one was made.
async function register(t, body) {
  if (typeof body.email === 'string') deleteUserAfter(t, body.email.trim().toLowerCase());
  const res = await postJson('/auth/register', body);
  return { status: res.status, body: await res.json() };
}

// A 400 with a short, non-empty `error` message, never a 500.
function assertClear400(reply, label) {
  assert.equal(reply.status, 400, `${label}: expected 400, got ${reply.status}`);
  assert.equal(typeof reply.body.error, 'string', `${label}: has an error message`);
  assert.ok(reply.body.error.length > 0, `${label}: the message isn't empty`);
}

// A real-looking email address of exactly `length` characters. It ends in .invalid, so
// the server never sends mail to it (sending fails at once; registration still succeeds).
function emailOfLength(length) {
  const local = 'a'.repeat(64);
  const tail = '.invalid';
  let domain = 'b';
  while (local.length + 1 + domain.length + tail.length < length) {
    domain += domain.length % 61 === 60 ? '.' : 'b'; // labels of at most 60 characters
  }
  const email = `${local}@${domain}${tail}`;
  assert.equal(email.length, length);
  return email;
}

describe('The three bodies that used to give 500 now get a clear 400', () => {
  test('profileData.phone as an array', async (t) => {
    const reply = await register(t, validPlayer({}, { phone: ['01712345678'] }));
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678');
  });

  test('name as an object', async (t) => {
    const reply = await register(t, validPlayer({ name: { first: 'A' } }));
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, 'Name must be text');
  });

  test('profileData.position as a number', async (t) => {
    const reply = await register(t, validPlayer({}, { position: 7 }));
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any');
  });
});

describe('Wrong types in every field get 400 with a message, never 500', () => {
  test('POST /auth/register, top-level fields', async (t) => {
    for (const field of ['email', 'password', 'role', 'name', 'profileData']) {
      for (const value of NOT_TEXT) {
        const body = { ...validPlayer(), [field]: value };
        assertClear400(await register(t, body), `${field} = ${JSON.stringify(value)}`);
      }
    }
  });

  test('POST /auth/register, player profile fields', async (t) => {
    for (const field of ['phone', 'position']) {
      for (const value of NOT_TEXT) {
        assertClear400(await register(t, validPlayer({}, { [field]: value })), `${field} = ${JSON.stringify(value)}`);
      }
    }
  });

  test('POST /auth/register, venue owner profile fields', async (t) => {
    for (const field of ['indoorName']) {
      for (const value of NOT_TEXT) {
        assertClear400(await register(t, validOwner({}, { [field]: value })), `${field} = ${JSON.stringify(value)}`);
      }
    }
  });

  test('POST /auth/register with no body, or a JSON array as the body', async (t) => {
    for (const body of [undefined, []]) {
      const res = await postJson('/auth/register', body);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, 'Email, password, role, and profileData are required');
    }
  });

  test('POST /auth/login: every wrong shape gets exactly "Invalid email or password"', async (t) => {
    const user = await createTestUser(t, { verified: true });
    const bodies = [
      ...NOT_TEXT.map((email) => ({ email, password: OLD_PASSWORD })),
      ...NOT_TEXT.map((password) => ({ email: user.email, password })),
      { email: user.email, password: '' },
      { email: '   ', password: OLD_PASSWORD },
      {},
      [],
      undefined,
    ];
    for (const body of bodies) {
      const res = await postJson('/auth/login', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(await res.json(), { error: 'Invalid email or password' });
    }
  });

  for (const path of ['/auth/forgot', '/auth/resend-verification']) {
    test(`POST ${path}: a wrong-type or missing email gets "Email is required"`, async () => {
      for (const body of [...NOT_TEXT.map((email) => ({ email })), { email: '  ' }, {}, [], undefined]) {
        const res = await postJson(path, body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.deepEqual(await res.json(), { error: 'Email is required' });
      }
    });

    test(`POST ${path}: no email-format check (an odd address gets the usual reply)`, async () => {
      const res = await postJson(path, { email: 'not-an-email' });
      assert.equal(res.status, 200);
    });
  }

  test('POST /auth/reset, both fields', async () => {
    for (const value of NOT_TEXT) {
      const badToken = await postJson('/auth/reset', { token: value, password: 'Valid-pass-123!' });
      assertClear400({ status: badToken.status, body: await badToken.json() }, `token = ${JSON.stringify(value)}`);
      const badPassword = await postJson('/auth/reset', { token: randomToken(), password: value });
      assertClear400({ status: badPassword.status, body: await badPassword.json() }, `password = ${JSON.stringify(value)}`);
    }
  });
});

describe('Register: new limits, each just inside and just outside', () => {
  // [description, body inside the limit, body outside it, the message for outside]
  const cases = [
    ['player name, 2 characters', validPlayer({ name: 'Al' }), validPlayer({ name: 'A' }), 'Name must be between 2 and 50 characters'],
    [
      'player name, 50 characters (Bangla letters count as one each)',
      validPlayer({ name: 'অ'.repeat(50) }),
      validPlayer({ name: 'অ'.repeat(51) }),
      'Name must be between 2 and 50 characters',
    ],
    [
      'venue name, 2 characters',
      validOwner({}, { indoorName: 'AB' }),
      validOwner({}, { indoorName: 'A' }),
      'Venue name must be between 2 and 60 characters',
    ],
    [
      'venue name, 60 characters',
      validOwner({}, { indoorName: 'v'.repeat(60) }),
      validOwner({}, { indoorName: 'v'.repeat(61) }),
      'Venue name must be between 2 and 60 characters',
    ],
    [
      'password, 72 bytes',
      validPlayer({ password: 'Aa1!' + 'a'.repeat(68) }),
      validPlayer({ password: 'Aa1!' + 'a'.repeat(69) }),
      PASSWORD_TOO_LONG,
    ],
    [
      'password, 72 bytes counted in bytes, not characters (26 characters, 3 bytes per Bangla letter)',
      validPlayer({ password: 'Aa1!' + 'অ'.repeat(22) + 'aa' }),
      validPlayer({ password: 'Aa1!' + 'অ'.repeat(22) + 'aaa' }),
      PASSWORD_TOO_LONG,
    ],
    [
      'email, 254 characters',
      validPlayer({ email: emailOfLength(254) }),
      validPlayer({ email: emailOfLength(255) }),
      'Email must be at most 254 characters',
    ],
  ];

  for (const [label, inside, outside, message] of cases) {
    test(label, async (t) => {
      const ok = await register(t, inside);
      assert.equal(ok.status, 201, `inside the limit: ${JSON.stringify(ok.body)}`);
      const refused = await register(t, outside);
      assert.equal(refused.status, 400);
      assert.equal(refused.body.error, message);
    });
  }

  test('an email that does not look like an email address is refused', async (t) => {
    for (const email of ['not-an-email', 'someone@', 'a b@example.com', 'someone@example']) {
      const reply = await register(t, validPlayer({ email }));
      assert.equal(reply.status, 400, email);
      assert.equal(reply.body.error, 'Please enter a valid email address');
    }
  });
});

describe('Register: unknown fields are ignored, values are cleaned', () => {
  test('extra fields (like the ones the app sends) are ignored, not stored and not rejected', async (t) => {
    const body = validPlayer(
      { verified: true, isAdmin: true, resetToken: 'x' },
      { name: 'Copy Of Name', extra: 'ignored' }
    );
    const reply = await register(t, body);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));

    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { playerProfile: true } });
    assert.equal(user.verified, false, 'verified can only change through the email link');
    assert.equal(user.resetToken, null);
    assert.equal(user.playerProfile.name, 'Test Player', 'the top-level name is the one stored');
  });

  test('a venue owner registration with a top-level name (as the app sends) works', async (t) => {
    const body = validOwner({ name: 'Test Arena' });
    const reply = await register(t, body);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
  });

  test('the player name is trimmed', async (t) => {
    const body = validPlayer({ name: '  Padded Name  ' });
    assert.equal((await register(t, body)).status, 201);

    const { playerProfile } = await prisma.user.findUnique({ where: { email: body.email }, include: { playerProfile: true } });
    assert.equal(playerProfile.name, 'Padded Name');
  });

  test('the venue name is trimmed', async (t) => {
    const body = validOwner({}, { indoorName: '  Spaced Arena ' });
    assert.equal((await register(t, body)).status, 201);

    const { ownerProfile } = await prisma.user.findUnique({ where: { email: body.email }, include: { ownerProfile: true } });
    assert.equal(ownerProfile.indoorName, 'Spaced Arena');
  });
});

describe('Reset: the 72-byte limit', () => {
  async function userWithResetLink(t) {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: sha256Hex(token), resetTokenExpires: inOneHour() });
    return { user, token };
  }

  test('72 bytes works (JSON)', async (t) => {
    const { user, token } = await userWithResetLink(t);
    const password = 'Aa1!' + 'a'.repeat(68);

    const res = await postJson('/auth/reset', { token, password });

    assert.equal(res.status, 200);
    assert.equal(await passwordIs(user.id, password), true);
  });

  test('73 bytes is refused (JSON), and nothing changes', async (t) => {
    const { user, token } = await userWithResetLink(t);

    const res = await postJson('/auth/reset', { token, password: 'Aa1!' + 'a'.repeat(69) });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: PASSWORD_TOO_LONG });
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, sha256Hex(token), 'the link still works');
  });

  test('73 bytes from the browser form gets an HTML page with "Try again"', async (t) => {
    const { user, token } = await userWithResetLink(t);
    const form = new URLSearchParams({ token, password: 'Aa1!' + 'a'.repeat(69) }).toString();

    const res = await postForm('/auth/reset', form);

    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const page = await res.text();
    assert.match(page, /at most 72 characters/);
    assert.match(page, /Try again/);
    assert.match(page, new RegExp(`/auth/reset-password-page\\?token=${token}`));
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true);
  });

  test('a weak password still gets the strength message (not the length one)', async (t) => {
    const { token } = await userWithResetLink(t);
    const res = await postJson('/auth/reset', { token, password: 'weak' });
    assert.deepEqual(await res.json(), { error: PASSWORD_RULE_MESSAGE });
  });
});
