// TeamMember fields that are stored but not sent in API replies yet. Feature 1 (team
// membership) decides what the app needs (Task 4.2, docs/ROADMAP.md). Used with
// Prisma's `omit` on every query whose membership rows reach a reply.
export const MEMBERSHIP_FIELDS_NOT_IN_REPLIES = { origin: true, acceptedAt: true };
