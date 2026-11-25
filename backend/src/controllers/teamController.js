import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser } from '../utils/visibility.js';
import { removeTeamRows } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';
import { escapeLike } from '../utils/search.js';
import { pageArgs, pagedReply } from '../utils/paging.js';
import { findPlayerPage } from '../utils/discovery.js';
import {
  MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
  MAX_TEAM_MEMBERS,
  isMember,
  isPendingInvite,
  isPendingRequest,
  inMemberOrder,
  toMembershipReply,
  TEAM_FULL_MESSAGE,
  lockTeam,
  countMembers,
} from '../utils/membership.js';

// Request bodies are checked by the schemas in src/validation/teamSchemas.js before
// these handlers run (see teamRoutes.js). The handlers read them from req.valid.body.

// Runs `work(tx, team)` in one transaction whose first step locks the team row
// (lockTeam), so writes to the same team never overlap. `work` returns the reply as
// [status, body]; an unknown team gets 404 "Team not found".
function withLockedTeam(teamId, work) {
  return prisma.$transaction(async (tx) => {
    const team = await lockTeam(tx, teamId);
    if (!team) return [404, { error: 'Team not found' }];
    return work(tx, team);
  });
}

const sendReply = (res, [status, body]) => res.status(status).json(body);
const teamFull = () => [409, { error: TEAM_FULL_MESSAGE }];
const findRow = (tx, teamId, userId) => tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });

// An account can be deleted between a request's login check and its write
// (docs/features/account-deletion.md, d.5). A new row for it is then refused by the
// database: foreign key error P2003. Each of the three places that add such a row can
// only mean one account: the caller (the same 401 as for any deleted account, so the app
// logs out) or the invited player.
const isAccountGone = (error) => error?.code === 'P2003';
const callerGone = () => [401, { error: 'Invalid token' }];

// ── Create new team ──
export const createTeam = async (req, res, next) => {
  try {
    // Trimmed, 2–40 characters; description trimmed, at most 200, or null; area tidied,
    // 2–40, or null (createTeamSchema).
    const { name, description, area } = req.valid.body;
    const captainId = req.user.id;

    // The creator becomes the captain (stored only in captainId) and is also an
    // accepted member of the team (origin 'creator', accepted straight away).
    const team = await prisma.team.create({
      data: {
        name,
        description,
        area,
        captainId,
        members: {
          create: {
            userId: captainId,
            status: 'accepted',
            origin: 'creator',
            acceptedAt: new Date(),
          },
        },
      },
    });

    res.status(201).json(team);
  } catch (error) {
    if (isAccountGone(error)) return sendReply(res, callerGone());
    return next(error);
  }
};

// ── Invite player (captain only) ──
// A full team can't invite (docs/PRODUCT.md, "Team size"). Inviting a player who has
// already asked to join approves their request instead (both sides agreed).
export const invitePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    // A real positive whole number, not a string, an object or a decimal (inviteSchema).
    const { userId } = req.valid.body;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can invite players.' }];
      if ((await countMembers(tx, teamId)) >= MAX_TEAM_MEMBERS) return teamFull();

      // Only existing PLAYER accounts can be invited. An unknown id, or a venue owner or
      // admin account, gets the same 404 (instead of a database error).
      const invitee = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!invitee || invitee.role !== 'PLAYER') return [404, { error: 'Player not found' }];

      const existing = await findRow(tx, teamId, userId);
      if (existing && isPendingRequest(existing)) {
        await tx.teamMember.update({
          where: { id: existing.id },
          data: { status: 'accepted', acceptedAt: new Date(), message: null },
        });
        return [200, { message: 'Request approved', joined: true }];
      }
      if (existing) return [400, { error: 'Player is already invited or in the team.' }];

      const invite = await tx.teamMember.create({
        data: { teamId, userId, status: 'pending', origin: 'invite' },
        omit: MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
      });
      return [201, invite];
    });
    return sendReply(res, reply);
  } catch (error) {
    if (isAccountGone(error)) return sendReply(res, [404, { error: 'Player not found' }]);
    return next(error);
  }
};

// ── The players a captain can invite (captain only) ──
// GET /teams/:teamId/invite-candidates (docs/features/explore.md, d endpoint 7, P15):
// the search behind Invite players. The players the captain could find in Explore
// (src/utils/discovery.js), minus everyone who already has a row in this team: the
// captain, the members, the invited players and the players who asked to join. The
// same filters, order, rows and paging as GET /players. It only reads, so it doesn't
// take the team lock; a full team still gets its list (the invite itself is refused).
export const listInviteCandidates = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { captainId: true } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.captainId !== req.user.id) return res.status(403).json({ error: 'Only the team captain can invite players.' });

    const { items, total } = await findPlayerPage(prisma, viewerFrom(req), req.valid.query, {
      teamMembers: { none: { teamId } },
    });
    return res.json(pagedReply(items, total, req.valid.query));
  } catch (error) {
    return next(error);
  }
};

// ── Remove a member (captain only) ──
// Removes an accepted member. Pending invites are cancelled with cancelInvite, and join
// requests are declined with rejectRequest, so this never touches a pending row.
export const removePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });
    const requesterId = req.user.id;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== requesterId) return [403, { error: 'Only the team captain can remove players.' }];
      if (userId === requesterId) return [400, { error: 'The team captain cannot remove themselves.' }];

      const { count } = await tx.teamMember.deleteMany({ where: { teamId, userId, status: 'accepted' } });
      if (count === 0) return [404, { error: 'Player not found in this team.' }];
      return [200, { message: 'Player removed successfully.' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Cancel an invite (captain only) ──
export const cancelInvite = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can cancel invites.' }];
      const { count } = await tx.teamMember.deleteMany({
        where: { teamId, userId, status: 'pending', origin: 'invite' },
      });
      if (count === 0) return [404, { error: 'Invite not found' }];
      return [200, { message: 'Invite cancelled' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Delete team (captain only) ──
export const deleteTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can delete this team.' }];
      await removeTeamRows(tx, teamId);
      return [200, { message: 'Team deleted successfully.' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Leave a team (members) ──
// The captain must hand over captaincy first, unless they're the only member: then
// leaving deletes the team, with its pending invites and requests
// (docs/PRODUCT.md, "Leaving and captaincy").
export const leaveTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      const own = await findRow(tx, teamId, userId);
      if (!own || !isMember(own)) return [404, { error: "You're not a member of this team." }];

      if (team.captainId === userId) {
        if ((await countMembers(tx, teamId)) > 1) return [409, { error: 'Transfer captaincy before leaving the team.' }];
        await removeTeamRows(tx, teamId);
        return [200, { message: 'Team deleted', teamDeleted: true }];
      }

      await tx.teamMember.delete({ where: { id: own.id } });
      return [200, { message: 'You left the team.', teamDeleted: false }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Transfer captaincy (captain only) ──
// One update of Team.captainId (the only place the captain is stored). The new captain
// must be an accepted member; the old captain stays an accepted member.
export const transferCaptaincy = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    // A real positive whole number (transferSchema, the same rule as inviteSchema).
    const { userId } = req.valid.body;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can transfer captaincy.' }];
      if (userId === team.captainId) return [400, { error: "You're already the captain." }];
      const target = await findRow(tx, teamId, userId);
      if (!target || !isMember(target)) return [404, { error: 'Player not found in this team.' }];

      await tx.team.update({ where: { id: teamId }, data: { captainId: userId } });
      return [200, { message: 'Captaincy transferred', captainId: userId }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Edit team (captain only) ──
// The same rules as creating a team (updateTeamSchema). Replies with the updated team
// in the GET /teams/:teamId shape.
export const updateTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const { name, description, area } = req.valid.body;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can edit this team.' }];
      await tx.team.update({ where: { id: teamId }, data: { name, description, area } });
      return [200, toTeamDetail(await findTeamWithRows(tx, teamId), viewerFrom(req))];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Accept invite ──
// Only a pending invite can be accepted, never the player's own join request (players
// can't approve their own requests). A full team blocks it; the invite stays pending.
export const acceptInvite = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    const reply = await withLockedTeam(teamId, async (tx) => {
      const own = await findRow(tx, teamId, userId);
      if (!own || !isPendingInvite(own)) return [404, { error: 'Invite not found' }];
      if ((await countMembers(tx, teamId)) >= MAX_TEAM_MEMBERS) return teamFull();
      await tx.teamMember.update({ where: { id: own.id }, data: { status: 'accepted', acceptedAt: new Date() } });
      return [200, { message: 'Joined team successfully' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Reject invite ──
// Only a pending invite can be rejected, so this can't remove an accepted membership
// (including the captain's own) or the player's own join request.
export const rejectInvite = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    const reply = await withLockedTeam(teamId, async (tx) => {
      const { count } = await tx.teamMember.deleteMany({
        where: { teamId, userId, status: 'pending', origin: 'invite' },
      });
      if (count === 0) return [404, { error: 'Invite not found' }];
      return [200, { message: 'Invite rejected' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Ask to join a team (players) ──
// Creates a pending join request with an optional message. If the captain has already
// invited the player, asking accepts the invite instead (both sides agreed). A full
// team takes no requests (docs/features/team-membership.md, endpoint 5).
export const requestToJoin = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;
    const { message } = req.valid.body;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      const own = await findRow(tx, teamId, userId);
      if (team.captainId === userId || (own && isMember(own))) {
        return [409, { error: "You're already in this team." }];
      }
      if (own && isPendingRequest(own)) return [409, { error: "You've already asked to join this team." }];
      if ((await countMembers(tx, teamId)) >= MAX_TEAM_MEMBERS) return teamFull();

      if (own && isPendingInvite(own)) {
        await tx.teamMember.update({ where: { id: own.id }, data: { status: 'accepted', acceptedAt: new Date() } });
        return [200, { message: 'Joined team successfully', joined: true }];
      }

      const request = await tx.teamMember.create({
        data: { teamId, userId, status: 'pending', origin: 'request', message },
        select: { id: true, teamId: true, userId: true, status: true, createdAt: true, message: true },
      });
      return [201, request];
    });
    return sendReply(res, reply);
  } catch (error) {
    if (isAccountGone(error)) return sendReply(res, callerGone());
    return next(error);
  }
};

// ── Cancel my join request (the requester) ──
export const cancelMyRequest = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    const reply = await withLockedTeam(teamId, async (tx) => {
      const { count } = await tx.teamMember.deleteMany({
        where: { teamId, userId, status: 'pending', origin: 'request' },
      });
      if (count === 0) return [404, { error: 'Join request not found' }];
      return [200, { message: 'Request cancelled' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// Shared start of approve and reject: the captain check, then the pending request.
// Returns a reply ([status, body]) to send, or the request row to act on.
async function findRequestForCaptain(tx, team, teamId, userId, viewerId) {
  if (team.captainId !== viewerId) {
    return [403, { error: 'Only the team captain can approve or reject join requests.' }];
  }
  const row = await findRow(tx, teamId, userId);
  if (!row || !isPendingRequest(row)) return [404, { error: 'Join request not found' }];
  return row;
}

// ── Approve a join request (captain only) ──
// Blocked when the team is full; the request then stays pending. Approving clears the
// message (docs/PRODUCT.md, "Join request message").
export const approveRequest = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      const found = await findRequestForCaptain(tx, team, teamId, userId, req.user.id);
      if (Array.isArray(found)) return found;
      if ((await countMembers(tx, teamId)) >= MAX_TEAM_MEMBERS) return teamFull();
      await tx.teamMember.update({
        where: { id: found.id },
        data: { status: 'accepted', acceptedAt: new Date(), message: null },
      });
      return [200, { message: 'Request approved' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// ── Decline a join request (captain only) ──
// Deletes the row, and its message with it. Works when the team is full.
export const rejectRequest = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      const found = await findRequestForCaptain(tx, team, teamId, userId, req.user.id);
      if (Array.isArray(found)) return found;
      await tx.teamMember.delete({ where: { id: found.id } });
      return [200, { message: 'Request declined' }];
    });
    return sendReply(res, reply);
  } catch (error) {
    return next(error);
  }
};

// Team replies load every membership row of the team (accepted and pending) with the
// person's name, position and area (all public). Rows are shaped by toMembershipReply before they reach a
// reply, so origin, acceptedAt and message never leak.
const ALL_ROWS_WITH_PEOPLE = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          playerProfile: { select: { name: true, position: true, area: true } },
          ownerProfile: { select: { indoorName: true } },
        },
      },
    },
  },
};

const oldestFirst = (a, b) => a.createdAt - b.createdAt || a.id - b.id;
const newestFirst = (a, b) => oldestFirst(b, a);

// One membership row for the viewer: the person goes through the visibility rules (no
// email or phone of other users), the row through toMembershipReply.
function toRowReply(row, viewer, options) {
  const user = toVisibleUser(
    {
      ...row.user,
      name: row.user?.playerProfile?.name || row.user?.ownerProfile?.indoorName || 'Unknown',
    },
    viewer
  );
  return { ...toMembershipReply(row, options), user };
}

// Where the viewer stands with a team, from its captain and the viewer's own membership
// row in it (`own`: { status, origin }, or nothing). Venue owners and the admin can't
// join teams, so they're always 'none'.
function viewerStateFor(captainId, own, viewer) {
  if (viewer.role !== 'PLAYER') return 'none';
  if (captainId === viewer.id) return 'captain';
  if (!own) return 'none';
  if (isMember(own)) return 'member';
  return isPendingInvite(own) ? 'invited' : 'requested';
}
const viewerStateOf = (team, viewer) =>
  viewerStateFor(team.captainId, team.members.find((row) => row.userId === viewer.id), viewer);

// A team in the viewer's own list (GET /teams/me):
// - members: accepted members only (a pending invite or request isn't membership);
// - pendingInvites: the team's pending invites (not join requests), only for the
//   team's captain (Team.captainId). Nobody else gets the field.
function toTeamListItem(team, viewer) {
  const { members: rows, ...rest } = team;
  const result = {
    ...rest,
    members: inMemberOrder(rows.filter(isMember), team.captainId).map((row) => toRowReply(row, viewer)),
  };
  if (team.captainId === viewer.id) {
    result.pendingInvites = rows
      .filter(isPendingInvite)
      .sort(newestFirst)
      .map((row) => toRowReply(row, viewer));
  }
  return result;
}

// One team for the team page (GET /teams/:teamId), as seen by the viewer
// (docs/features/team-membership.md, endpoint 1). Join requests (with their messages)
// and pending invites go only to the captain and the admin; myRequest only to the
// player who sent the request.
export function toTeamDetail(team, viewer) {
  const { members: rows, ...rest } = team;
  const viewerState = viewerStateOf(team, viewer);
  const acceptedRows = rows.filter(isMember);
  const result = {
    ...rest,
    memberCount: acceptedRows.length,
    maxMembers: MAX_TEAM_MEMBERS,
    viewerState,
    members: inMemberOrder(acceptedRows, team.captainId).map((row) => toRowReply(row, viewer)),
  };
  if (viewerState === 'captain' || viewer.role === 'ADMIN') {
    result.joinRequests = rows
      .filter(isPendingRequest)
      .sort(oldestFirst)
      .map((row) => toRowReply(row, viewer, { withMessage: true }));
    result.pendingInvites = rows
      .filter(isPendingInvite)
      .sort(newestFirst)
      .map((row) => toRowReply(row, viewer));
  }
  if (viewerState === 'requested') {
    const own = rows.find((row) => row.userId === viewer.id);
    result.myRequest = { createdAt: own.createdAt, message: own.message };
  }
  return result;
}

// Loads one team with all its rows, or null. `db` is the Prisma client or a transaction.
export const findTeamWithRows = (db, teamId) =>
  db.team.findUnique({ where: { id: teamId }, include: ALL_ROWS_WITH_PEOPLE });

// ── The team list (Explore → Teams) ──
// GET /teams (docs/features/explore.md, d endpoint 1): one page of light rows. Each row
// is the team, its captain's name, how many accepted members it has and where the
// viewer stands with it: no member rows and no profiles (P9, P10).
//
// Teams with a free spot come first, then name A to Z, then id (P2), so the order never
// changes from one page to the next. "Has a free spot" is a count of accepted members
// compared with the limit, which Prisma's findMany can't sort by, so the page is one
// SQL query (P11). It is a tagged $queryRaw with a fixed text: every value below is sent
// to Postgres as a parameter, never pasted into the SQL, so nothing typed into the
// search can change the query. A filter that isn't used is sent as null and switched
// off inside the SQL ("IS NULL OR …"). escapeLike makes %, _ and  in the search match
// only themselves (ILIKE's wildcards and escape character).
//
// Moderation hook (docs/features/explore.md, section g): whether a suspended captain's
// team is hidden is decided there, as one more condition in both WHERE clauses.
const likePattern = (text) => (text === undefined ? null : `%${escapeLike(text)}%`);

export const getTeams = async (req, res, next) => {
  try {
    const { search, area, page, limit } = req.valid.query;
    const viewer = viewerFrom(req);
    const name = likePattern(search);
    const teamArea = likePattern(area);
    const { skip, take } = pageArgs({ page, limit });

    const [rows, [{ total }]] = await Promise.all([
      prisma.$queryRaw`
        SELECT t.id, t.name, t.description, t.area, t."createdAt", t."captainId",
               captain.name AS "captainName",
               accepted.count AS "memberCount",
               own.status::text AS "viewerStatus",
               own.origin::text AS "viewerOrigin"
        FROM "Team" t
        LEFT JOIN "PlayerProfile" captain ON captain."userId" = t."captainId"
        CROSS JOIN LATERAL (
          SELECT COUNT(*)::int AS count FROM "TeamMember" m
          WHERE m."teamId" = t.id AND m.status = 'accepted'
        ) accepted
        LEFT JOIN "TeamMember" own ON own."teamId" = t.id AND own."userId" = ${viewer.id}
        WHERE (${name}::text IS NULL OR t.name ILIKE ${name})
          AND (${teamArea}::text IS NULL OR t.area ILIKE ${teamArea})
        ORDER BY (accepted.count >= ${MAX_TEAM_MEMBERS}) ASC, lower(t.name) ASC, t.id ASC
        LIMIT ${take} OFFSET ${skip}`,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total FROM "Team" t
        WHERE (${name}::text IS NULL OR t.name ILIKE ${name})
          AND (${teamArea}::text IS NULL OR t.area ILIKE ${teamArea})`,
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      area: row.area,
      createdAt: row.createdAt,
      captainId: row.captainId,
      // The captain is another user: shown through the visibility rules ({ id, name }).
      captain: toVisibleUser({ id: row.captainId, name: row.captainName || 'Unknown' }, viewer),
      memberCount: row.memberCount,
      maxMembers: MAX_TEAM_MEMBERS,
      viewerState: viewerStateFor(
        row.captainId,
        row.viewerStatus ? { status: row.viewerStatus, origin: row.viewerOrigin } : null,
        viewer
      ),
    }));
    res.json(pagedReply(items, total, { page, limit }));
  } catch (error) {
    return next(error);
  }
};

// ── Get one team (any logged-in user) ──
export const getTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });

    const team = await findTeamWithRows(prisma, teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    res.json(toTeamDetail(team, viewerFrom(req)));
  } catch (error) {
    return next(error);
  }
};

// ── Get my teams ──
// Teams the viewer captains or is an accepted member of (a pending invite doesn't count).
// Each team also says how full it is, and the captain gets the number of join requests
// waiting (for the "2 join requests waiting for you" line).
export const getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { captainId: userId },
          { members: { some: { userId, status: 'accepted' } } },
        ],
      },
      include: ALL_ROWS_WITH_PEOPLE,
      orderBy: { createdAt: 'desc' },
    });

    const viewer = viewerFrom(req);
    res.json(
      teams.map((team) => {
        const item = {
          ...toTeamListItem(team, viewer),
          memberCount: team.members.filter(isMember).length,
          maxMembers: MAX_TEAM_MEMBERS,
        };
        if (team.captainId === userId) item.joinRequestCount = team.members.filter(isPendingRequest).length;
        return item;
      })
    );
  } catch (error) {
    return next(error);
  }
};
