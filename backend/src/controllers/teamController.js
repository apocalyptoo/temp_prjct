import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Create new team ──
export const createTeam = async (req, res, next) => {
  try {
    const { name, description } = req.body;
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
    const { teamId } = req.params;
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== requesterId) {
      return res.status(403).json({ error: 'Only the team owner can delete this team.' });
    }

    // Delete members first then team
    await prisma.teamMember.deleteMany({ where: { teamId: Number(teamId) } });
    await prisma.team.delete({ where: { id: Number(teamId) } });

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

// ── Get all teams ──
export const getTeams = async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten member names
    const result = teams.map((t) => ({
      ...t,
      members: t.members.map((m) => ({
        ...m,
        user: {
          ...m.user,
          name:
            m.user?.playerProfile?.name ||
            m.user?.ownerProfile?.indoorName ||
            'Unknown',
        },
      })),
    }));

    res.json(result);
  } catch (error) {
    return next(error);
  }
};

// ── Get my teams ──
export const getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: Number(userId) },
          { members: { some: { userId: Number(userId), status: 'accepted' } } },
        ],
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = teams.map((t) => ({
      ...t,
      members: t.members.map((m) => ({
        ...m,
        user: {
          ...m.user,
          name:
            m.user?.playerProfile?.name ||
            m.user?.ownerProfile?.indoorName ||
            'Unknown',
        },
      })),
    }));

    res.json(result);
  } catch (error) {
    return next(error);
  }
};