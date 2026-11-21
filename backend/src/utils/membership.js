// TeamMember fields that are stored but never sent in API replies as they are. The app
// doesn't need origin or acceptedAt (docs/features/team-membership.md). A join request's
// message is private to the captain, the requester and the admin, so replies that may
// show it add it back on purpose. Used with Prisma's `omit` on every query whose
// membership rows reach a reply.
export const MEMBERSHIP_FIELDS_NOT_IN_REPLIES = { origin: true, acceptedAt: true, message: true };
