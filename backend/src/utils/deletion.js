import crypto from 'node:crypto';
import { isLive } from './venues.js';
import { lockTeam, longestStandingFirst } from './membership.js';

// Shared delete logic for users and teams.
//
// Each delete has several steps: dependent rows are removed by hand first, in order. The
// schema's onDelete: Cascade rules (and its Restrict on a team's captain) are only a
// safety net; this code doesn't rely on them. Every step runs inside one database
// transaction: if any step fails, the database rolls back all of them, so nothing is
// ever left half-deleted.
//
// `db` is the caller's Prisma client. It's a parameter so the tests can pass a client
// that fails on purpose part-way through.
//
// TODO (Phase 4, docs/PRODUCT.md "Account deletion"): a deleted captain's teams should
// pass to the longest-standing member instead of being deleted.

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

// Deletes a user and everything that depends on them: their team memberships, the teams
// they captain (with those teams' members) and their profile. Returns false if no user
// has this id.
export async function deleteUserAndData(db, userId) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return false;

    // Their own memberships, plus every membership of a team they captain.
    await tx.teamMember.deleteMany({
      where: { OR: [{ userId }, { team: { captainId: userId } }] },
    });
    await tx.team.deleteMany({ where: { captainId: userId } });
    await tx.playerProfile.deleteMany({ where: { userId } });
    await tx.ownerProfile.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
    return true;
  });
}

// Deletes a team and all its membership rows (accepted and pending) inside the caller's
// transaction `tx`, which must already hold the team lock (lockTeam). Used where the
// delete is one step of a bigger change, like the last member leaving. Returns false if
// no team has this id.
export async function removeTeamRows(tx, teamId) {
  await tx.teamMember.deleteMany({ where: { teamId } });
  const { count } = await tx.team.deleteMany({ where: { id: teamId } });
  return count > 0;
}

// Deletes a team and all its membership rows in a transaction of its own, under the
// team lock, so it can't overlap another change to the team. Returns false if no team
// has this id.
export async function deleteTeamAndMembers(db, teamId) {
  return db.$transaction(async (tx) => {
    if (!(await lockTeam(tx, teamId))) return false;
    return removeTeamRows(tx, teamId);
  });
}
