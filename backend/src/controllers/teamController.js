import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser } from '../utils/visibility.js';
import { deleteTeamAndMembers } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';

// Request bodies are checked by the schemas in src/validation/teamSchemas.js before
// these handlers run (see teamRoutes.js). The handlers read them from req.valid.body.

// ── Create new team ──
export const createTeam = async (req, res, next) => {
  try {
    // Trimmed, 2–40 characters; description trimmed, at most 200, or null (createTeamSchema).
    const { name, description } = req.valid.body;
    const ownerId = req.user.id;

    const team = await prisma.team.create({
      data: {
        name,
        description,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'captain',
            status: 'accepted',
          },
        },
      },
    });

    res.status(201).json(team);
  } catch (error) {
    return next(error);
  }
};

// ── Invite player (owner only) ──
export const invitePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    // A real positive whole number, not a string, an object or a decimal (inviteSchema).
    const { userId } = req.valid.body;
    const inviterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== inviterId) {
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
      data: { teamId, userId, status: 'pending' },
    });

    res.status(201).json(invite);
  } catch (error) {
    return next(error);
  }
};

// ── Remove player (owner only) ──
export const removePlayer = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid player id' });
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Only team owner can remove players
    if (team.ownerId !== requesterId) {
      return res.status(403).json({ error: 'Only the team captain can remove players.' });
    }

    // Owner cannot remove themselves
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

// ── Delete team (owner only) ──
export const deleteTeam = async (req, res, next) => {
  try {
    const teamId = parseId(req.params.teamId);
    if (teamId === null) return res.status(400).json({ error: 'Invalid team id' });
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== requesterId) {
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
      data: { status: 'accepted' },
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

// Team lists load every membership row (accepted and pending) with the member's name.
const MEMBERS_WITH_NAMES = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          playerProfile: { select: { name: true } },
          ownerProfile: { select: { indoorName: true } },
        },
      },
    },
  },
};

// Shapes one team for the viewer:
// - members: accepted members only (a pending invite isn't membership yet);
// - pendingInvites: the team's pending invites, only for the team's captain
//   (Team.ownerId), so they can see who they've invited. Nobody else gets the field.
// Members are other users, so they go through the visibility rules (no email).
function toTeamResponse(team, viewer) {
  const withVisibleUser = (m) => ({
    ...m,
    user: toVisibleUser(
      {
        ...m.user,
        name: m.user?.playerProfile?.name || m.user?.ownerProfile?.indoorName || 'Unknown',
      },
      viewer
    ),
  });
  const { members, ...rest } = team;
  const result = { ...rest, members: members.filter((m) => m.status === 'accepted').map(withVisibleUser) };
  if (team.ownerId === viewer.id) {
    result.pendingInvites = members.filter((m) => m.status === 'pending').map(withVisibleUser);
  }
  return result;
}

// ── Get all teams ──
export const getTeams = async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      include: MEMBERS_WITH_NAMES,
      orderBy: { createdAt: 'desc' },
    });

    const viewer = viewerFrom(req);
    res.json(teams.map((team) => toTeamResponse(team, viewer)));
  } catch (error) {
    return next(error);
  }
};

// ── Get my teams ──
// Teams the viewer created or is an accepted member of (a pending invite doesn't count).
export const getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: 'accepted' } } },
        ],
      },
      include: MEMBERS_WITH_NAMES,
      orderBy: { createdAt: 'desc' },
    });

    const viewer = viewerFrom(req);
    res.json(teams.map((team) => toTeamResponse(team, viewer)));
  } catch (error) {
    return next(error);
  }
};
