// Reading for the Notifications screen and its badge (docs/features/notifications.md,
// d.2). Both use the definitions below, so the list and the number can't disagree (P15).
// `db` is the Prisma client or a transaction; `viewer` is viewerFrom(req).
import { MAX_TEAM_MEMBERS, toMembershipReply } from './membership.js';
import { MAX_UPDATES, toUpdateReply } from './notifications.js';
import { toVisibleUser } from './visibility.js';

// ── What's pending for this viewer: the one definition (P15) ──
// The invites the viewer received, and the join requests to the teams they captain now
// (Team.captainId, so a transfer moves them to the new captain at once). A venue owner
// has no membership rows and captains no team, so both find nothing.
//
// Moderation hook (docs/features/notifications.md, section g): a blocked player's invite
// or request is hidden by one more condition here.
const pendingInvitesOf = (viewer) => ({ userId: viewer.id, status: 'pending', origin: 'invite' });
const pendingRequestsFor = (viewer) => ({ status: 'pending', origin: 'request', team: { captainId: viewer.id } });

// The viewer's newest updates: the highest ids (P5).
const newestUpdates = (db, viewer, select) =>
  db.notification.findMany({ where: { userId: viewer.id }, orderBy: { id: 'desc' }, take: MAX_UPDATES, select });

const countUnread = (updates) => updates.filter((update) => update.readAt === null).length;

// ── The badge ──
// Pending invites, pending join requests and unread updates.
export async function countNotifications(db, viewer) {
  const [invites, requests, updates] = await Promise.all([
    db.teamMember.count({ where: pendingInvitesOf(viewer) }),
    db.teamMember.count({ where: pendingRequestsFor(viewer) }),
    newestUpdates(db, viewer, { readAt: true }),
  ]);
  return invites + requests + countUnread(updates);
}

// ── The screen ──
const ACCEPTED_MEMBER_COUNT = { _count: { select: { members: { where: { status: 'accepted' } } } } };
const counts = (team) => ({ memberCount: team._count.members, maxMembers: MAX_TEAM_MEMBERS });

const UPDATE_FIELDS = {
  id: true,
  type: true,
  teamId: true,
  teamName: true,
  playerId: true,
  playerName: true,
  venueName: true,
  note: true,
  readAt: true,
  createdAt: true,
};

// An invite with its team. The captain is another user: shown through the visibility
// rules ({ id, name }).
function toInviteReply({ team, ...invite }, viewer) {
  const captain = { id: team.captain.id, name: team.captain.playerProfile?.name || 'Unknown' };
  return {
    ...invite,
    team: { id: team.id, name: team.name, area: team.area, ...counts(team), captain: toVisibleUser(captain, viewer) },
  };
}

// The requests (already oldest first) put together per team, the teams by name A to Z
// ignoring case, then id. The message is shown: the only reader here is the team's
// captain. The person goes through the visibility rules.
function groupByTeam(requests, viewer) {
  const groups = new Map();
  for (const { team, ...row } of requests) {
    if (!groups.has(team.id)) {
      groups.set(team.id, { teamId: team.id, teamName: team.name, ...counts(team), requests: [] });
    }
    const user = toVisibleUser({ ...row.user, name: row.user.playerProfile?.name || 'Unknown' }, viewer);
    groups.get(team.id).requests.push({ ...toMembershipReply(row, { withMessage: true }), user });
  }
  return [...groups.values()].sort(
    (a, b) => a.teamName.toLowerCase().localeCompare(b.teamName.toLowerCase()) || a.teamId - b.teamId
  );
}

// Everything the Notifications screen shows. `count` is the badge's number, taken from
// the very lists in this reply. Emails and phones are never selected.
export async function loadNotifications(db, viewer) {
  const [invites, requests, updates] = await Promise.all([
    db.teamMember.findMany({
      where: pendingInvitesOf(viewer),
      select: {
        id: true,
        teamId: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
            area: true,
            captain: { select: { id: true, playerProfile: { select: { name: true } } } },
            ...ACCEPTED_MEMBER_COUNT,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    db.teamMember.findMany({
      where: pendingRequestsFor(viewer),
      select: {
        id: true,
        userId: true,
        createdAt: true,
        message: true,
        user: { select: { id: true, playerProfile: { select: { name: true, position: true, area: true } } } },
        team: { select: { id: true, name: true, ...ACCEPTED_MEMBER_COUNT } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    newestUpdates(db, viewer, UPDATE_FIELDS),
  ]);

  return {
    count: invites.length + requests.length + countUnread(updates),
    needsAction: {
      invites: invites.map((invite) => toInviteReply(invite, viewer)),
      joinRequests: groupByTeam(requests, viewer),
    },
    updates: updates.map(toUpdateReply),
  };
}
