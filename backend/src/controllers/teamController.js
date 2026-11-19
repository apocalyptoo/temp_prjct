import { PrismaClient } from '@prisma/client';
import { viewerFrom, toVisibleUser } from '../utils/visibility.js';
import { deleteTeamAndMembers } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';
const prisma = new PrismaClient();

const TEAM_NAME_MIN = 2;
const TEAM_NAME_MAX = 40;
const TEAM_DESCRIPTION_MAX = 200;

// Counts characters as people see them (so a Bangla name or an emoji isn't counted
// as several characters).
const charCount = (text) => [...text].length;

// Checks the team name and description. Returns { error } or the cleaned { name,
// description } (trimmed; an empty or missing description becomes null).
// Team names don't have to be unique.
function checkTeamInput(body) {
  const { name: rawName, description: rawDescription } = body ?? {};

  if (rawName === undefined || rawName === null) return { error: 'Team name is required' };
  if (typeof rawName !== 'string') return { error: 'Team name must be text' };
  const name = rawName.trim();
  if (name === '') return { error: 'Team name is required' };
  if (charCount(name) < TEAM_NAME_MIN || charCount(name) > TEAM_NAME_MAX) {
    return { error: `Team name must be between ${TEAM_NAME_MIN} and ${TEAM_NAME_MAX} characters` };
  }

  let description = null;
  if (rawDescription !== undefined && rawDescription !== null) {
    if (typeof rawDescription !== 'string') return { error: 'Description must be text' };
    description = rawDescription.trim() || null;
    if (description && charCount(description) > TEAM_DESCRIPTION_MAX) {
      return { error: `Description must be at most ${TEAM_DESCRIPTION_MAX} characters` };
    }
  }

  return { name, description };
}

// ── Create new team ──
export const createTeam = async (req, res, next) => {
  try {
    const { error, name, description } = checkTeamInput(req.body);
    if (error) return res.status(400).json({ error });
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
    const { teamId } = req.params;
    const { userId } = req.body;
    const inviterId = req.user.id;

    // userId goes into a Prisma query, so it must be a real positive whole number
    // (not a string, an object or a decimal).
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId must be a positive integer' });
    }

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== inviterId) {
      return res.status(403).json({ error: 'Only the team owner can invite players.' });
    }

    // Only existing PLAYER accounts can be invited. An unknown id, or a venue owner or
    // admin account, gets the same 404 (instead of a database error).
    const invitee = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!invitee || invitee.role !== 'PLAYER') return res.status(404).json({ error: 'Player not found' });

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } },
    });
    if (existing) return res.status(400).json({ error: 'Player is already invited or in the team.' });

    const invite = await prisma.teamMember.create({
      data: { teamId: Number(teamId), userId, status: 'pending' },
    });

    res.status(201).json(invite);
  } catch (error) {
    return next(error);
  }
};

// ── Remove player (owner only) ──
export const removePlayer = async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Only team owner can remove players
    if (team.ownerId !== requesterId) {
      return res.status(403).json({ error: 'Only the team owner can remove players.' });
    }

    // Owner cannot remove themselves
    if (Number(userId) === requesterId) {
      return res.status(400).json({ error: 'Team owner cannot remove themselves.' });
    }

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId: Number(userId) } },
    });
    if (!member) return res.status(404).json({ error: 'Player not found in this team.' });

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: Number(teamId), userId: Number(userId) } },
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
      return res.status(403).json({ error: 'Only the team owner can delete this team.' });
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
    const { teamId } = req.params;
    const userId = req.user.id;

    // Only a pending row can be accepted. Interim: pending rows can only be created by
    // the captain's invite (the /join route was removed until Phase 4 can tell
    // invites and join requests apart).
    const { count } = await prisma.teamMember.updateMany({
      where: { teamId: Number(teamId), userId, status: 'pending' },
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
    const { teamId } = req.params;
    const userId = req.user.id;

    // Only a pending row can be rejected, so this can't remove an accepted membership
    // (including the captain's own).
    const { count } = await prisma.teamMember.deleteMany({
      where: { teamId: Number(teamId), userId, status: 'pending' },
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
