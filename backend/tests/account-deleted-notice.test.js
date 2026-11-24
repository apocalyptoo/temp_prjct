// Tests for the notice email and the log line after an account is deleted
// (deleteAccountAndNotify in src/utils/accountDeletion.js; docs/features/
// account-deletion.md, d.3). The email's own text is tested in mailer.test.js.
// Safety rules are in helpers.js. All users here are throwaway.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prisma, BASE_URL, createLoggedInUser, createTestUser, deleteUserAfter } from './helpers.js';
import { deleteAccountAndNotify } from '../src/utils/accountDeletion.js';
import { mailer } from '../src/utils/mailer.js';

const profile = { create: { name: 'Rahim', phone: '01712345678', position: 'Any' } };
const exists = async (id) => (await prisma.user.findUnique({ where: { id } })) !== null;

// A sender that only remembers what it was asked to send.
function watchedSender() {
  const sent = [];
  return { sent, sendNotice: async (email) => sent.push(email) };
}

// What was printed while `work` ran (and just after, for the email that isn't awaited).
async function printedDuring(t, work) {
  const lines = [];
  for (const method of ['log', 'error']) {
    t.mock.method(console, method, (...args) => lines.push(args.map(String).join(' ')));
  }
  await work();
  await new Promise((resolve) => setTimeout(resolve, 50));
  t.mock.restoreAll();
  return lines;
}

describe('After a deletion', () => {
  test('the notice goes to the deleted account, and the log names only the id', async (t) => {
    const user = await createTestUser(t, { verified: true, playerProfile: profile });
    const { sent, sendNotice } = watchedSender();

    const lines = await printedDuring(t, async () => {
      assert.equal((await deleteAccountAndNotify(prisma, user.id, {}, { sendNotice })).status, 'deleted');
    });

    assert.deepEqual(sent, [{ email: user.email, displayName: 'Rahim' }]);
    assert.deepEqual(lines, [`Account ${user.id} (PLAYER) deleted by itself`]);
    assert.equal(await exists(user.id), false);
  });

  test('the same for a deletion by the admin, whose id is in the log', async (t) => {
    const owner = await createTestUser(t, {
      role: 'OWNER',
      verified: true,
      ownerProfile: { create: { indoorName: 'Arena 71' } },
    });
    const { sent, sendNotice } = watchedSender();

    const lines = await printedDuring(t, () => deleteAccountAndNotify(prisma, owner.id, { adminId: 7 }, { sendNotice }));

    assert.deepEqual(sent, [{ email: owner.email, displayName: 'Arena 71' }]);
    assert.deepEqual(lines, [`Account ${owner.id} (OWNER) deleted by admin 7`]);
  });

  test('no notice to an address that was never verified', async (t) => {
    const user = await createTestUser(t, { verified: false, playerProfile: profile });
    const { sent, sendNotice } = watchedSender();

    const result = await deleteAccountAndNotify(prisma, user.id, {}, { sendNotice });

    assert.equal(result.status, 'deleted');
    assert.deepEqual(sent, []);
  });

  test('no notice and no log line when nothing was deleted', async (t) => {
    const user = await createTestUser(t, { verified: true, playerProfile: profile });
    const admin = await createTestUser(t, { role: 'ADMIN', verified: true });
    const { sent, sendNotice } = watchedSender();

    const lines = await printedDuring(t, async () => {
      const stale = await deleteAccountAndNotify(prisma, user.id, { previewCode: 'a'.repeat(64) }, { sendNotice });
      const changed = await deleteAccountAndNotify(prisma, user.id, { passwordHash: 'not the stored one' }, { sendNotice });
      const refused = await deleteAccountAndNotify(prisma, admin.id, {}, { sendNotice });
      const gone = await deleteAccountAndNotify(prisma, 2147483647, {}, { sendNotice });
      assert.deepEqual(
        [stale, changed, refused, gone].map((result) => result.status),
        ['stale', 'password-changed', 'admin', 'gone']
      );
    });

    assert.deepEqual(sent, []);
    assert.deepEqual(lines, []);
    assert.ok(await exists(user.id));
  });

  test("a failed send leaves the account deleted, and the log doesn't name the address", async (t) => {
    const email = `test-${crypto.randomUUID()}@mail.invalid`; // the mailer refuses .invalid at once
    deleteUserAfter(t, email);
    const user = await prisma.user.create({ data: { email, password: 'x', verified: true, playerProfile: profile } });

    const lines = await printedDuring(t, async () => {
      const result = await deleteAccountAndNotify(prisma, user.id, {}, { sendNotice: mailer.sendAccountDeletedEmail });
      assert.equal(result.status, 'deleted');
    });

    assert.equal(await exists(user.id), false);
    assert.equal(lines[1], `Account-deleted email failed for former user ${user.id} (no code)`);
    assert.ok(lines.every((line) => !line.includes(email)));
  });

  test('a sender that never answers holds nothing up', async (t) => {
    const user = await createTestUser(t, { verified: true, playerProfile: profile });

    const result = await deleteAccountAndNotify(prisma, user.id, {}, { sendNotice: () => new Promise(() => {}) });

    assert.equal(result.status, 'deleted');
  });

  test("the admin's delete replies 200 although the notice can't be sent", async (t) => {
    const admin = await createLoggedInUser(t, { role: 'ADMIN' });
    const email = `test-${crypto.randomUUID()}@mail.invalid`;
    deleteUserAfter(t, email);
    const user = await prisma.user.create({ data: { email, password: 'x', verified: true, playerProfile: profile } });

    const res = await fetch(`${BASE_URL}/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${admin.jwt}` },
    });

    assert.equal(res.status, 200);
    assert.equal(await exists(user.id), false);
  });
});
