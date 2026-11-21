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
