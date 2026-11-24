// Deleting an account, then telling its owner (docs/features/account-deletion.md, d.3).
// Every caller deletes through deleteAccountAndNotify: the user's own "Delete account",
// the admin's delete routes and (Phase 5) the web page. So none of them can forget the
// email, and deletion.js stays database-only.
import { deleteUserAndData } from './deletion.js';
import { mailer } from './mailer.js';

// Deletes the account (see deleteUserAndData for `passwordHash`, `previewCode` and the
// result) and, when it's deleted, logs it and starts the notice email, without waiting
// for it. `adminId` is the admin who did it; without one, the user did it themselves.
// `sendNotice` is a parameter so the tests can watch it.
export async function deleteAccountAndNotify(
  db,
  userId,
  { passwordHash, previewCode, adminId } = {},
  { sendNotice = mailer.sendAccountDeletedEmail } = {}
) {
  const result = await deleteUserAndData(db, userId, { passwordHash, previewCode });
  if (result.status === 'deleted') {
    const { id, role } = result.user;
    // After a full deletion nothing else says what happened. No email or name (P10).
    console.log(`Account ${id} (${role}) deleted by ${adminId === undefined ? 'itself' : `admin ${adminId}`}`);
    notifyDeleted(result.user, sendNotice); // on purpose not awaited
  }
  return result;
}

// The notice goes only to an address the account had verified: an unverified one may be
// a stranger's (Q4). The deletion stands whatever happens here, so a failed send is only
// logged, with the former id and the error's code: the error itself can contain the
// email address, which was just deleted.
async function notifyDeleted({ id, email, displayName, verified }, sendNotice) {
  if (!verified) return;
  try {
    await sendNotice({ email, displayName });
  } catch (err) {
    console.error(`Account-deleted email failed for former user ${id} (${err?.responseCode ?? err?.code ?? 'no code'})`);
  }
}
