// TeamMember fields that are stored but never sent in API replies as they are. The app
// doesn't need origin or acceptedAt (docs/features/team-membership.md). A join request's
// message is private to the captain, the requester and the admin, so replies that may
// show it add it back on purpose. Used with Prisma's `omit` on every query whose
// membership rows reach a reply.
export const MEMBERSHIP_FIELDS_NOT_IN_REPLIES = { origin: true, acceptedAt: true, message: true };

// A team has at most this many accepted members, the captain included
// (docs/PRODUCT.md, "Team size"). Pending invites and join requests don't count.
// Replies carry it as `maxMembers`, so the app never hard-codes it.
export const MAX_TEAM_MEMBERS = 15;
export const TEAM_FULL_MESSAGE = `Team is full (${MAX_TEAM_MEMBERS}/${MAX_TEAM_MEMBERS}).`;

// The kinds of TeamMember row (docs/features/team-membership.md, section b).
export const isMember = (row) => row.status === 'accepted';
export const isPendingInvite = (row) => row.status === 'pending' && row.origin === 'invite';
export const isPendingRequest = (row) => row.status === 'pending' && row.origin === 'request';

// A membership row as it may appear in a reply: without origin and acceptedAt, and with
// the message only when the caller says the viewer may see it.
export function toMembershipReply(row, { withMessage = false } = {}) {
  // eslint-disable-next-line no-unused-vars -- the three fields are taken out on purpose.
  const { origin, acceptedAt, message, ...rest } = row;
  return withMessage ? { ...rest, message } : rest;
}

// Locks the team's row until the surrounding transaction ends, and returns
// { id, captainId }, or null when the team doesn't exist. Every write to a team's
// membership rows or captain calls this first, inside its transaction, so two such
// writes to the same team run one after the other: two approvals at the same moment
// can't both see 14 members and take the team to 16. The id is sent as a parameter
// (Prisma's tagged $queryRaw), never pasted into the SQL.
export async function lockTeam(tx, teamId) {
  const rows = await tx.$queryRaw`SELECT id, "captainId" FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
  return rows[0] ?? null;
}

// The team's accepted members (the captain included).
export const countMembers = (tx, teamId) => tx.teamMember.count({ where: { teamId, status: 'accepted' } });
