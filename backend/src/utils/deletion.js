// Shared delete logic for users and teams.
//
// Each delete has several steps (the schema has no onDelete: Cascade, so dependent rows
// are removed by hand first). Every step runs inside one database transaction: if any
// step fails, the database rolls back all of them, so nothing is ever left half-deleted.
//
// `db` is the caller's Prisma client. It's a parameter so the tests can pass a client
// that fails on purpose part-way through.
//
// TODO (Phase 4, docs/PRODUCT.md "Account deletion"): a deleted captain's teams should
// pass to the longest-standing member instead of being deleted.

// Deletes a user and everything that depends on them: their team memberships, the teams
// they created (with those teams' members) and their profile. Returns false if no user
// has this id.
export async function deleteUserAndData(db, userId) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return false;

    // Their own memberships, plus every membership of a team they created.
    await tx.teamMember.deleteMany({
      where: { OR: [{ userId }, { team: { ownerId: userId } }] },
    });
    await tx.team.deleteMany({ where: { ownerId: userId } });
    await tx.playerProfile.deleteMany({ where: { userId } });
    await tx.ownerProfile.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
    return true;
  });
}

// Deletes a team and all its membership rows (accepted and pending). Returns false if
// no team has this id.
export async function deleteTeamAndMembers(db, teamId) {
  return db.$transaction(async (tx) => {
    await tx.teamMember.deleteMany({ where: { teamId } });
    const { count } = await tx.team.deleteMany({ where: { id: teamId } });
    return count > 0;
  });
}
