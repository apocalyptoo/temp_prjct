// Tests for scripts/seedDevAccounts.js (development only, temporary): the refusals. The
// script runs as a separate process with DATABASE_URL set for that run only (values
// already in the environment win over backend/.env). Only the refusals are tested here:
// creating, resetting and removing would change the four fixed test accounts the
// developer is using, and tests never change existing users (helpers.js). Those modes
// were checked by hand on the local database when the script was written.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prisma } from './helpers.js';

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const TEST_EMAILS = ['aa', 'ab', 'bb', 'ad'];
const REMOTE_URL = 'postgresql://someone:not-a-real-secret@db.example.com:5432/connectarena';

// Runs the script and returns its exit code and everything it printed.
async function runSeed(args, env = {}) {
  try {
    const { stdout, stderr } = await promisify(execFile)('node', ['scripts/seedDevAccounts.js', ...args], {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env },
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    return { code: error.code ?? 1, output: (error.stdout ?? '') + (error.stderr ?? '') };
  }
}

// The four accounts as they are, to show a refused run changed nothing.
const snapshot = () =>
  prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true, email: true, password: true, verified: true, tokenVersion: true },
    orderBy: { id: 'asc' },
  });

describe('scripts/seedDevAccounts.js refuses', () => {
  for (const args of [[], ['--fresh'], ['--remove']]) {
    test(`a database that isn't on this computer (${args[0] ?? 'no option'}), without printing its address`, async () => {
      const before = await snapshot();

      const result = await runSeed(args, { DATABASE_URL: REMOTE_URL });

      assert.notEqual(result.code, 0);
      assert.match(result.output, /localhost or 127\.0\.0\.1/);
      assert.match(result.output, /Nothing was changed/);
      assert.equal(result.output.includes('db.example.com'), false, 'must never print the database address');
      assert.equal(result.output.includes('not-a-real-secret'), false, 'must never print the database password');
      assert.deepEqual(await snapshot(), before);
    });
  }

  test('a DATABASE_URL that is not a URL', async () => {
    const result = await runSeed([], { DATABASE_URL: 'not a url' });

    assert.notEqual(result.code, 0);
    assert.match(result.output, /localhost or 127\.0\.0\.1/);
  });

  test('an unknown option, or --fresh with --remove', async () => {
    const before = await snapshot();

    const unknown = await runSeed(['--wipe']);
    const both = await runSeed(['--fresh', '--remove']);

    assert.notEqual(unknown.code, 0);
    assert.match(unknown.output, /unknown option --wipe/);
    assert.notEqual(both.code, 0);
    assert.match(both.output, /can't be used together/);
    assert.deepEqual(await snapshot(), before);
  });
});
