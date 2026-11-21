import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser } from '../utils/visibility.js';
import { removeTeamRows } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';
import {
  MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
  MAX_TEAM_MEMBERS,
  isMember,
  isPendingInvite,
  isPendingRequest,
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

// ── Create new team ──
export const createTeam = async (req, res, next) => {
  try {
    // Trimmed, 2–40 characters; description trimmed, at most 200, or null (createTeamSchema).
    const { name, description } = req.valid.body;
    const captainId = req.user.id;

    // The creator becomes the captain (stored only in captainId) and is also an
    // accepted member of the team (origin 'creator', accepted straight away).
    const team = await prisma.team.create({
      data: {
        name,
        description,
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
    const { name, description } = req.valid.body;

    const reply = await withLockedTeam(teamId, async (tx, team) => {
      if (team.captainId !== req.user.id) return [403, { error: 'Only the team captain can edit this team.' }];
      await tx.team.update({ where: { id: teamId }, data: { name, description } });
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

// Captain first, then the longest-standing member (earliest acceptedAt, ties to the
// lower row id; docs/PRODUCT.md, "Team membership").
const time = (date) => (date ? date.getTime() : Infinity);
function inMemberOrder(rows, captainId) {
  return [...rows].sort(
    (a, b) =>
      (b.userId === captainId) - (a.userId === captainId) ||
      time(a.acceptedAt) - time(b.acceptedAt) ||
      a.id - b.id
  );
}
const oldestFirst = (a, b) => time(a.createdAt) - time(b.createdAt) || a.id - b.id;
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

// Where the viewer stands with this team. Venue owners and the admin can't join teams,
// so they're always 'none'.
function viewerStateOf(team, viewer) {
  if (viewer.role !== 'PLAYER') return 'none';
  if (team.captainId === viewer.id) return 'captain';
  const own = team.members.find((row) => row.userId === viewer.id);
  if (!own) return 'none';
  if (isMember(own)) return 'member';
  return isPendingInvite(own) ? 'invited' : 'requested';
}

// A team in a list (GET /teams, GET /teams/me):
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

// ── Get all teams ──
export const getTeams = async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      include: ALL_ROWS_WITH_PEOPLE,
      orderBy: { createdAt: 'desc' },
    });

    const viewer = viewerFrom(req);
    res.json(teams.map((team) => toTeamListItem(team, viewer)));
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
