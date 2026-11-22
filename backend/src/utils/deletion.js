import { lockTeam } from './membership.js';

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
