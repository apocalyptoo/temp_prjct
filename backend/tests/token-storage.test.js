// Tests for Phase 1 item 10: tokens are stored only as SHA-256 hashes, verification
// links expire after 24 hours, and the verify link checks the token format first.
// Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma, NEW_PASSWORD, testEmail, deleteUserAfter, createTestUser, randomToken,
  inOneHour, inOneDay, sha256Hex, postJson, getWithIp, passwordIs, OLD_PASSWORD,
} from './helpers.js';

const HOUR = 60 * 60 * 1000;

describe('hashToken', () => {
  test('matches SHA-256 hex, and the SQL used by the migration gives the same result', async () => {
    const { hashToken } = await import('../src/utils/tokens.js');
    const token = randomToken();

    // The exact expression from migrations/*_hash_tokens_verify_expiry/migration.sql
    const [row] = await prisma.$queryRaw`SELECT encode(sha256(convert_to(${token}, 'UTF8')), 'hex') AS hash`;

    assert.equal(hashToken(token), sha256Hex(token));
    assert.equal(hashToken(token), row.hash);
  });
});

describe('The database stores only hashes', () => {
  test('registration stores a hashed verification token that expires in 24 hours', async (t) => {
    const email = testEmail();
    deleteUserAfter(t, email);

    const res = await postJson('/auth/register', {
      name: 'Test Player', email, password: 'Valid-pass-123!', role: 'PLAYER',
      profileData: { phone: '01700000000', position: 'Forward' },
    });
    assert.equal(res.status, 201);

    const user = await prisma.user.findUnique({ where: { email } });
    assert.match(user.verifyToken, /^[0-9a-f]{64}$/);
    const hoursLeft = (user.verifyTokenExpires - Date.now()) / HOUR;
    // About 24 hours (within a minute: the server and the test read the clock separately).
    assert.ok(Math.abs(hoursLeft - 24) < 1 / 60, `expiry should be 24 hours away, was ${hoursLeft.toFixed(4)}`);

    // The stored value must not work as a link: it's the hash, not the token.
    const usingStored = await getWithIp(`/auth/verify?token=${user.verifyToken}`);
    assert.equal(usingStored.status, 400, 'the value in the database must not be a working link');
    assert.equal((await prisma.user.findUnique({ where: { email } })).verified, false);
  });

  test('forgot-password stores a hashed reset token: the stored value is not a working link', async (t) => {
    const user = await createTestUser(t, { verified: true });

    await postJson('/auth/forgot', { email: user.email });
    const stored = (await prisma.user.findUnique({ where: { id: user.id } })).resetToken;
    assert.match(stored, /^[0-9a-f]{64}$/);

    const res = await postJson('/auth/reset', { token: stored, password: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(await passwordIs(user.id, OLD_PASSWORD), true, 'the password must not change');
  });

  test('a reset link works when the database holds its hash', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { resetToken: sha256Hex(token), resetTokenExpires: inOneHour() });

    const res = await postJson('/auth/reset', { token, password: NEW_PASSWORD });

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.resetToken, null);
    assert.equal(after.resetTokenExpires, null);
  });
});

describe('Verification links', () => {
  test('a valid link verifies the account and clears the token and its expiry', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, { verified: false, verifyToken: sha256Hex(token), verifyTokenExpires: inOneDay() });

    const res = await getWithIp(`/auth/verify?token=${token}`);

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after.verified, true);
    assert.equal(after.verifyToken, null);
    assert.equal(after.verifyTokenExpires, null);
  });

  test('a link older than 24 hours shows the invalid page with a hint to request a new email', async (t) => {
    const token = randomToken();
    const user = await createTestUser(t, {
      verified: false, verifyToken: sha256Hex(token), verifyTokenExpires: new Date(Date.now() - 1000),
    });

    const res = await getWithIp(`/auth/verify?token=${token}`);
    const body = await res.text();

    assert.equal(res.status, 400);
    assert.match(body, /invalid or expired/i);
    assert.match(body, /login screen/i, 'should say where to get a new email');
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).verified, false);
  });

  test('a badly formed token is refused before the database is checked', async (t) => {
    // An old-style token that isn't 64 hex characters, stored so a plain lookup
    // would find it. The format check must refuse it without looking it up.
    const legacy = 'not-a-real-token';
    const user = await createTestUser(t, { verified: false, verifyToken: legacy, verifyTokenExpires: inOneDay() });

    const res = await getWithIp(`/auth/verify?token=${legacy}`);

    assert.equal(res.status, 400);
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).verified, false);
  });
});
