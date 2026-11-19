// Tests for scripts/createAdmin.js (Phase 1 item 4). The script runs as a separate
// process with ADMIN_EMAIL and ADMIN_PASSWORD set for that run only (values already
// in the environment win over backend/.env). Only throwaway emails are used, and the
// real admin account is never changed. Safety rules are in helpers.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prisma, testEmail, deleteUserAfter, createTestUser, passwordIs } from './helpers.js';

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const STRONG_PASSWORD = 'Admin-test-789!';

// Runs the script and returns its exit code and everything it printed.
async function runCreateAdmin(env) {
  try {
    const { stdout, stderr } = await promisify(execFile)('node', ['scripts/createAdmin.js'], {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env },
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    return { code: error.code ?? 1, output: (error.stdout ?? '') + (error.stderr ?? '') };
  }
}

describe('scripts/createAdmin.js', () => {
  test('refuses to run when ADMIN_EMAIL or ADMIN_PASSWORD is missing', async () => {
    // An empty value stops dotenv from filling it in from backend/.env.
    const noEmail = await runCreateAdmin({ ADMIN_EMAIL: '', ADMIN_PASSWORD: STRONG_PASSWORD });
    const noPassword = await runCreateAdmin({ ADMIN_EMAIL: testEmail(), ADMIN_PASSWORD: '' });

    assert.notEqual(noEmail.code, 0);
    assert.match(noEmail.output, /ADMIN_EMAIL/);
    assert.notEqual(noPassword.code, 0);
    assert.match(noPassword.output, /ADMIN_PASSWORD/);
  });

  test('refuses a password that fails the registration strength rule', async (t) => {
    const email = testEmail();
    deleteUserAfter(t, email);

    const result = await runCreateAdmin({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'weakpassword' });

    assert.notEqual(result.code, 0);
    assert.equal(result.output.includes('weakpassword'), false, 'must never print the password');
    assert.equal(await prisma.user.findUnique({ where: { email } }), null);
  });

  test('changes the password of an existing admin with that email', async (t) => {
    const admin = await createTestUser(t, { role: 'ADMIN', verified: true });

    const result = await runCreateAdmin({ ADMIN_EMAIL: admin.email, ADMIN_PASSWORD: STRONG_PASSWORD });

    assert.equal(result.code, 0, result.output);
    assert.equal(await passwordIs(admin.id, STRONG_PASSWORD), true);
    assert.equal(result.output.includes(STRONG_PASSWORD), false, 'must never print the password');
  });

  test('finds the existing admin when ADMIN_EMAIL has capitals and spaces', async (t) => {
    const admin = await createTestUser(t, { role: 'ADMIN', verified: true });
    const usersBefore = await prisma.user.count();

    const result = await runCreateAdmin({
      ADMIN_EMAIL: `  ${admin.email.toUpperCase()} `,
      ADMIN_PASSWORD: STRONG_PASSWORD,
    });

    assert.equal(result.code, 0, result.output);
    assert.equal(await passwordIs(admin.id, STRONG_PASSWORD), true, 'the same admin got the new password');
    assert.equal(await prisma.user.count(), usersBefore, 'no second account was created');
  });

  test('refuses to give a non-admin account admin rights', async (t) => {
    const player = await createTestUser(t, { verified: true });

    const result = await runCreateAdmin({ ADMIN_EMAIL: player.email, ADMIN_PASSWORD: STRONG_PASSWORD });

    assert.notEqual(result.code, 0);
    const after = await prisma.user.findUnique({ where: { id: player.id } });
    assert.equal(after.role, 'PLAYER');
    assert.equal(await passwordIs(player.id, STRONG_PASSWORD), false);
  });

  test('refuses to create a second admin when one already exists', async (t) => {
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!existingAdmin) {
      t.skip('no admin in this database, nothing to compare against');
      return;
    }
    const email = testEmail();
    deleteUserAfter(t, email);

    const result = await runCreateAdmin({ ADMIN_EMAIL: email, ADMIN_PASSWORD: STRONG_PASSWORD });

    assert.notEqual(result.code, 0);
    assert.equal(await prisma.user.findUnique({ where: { email } }), null);
  });
});
