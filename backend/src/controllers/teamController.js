import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Create new team ──
export const createTeam = async (req, res) => {
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
    res.status(500).json({ error: 'Failed to create team', details: error.message });
  }
};

// ── Join team ──
export const joinTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const request = await prisma.teamMember.create({
      data: { teamId: Number(teamId), userId },
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: 'Join request failed', details: error.message });
  }
};

// ── Invite player (owner only) ──
export const invitePlayer = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    const inviterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== inviterId) {
      return res.status(403).json({ error: 'Only the team owner can invite players.' });
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } },
    });
    if (existing) return res.status(400).json({ error: 'Player is already invited or in the team.' });

    const invite = await prisma.teamMember.create({
      data: { teamId: Number(teamId), userId, status: 'pending' },
    });

    res.status(201).json(invite);
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite player', details: error.message });
  }
};

// ── Remove player (owner only) ──
export const removePlayer = async (req, res) => {
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
    res.status(500).json({ error: 'Failed to remove player', details: error.message });
  }
};

// ── Delete team (owner only) ──
export const deleteTeam = async (req, res) => {
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
    res.status(500).json({ error: 'Failed to delete team', details: error.message });
  }
};

// ── Accept invite ──
export const acceptInvite = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    await prisma.teamMember.updateMany({
      where: { teamId: Number(teamId), userId },
      data: { status: 'accepted' },
    });

    res.status(200).json({ message: 'Joined team successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join team', details: error.message });
  }
};

// ── Reject invite ──
export const rejectInvite = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } },
    });

    if (!member) return res.status(404).json({ error: 'Invite not found' });
    if (member.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: Number(teamId), userId } },
    });

    res.status(200).json({ message: 'Invite rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject invite', details: error.message });
  }
};

// ── Get all teams ──
export const getTeams = async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch teams', details: error.message });
  }
};

// ── Get my teams ──
export const getMyTeams = async (req, res) => {
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
    res.status(500).json({ error: "Failed to fetch user's teams", details: error.message });
  }
};