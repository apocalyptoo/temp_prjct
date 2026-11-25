import crypto from 'node:crypto';
import { isLive } from './venues.js';
import { isMember, isPendingInvite, lockTeam, lockTeams, longestStandingFirst } from './membership.js';
import { createUpdates, removeUpdatesAbout, teamUpdate } from './notifications.js';
import { toVisibleUser } from './visibility.js';

// Shared delete logic for users and teams: the one place for what a delete removes.
//
// Each delete has several steps: dependent rows are removed by hand first, in order. The
// schema's onDelete: Cascade rules (and its Restrict on a team's captain) are only a
// safety net; this code doesn't rely on them. Every step runs inside one database
// transaction: if any step fails, the database rolls back all of them, so nothing is
// ever left half-deleted.
//
// `db` is the caller's Prisma client. It's a parameter so the tests can pass a client
// that fails on purpose part-way through.

const nameOf = (user) => user.playerProfile?.name ?? user.ownerProfile?.indoorName ?? null;
const byNameThenId = (a, b) => {
  const [nameA, nameB] = [a.name.toLowerCase(), b.name.toLowerCase()];
  return nameA < nameB ? -1 : nameA > nameB ? 1 : a.id - b.id;
};

// ── What deleting an account would do ──
// Reads only, changes nothing (docs/features/account-deletion.md, d.2, D1). The preview
// shows this plan, and the deletion carries out exactly this plan, so they follow one
// rule. `db` is the Prisma client, or a transaction. Returns null if no user has this id.
//
// - captainedTeams: each team the user captains. Its longest-standing other accepted
//   member becomes captain ('handover'); with no other accepted member the team is
//   deleted ('delete'). Pending invites and requests never count. Teams to be deleted
//   come first (P3), then by name.
// - otherTeams: teams where they're an accepted member but not the captain.
// - pendingCount: their own pending invites and join requests.
// - venue: the listing that goes with a venue owner's account.
//
// Moderation hook (docs/features/account-deletion.md, section g): whether a suspended
// member can be handed a team is decided there, as one more filter on `candidates`.
export async function planAccountDeletion(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      verified: true,
      playerProfile: { select: { name: true } },
      ownerProfile: { select: { indoorName: true, approvedAt: true } },
      captainedTeams: {
        select: {
          id: true,
          name: true,
          members: {
            where: { status: 'accepted', userId: { not: userId } },
            select: {
              id: true,
              acceptedAt: true,
              user: {
                select: {
                  id: true,
                  playerProfile: { select: { name: true } },
                  ownerProfile: { select: { indoorName: true } },
                },
              },
            },
          },
        },
      },
      teamMembers: {
        select: { status: true, team: { select: { id: true, name: true, captainId: true } } },
      },
    },
  });
  if (!user) return null;

  const captainedTeams = user.captainedTeams.map(({ id, name, members: candidates }) => {
    const [next] = [...candidates].sort(longestStandingFirst);
    if (!next) return { id, name, outcome: 'delete' };
    return { id, name, outcome: 'handover', newCaptain: { id: next.user.id, name: nameOf(next.user) ?? 'Unknown' } };
  });
  captainedTeams.sort(
    (a, b) => (b.outcome === 'delete') - (a.outcome === 'delete') || byNameThenId(a, b)
  );

  const accepted = user.teamMembers.filter((row) => row.status === 'accepted');
  return {
    user: {
      id: user.id,
      role: user.role,
      email: user.email,
      displayName: nameOf(user) ?? 'there',
      verified: user.verified,
    },
    captainedTeams,
    otherTeams: accepted
      .filter((row) => row.team.captainId !== userId)
      .map(({ team: { id, name } }) => ({ id, name }))
      .sort(byNameThenId),
    pendingCount: user.teamMembers.length - accepted.length,
    venue: user.ownerProfile && { name: user.ownerProfile.indoorName, live: isLive(user.ownerProfile) },
  };
}

// A short code for what a plan does to the captained teams (P4): which teams, and who
// gets each one (or that it's deleted). The preview replies with it and the delete sends
// it back, so a deletion whose outcome has changed since can be refused. Names aren't
// part of it and the teams are put in id order, so renaming a team doesn't matter.
export function previewCodeFor(plan) {
  const outcomes = plan.captainedTeams
    .map((team) => [team.id, team.outcome === 'handover' ? team.newCaptain.id : 'delete'])
    .sort(([a], [b]) => a - b);
  return crypto.createHash('sha256').update(JSON.stringify(outcomes), 'utf8').digest('hex');
}

// A plan as a preview reply, with its code (d.4 endpoint 1). The new captains are other
// users, so they go through the visibility rules ({ id, name }).
export const toDeletionPreview = (plan, viewer) => ({
  previewCode: previewCodeFor(plan),
  captainedTeams: plan.captainedTeams.map((team) =>
    team.newCaptain ? { ...team, newCaptain: toVisibleUser(team.newCaptain, viewer) } : team
  ),
  otherTeams: plan.otherTeams,
  pendingCount: plan.pendingCount,
  venue: plan.venue,
});

// ── Deleting an account ──
// The one shared deletion (docs/features/account-deletion.md, d.2): the user's own
// "Delete account", the admin's delete routes and (Phase 5) the web page all use it.
// It carries out planAccountDeletion: captained teams are handed over or deleted, then
// the user's memberships, invites and requests, notifications, profile and account go.
// It also tells the people it affects (docs/features/notifications.md, d.4): new captains,
// the players waiting on a deleted team, and the captains of the user's other teams.
//
// Options, each checked only when given:
// - passwordHash: the stored hash the caller checked the password against. If it has
//   changed since, nothing is deleted.
// - previewCode: the code of the preview the user saw. If the outcome for a captained
//   team has changed since, nothing is deleted (P4).
//
// Returns { status }:
// - 'deleted', with `user` (id, role, email, displayName, verified) as it was;
// - 'gone': no user has this id (any more);
// - 'admin': an ADMIN account, never deleted here (P5);
// - 'password-changed' / 'stale': see the options.
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 15_000; // P7: it may wait for several teams' locks

export async function deleteUserAndData(db, userId, options = {}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await db.$transaction((tx) => deleteInTransaction(tx, userId, options), { timeout: TIMEOUT_MS });
    if (result.status !== 'teams-moved') return result;
  }
  return { status: 'stale' };
}

// Every team the user captains or has any row in (member, invite or request).
const findTeamIds = async (tx, userId) => {
  const teams = await tx.team.findMany({
    where: { OR: [{ captainId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return teams.map((team) => team.id);
};

// The locks (P6): first every team the user has anything to do with, lowest id first,
// then the user's own row. Always in this order: a team action holds one team's lock and
// then touches a user's row, so locking the user first could leave the two waiting for
// each other. Holding the teams stops any of them from changing; holding the user stops
// new links to them (a new team, an invite, being made captain), which must wait and
// then find the account gone.
async function deleteInTransaction(tx, userId, { passwordHash, previewCode }) {
  const teamIds = await findTeamIds(tx, userId);
  const lockedTeams = await lockTeams(tx, teamIds);

  const [user] = await tx.$queryRaw`SELECT role::text AS role, password FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!user) return { status: 'gone' };
  if (user.role === 'ADMIN') return { status: 'admin' };
  if (passwordHash !== undefined && user.password !== passwordHash) return { status: 'password-changed' };

  // A team joined or created while we waited for the locks isn't locked: start over.
  // Nothing has been written yet, so ending this transaction only releases the locks.
  const locked = new Set(teamIds);
  if ((await findTeamIds(tx, userId)).some((id) => !locked.has(id))) return { status: 'teams-moved' };

  const plan = await planAccountDeletion(tx, userId);
  if (previewCode !== undefined && previewCode !== previewCodeFor(plan)) return { status: 'stale' };

  const updates = [];
  for (const team of plan.captainedTeams) {
    if (team.outcome === 'delete') {
      updates.push(...(await removeTeamRows(tx, team)));
    } else {
      // Only the captain changes: the team keeps its pending invites and requests.
      await tx.team.update({ where: { id: team.id }, data: { captainId: team.newCaptain.id } });
      updates.push(teamUpdate('becameCaptain', team.newCaptain.id, team));
    }
  }
  // The captains of the other teams hear that a member left, without a name (Q2).
  const captainOf = new Map(lockedTeams.map((team) => [team.id, team.captainId]));
  for (const team of plan.otherTeams) updates.push(teamUpdate('memberLeft', captainOf.get(team.id), team));
  // All in one call, whatever the number of teams (notifications spec P17).
  await createUpdates(tx, updates, { actorId: userId });

  await tx.teamMember.deleteMany({ where: { userId } });
  await tx.playerProfile.deleteMany({ where: { userId } });
  await tx.ownerProfile.deleteMany({ where: { userId } });
  await removeUpdatesAbout(tx, userId);
  // Moderation hook (docs/features/account-deletion.md, section g): reports by or about
  // the user and blocks in both directions are removed here.
  await tx.user.delete({ where: { id: userId } });
  return { status: 'deleted', user: plan.user };
}

// Which update someone gets when their team is deleted, by their row in it
// (docs/features/notifications.md, P2).
const teamDeletedType = (row) =>
  isMember(row) ? 'teamDeleted' : isPendingInvite(row) ? 'teamDeletedInvite' : 'teamDeletedRequest';

// Deletes a team ({ id, name }) and all its membership rows (accepted and pending) inside
// the caller's transaction `tx`, which must already hold the team lock (lockTeam). Used
// where the delete is one step of a bigger change, like the last member leaving.
// Returns the updates for everyone who had a row in it, read before the rows go: the
// caller must pass them to createUpdates, in its one call (notifications spec P17, P21).
export async function removeTeamRows(tx, team) {
  const rows = await tx.teamMember.findMany({
    where: { teamId: team.id },
    select: { userId: true, status: true, origin: true },
    orderBy: { id: 'asc' },
  });
  await tx.teamMember.deleteMany({ where: { teamId: team.id } });
  await tx.team.deleteMany({ where: { id: team.id } });
  return rows.map((row) => teamUpdate(teamDeletedType(row), row.userId, team));
}

// Deletes a team and all its membership rows in a transaction of its own, under the
// team lock, so it can't overlap another change to the team, and tells the people in it.
// `actorId` is the admin who did it. Returns false if no team has this id.
export async function deleteTeamAndMembers(db, teamId, { actorId } = {}) {
  return db.$transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!team) return false;
    await createUpdates(tx, await removeTeamRows(tx, team), { actorId });
    return true;
  });
}
