// Tests that login, forgot-password and register only accept a non-empty string
// as the email (docs/ROADMAP.md, Phase 1). Safety rules are in helpers.js.
//
// An object email such as {"not": ""} must never reach Prisma, where it would be
// read as a query operator. (Checked beforehand: Prisma rejects objects in these
// lookups with an error, so these tests can't match a real user even on the
// unfixed server. They just get a 500.)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, OLD_PASSWORD, testEmail, deleteUserAfter, createTestUser, postJson } from './helpers.js';

const BAD_EMAILS = [
  ['an object (operator injection)', { not: '' }],
  ['an array', ['someone@example.com']],
  ['a number', 12345],
  ['an empty string', ''],
  ['missing', undefined],
];

const validPlayer = (email) => ({
  name: 'Test Player',
  email,
  password: 'Valid-pass-123!',
  role: 'PLAYER',
  profileData: { phone: '01700000000', position: 'Forward' },
  acceptedTerms: true,
});

describe('POST /auth/login', () => {
  test('a normal login still works', async (t) => {
    const user = await createTestUser(t, { verified: true });

    const res = await postJson('/auth/login', { email: user.email, password: OLD_PASSWORD });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.token, 'string');
    assert.equal(body.user.id, user.id);
  });

  for (const [label, email] of BAD_EMAILS) {
    test(`rejects an email that is ${label}`, async () => {
      const res = await postJson('/auth/login', { email, password: OLD_PASSWORD });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'Invalid email or password');
    });
  }
});

describe('POST /auth/forgot', () => {
  test('a normal request still sets a reset token', async (t) => {
    const user = await createTestUser(t, { verified: true });

    const res = await postJson('/auth/forgot', { email: user.email });

    assert.equal(res.status, 200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(typeof after.resetToken, 'string');
    assert.ok(after.resetTokenExpires > new Date());
  });

  test('an unknown email gets the same reply as a known one', async () => {
    const res = await postJson('/auth/forgot', { email: testEmail() });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.message, 'If that email exists, a reset link was sent.');
  });

  for (const [label, email] of BAD_EMAILS) {
    test(`rejects an email that is ${label}`, async () => {
      const res = await postJson('/auth/forgot', { email });

      assert.equal(res.status, 400);
    });
  }
});

describe('POST /auth/register', () => {
  test('a normal registration still works', async (t) => {
    const email = testEmail();
    deleteUserAfter(t, email);

    const res = await postJson('/auth/register', validPlayer(email));

    assert.equal(res.status, 201);
    const created = await prisma.user.findUnique({ where: { email }, include: { playerProfile: true } });
    assert.ok(created, 'user should exist');
    assert.equal(created.verified, false);
    assert.equal(created.playerProfile.name, 'Test Player');
  });

  for (const [label, email] of BAD_EMAILS) {
    test(`rejects an email that is ${label}`, async () => {
      const res = await postJson('/auth/register', validPlayer(email));

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'Email, password, role, and profileData are required');
    });
  }
});
