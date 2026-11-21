import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser } from '../utils/visibility.js';
import { deleteTeamAndMembers } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';
import {
  MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
  MAX_TEAM_MEMBERS,
  isMember,
  isPendingInvite,
  isPendingRequest,
  toMembershipReply,
} from '../utils/membership.js';

// Request bodies are checked by the schemas in src/validation/teamSchemas.js before
// these handlers run (see teamRoutes.js). The handlers read them from req.valid.body.

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
export const invitePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    // A real positive whole number, not a string, an object or a decimal (inviteSchema).
    const { userId } = req.valid.body;
    const inviterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.captainId !== inviterId) {
      return res.status(403).json({ error: 'Only the team captain can invite players.' });
    }

    // Only existing PLAYER accounts can be invited. An unknown id, or a venue owner or
    // admin account, gets the same 404 (instead of a database error).
    const invitee = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!invitee || invitee.role !== 'PLAYER') return res.status(404).json({ error: 'Player not found' });

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) return res.status(400).json({ error: 'Player is already invited or in the team.' });

    const invite = await prisma.teamMember.create({
      data: { teamId, userId, status: 'pending', origin: 'invite' },
      omit: MEMBERSHIP_FIELDS_NOT_IN_REPLIES,
    });

    res.status(201).json(invite);
  } catch (error) {
    return next(error);
  }
};

// ── Remove player (captain only) ──
export const removePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Only the team captain can remove players
    if (team.captainId !== requesterId) {
      return res.status(403).json({ error: 'Only the team captain can remove players.' });
    }

    // The captain cannot remove themselves
    if (userId === requesterId) {
      return res.status(400).json({ error: 'The team captain cannot remove themselves.' });
    }

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) return res.status(404).json({ error: 'Player not found in this team.' });

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    return res.json({ message: 'Player removed successfully.' });
  } catch (error) {
    return next(error);
  }
};

// ── Delete team (captain only) ──
export const deleteTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.captainId !== requesterId) {
      return res.status(403).json({ error: 'Only the team captain can delete this team.' });
    }

    // Members and team in one transaction (shared with the admin delete).
    await deleteTeamAndMembers(prisma, teamId);

    return res.json({ message: 'Team deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

// ── Accept invite ──
export const acceptInvite = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    // Only a pending row can be accepted. Interim: pending rows can only be created by
    // the captain's invite (the /join route was removed until Phase 4 can tell
    // invites and join requests apart).
    const { count } = await prisma.teamMember.updateMany({
      where: { teamId, userId, status: 'pending' },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    if (count === 0) return res.status(404).json({ error: 'Invite not found' });

    res.status(200).json({ message: 'Joined team successfully' });
  } catch (error) {
    return next(error);
  }
};

// ── Reject invite ──
export const rejectInvite = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = req.user.id;

    // Only a pending row can be rejected, so this can't remove an accepted membership
    // (including the captain's own).
    const { count } = await prisma.teamMember.deleteMany({
      where: { teamId, userId, status: 'pending' },
    });
    if (count === 0) return res.status(404).json({ error: 'Invite not found' });

    res.status(200).json({ message: 'Invite rejected' });
  } catch (error) {
    return next(error);
  }
};

// Team replies load every membership row of the team (accepted and pending) with the
// person's name and position. Rows are shaped by toMembershipReply before they reach a
// reply, so origin, acceptedAt and message never leak.
const ALL_ROWS_WITH_PEOPLE = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          playerProfile: { select: { name: true, position: true } },
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
// email, phone or address of other users), the row through toMembershipReply.
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
