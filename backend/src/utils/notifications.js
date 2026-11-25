// The updates on the Notifications screen (docs/features/notifications.md): the ONE place
// that adds them, keeps each user's newest 50, and words them.
//
// The rule for callers: inside the action's own transaction (D1, so an action and its
// update can't come apart), call createUpdates once, as the last step (P17).

// Each user keeps only this many updates (docs/PRODUCT.md, "Notifications").
export const MAX_UPDATES = 50;

// ── What an update is about ──
// The names are copied as they are now; the ids may later point to nothing (D2).

// About a team, and for some types a player: { id, name } of each.
export const teamUpdate = (type, userId, team, player = null) => ({
  userId,
  type,
  teamId: team.id,
  teamName: team.name,
  playerId: player?.id ?? null,
  playerName: player?.name ?? null,
});

// About the owner's own venue, with the admin's note when there is one.
export const venueUpdate = (type, userId, venueName, note = null) => ({ userId, type, venueName, note });

// ── Creating updates ──

// Locks these users' rows until the transaction ends, lowest id first, whatever order the
// ids come in, so two actions that lock the same people can't each hold one the other is
// waiting for. Returns the ids that still exist. NO KEY UPDATE: other requests can still
// add rows that only refer to the user (an invite, a membership).
export async function lockUsers(tx, userIds) {
  if (userIds.length === 0) return new Set();
  const rows = await tx.$queryRaw`
    SELECT id FROM "User" WHERE id = ANY(${userIds}::int[]) ORDER BY id FOR NO KEY UPDATE`;
  return new Set(rows.map((row) => row.id));
}

// Adds these updates, then removes whatever is now beyond each recipient's newest 50.
// `actorId` is the person who did the action: they never get an update about it (D3).
// It's required, so a caller can't forget it.
//
// - The recipients' rows are locked first (P18). Without that, two actions telling the
//   same person something at the same moment wouldn't see each other's new update, and
//   51 could stay. It also puts one person's updates in id order, so the newest is always
//   the highest id (P5).
// - A recipient whose account is gone is skipped; the action still succeeds.
// - The removal skips rows another transaction has locked (P19): tidying up never makes
//   a real action wait. "FOR UPDATE SKIP LOCKED" is on the outer SELECT, so the 50 are
//   counted first, with every row.
export async function createUpdates(tx, updates, { actorId }) {
  if (!Number.isInteger(actorId)) throw new TypeError('createUpdates needs the actorId');

  const forOthers = updates.filter((update) => update.userId !== actorId);
  if (forOthers.length === 0) return;

  const recipients = await lockUsers(tx, [...new Set(forOthers.map((update) => update.userId))]);
  const data = forOthers.filter((update) => recipients.has(update.userId));
  if (data.length === 0) return;

  await tx.notification.createMany({ data });
  await tx.$executeRaw`
    DELETE FROM "Notification" WHERE id IN (
      SELECT n.id FROM "Notification" n
      WHERE n.id IN (
        SELECT older.id FROM unnest(${[...recipients]}::int[]) AS recipient(id)
        CROSS JOIN LATERAL (
          SELECT o.id FROM "Notification" o
          WHERE o."userId" = recipient.id ORDER BY o.id DESC OFFSET ${MAX_UPDATES}
        ) older
      )
      FOR UPDATE SKIP LOCKED
    )`;
}

// ── Marking updates as read ──
// Marks this user's unread updates up to this id (P16), inside the caller's transaction.
// The user's row is locked first, like everywhere else that changes their updates, and
// the updates are locked in id order, so it can't deadlock with an account deletion that
// is removing some of them (P19).
export async function markUpdatesRead(tx, userId, upToId) {
  await lockUsers(tx, [userId]);
  await tx.$queryRaw`
    SELECT id FROM "Notification"
    WHERE "userId" = ${userId} AND id <= ${upToId} AND "readAt" IS NULL
    ORDER BY id FOR UPDATE`;
  await tx.notification.updateMany({
    where: { userId, id: { lte: upToId }, readAt: null },
    data: { readAt: new Date() },
  });
}

// ── When an account is deleted ──
// Removes every update for this user, and every update other people keep that names them
// (Q1: a full deletion, so their name doesn't stay behind). Part of the shared account
// deletion, which holds the user's row and their teams' rows by then, so no new update
// that names them can appear. Rows are locked in id order, in one statement, so it can't
// deadlock with another change to several updates (P19).
export async function removeUpdatesAbout(tx, userId) {
  await tx.$executeRaw`
    DELETE FROM "Notification" WHERE id IN (
      SELECT id FROM "Notification" WHERE "userId" = ${userId} OR "playerId" = ${userId}
      ORDER BY id FOR UPDATE
    )`;
}

// ── The wording (docs/features/notifications.md, b.1) ──
// No sentence names a captain or the admin (P4). memberLeft has no player when the
// member's account was deleted: a deleted account's name isn't kept (Q1, Q2).
const TEXTS = {
  requestApproved: ({ teamName }) => `Your request to join ${teamName} was approved.`,
  requestDeclined: ({ teamName }) => `Your request to join ${teamName} was declined.`,
  inviteAccepted: ({ teamName, playerName }) => `${playerName} accepted the invite to ${teamName}.`,
  inviteDeclined: ({ teamName, playerName }) => `${playerName} declined the invite to ${teamName}.`,
  memberRemoved: ({ teamName }) => `You were removed from ${teamName}.`,
  memberLeft: ({ teamName, playerName }) => `${playerName ?? 'A member'} left your team ${teamName}.`,
  becameCaptain: ({ teamName }) => `You're now the captain of ${teamName}.`,
  teamDeleted: ({ teamName }) => `${teamName}, a team you were in, was deleted.`,
  teamDeletedInvite: ({ teamName }) => `${teamName}, which had invited you, was deleted.`,
  teamDeletedRequest: ({ teamName }) => `${teamName}, which you asked to join, was deleted.`,
  venueApproved: ({ venueName }) => `${venueName} was approved. Players can find it now.`,
  venueMovedToReview: ({ venueName }) => `${venueName} was moved back to review.`,
};

// The sentence for a stored update. The admin's note is sent beside it, not inside it.
export const updateText = (update) => TEXTS[update.type](update);

// ── What tapping an update opens (P14, P22) ──
// A team, a player, or the owner's own venue (their My Venue, so no id). Null when there's
// nothing to open. The team or player may be gone by then: the app says so (D2).
const openTeam = ({ teamId, teamName }) => (teamId === null ? null : { kind: 'team', id: teamId, name: teamName });
// The player, or the team when the update doesn't name one (a deleted account, Q2).
const openPlayer = (update) =>
  update.playerId === null ? openTeam(update) : { kind: 'player', id: update.playerId, name: update.playerName };
const openVenue = ({ venueName }) => ({ kind: 'venue', name: venueName });

// Declined and left open the player's page, where the captain can invite them again.
const OPENS = {
  inviteDeclined: openPlayer,
  memberLeft: openPlayer,
  venueApproved: openVenue,
  venueMovedToReview: openVenue,
};
export const updateOpens = (update) => (OPENS[update.type] ?? openTeam)(update);

// A stored update as the API sends it.
export const toUpdateReply = (update) => ({
  id: update.id,
  type: update.type,
  text: updateText(update),
  note: update.note,
  createdAt: update.createdAt,
  read: update.readAt !== null,
  opens: updateOpens(update),
});
