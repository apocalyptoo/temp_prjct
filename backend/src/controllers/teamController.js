// Remove a player from team (owner only)
export const removePlayer = async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const requesterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== requesterId) {
      return res.status(403).json({ error: 'Only the team owner can remove players.' });
    }
    // Prevent owner from removing themselves
    if (Number(userId) === requesterId) {
      return res.status(400).json({ error: 'Owner cannot remove themselves from the team.' });
    }
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId: Number(userId) } }
    });
    if (!member) return res.status(404).json({ error: 'Player not found in team' });
    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: Number(teamId), userId: Number(userId) } }
    });
    res.status(200).json({ message: 'Player removed from team' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove player', details: error.message });
  }
};

// Delete a team (owner only)
export const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const requesterId = req.user.id;
    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== requesterId) {
      return res.status(403).json({ error: 'Only the team owner can delete the team.' });
    }
    await prisma.teamMember.deleteMany({ where: { teamId: Number(teamId) } });
    await prisma.team.delete({ where: { id: Number(teamId) } });
    res.status(200).json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete team', details: error.message });
  }
};
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Create new team
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
            role: "captain",
            status: "accepted",
          },
        },
      },
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ error: "Failed to create team", details: error.message });
  }
};

export const joinTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Only allow join if invited (status: pending)
    const invite = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } }
    });
    if (!invite || invite.status !== 'pending') {
      return res.status(403).json({ error: 'You must be invited by the team owner to join this team.' });
    }

    // Accept invite (handled by acceptInvite endpoint)
    return res.status(400).json({ error: 'Use the accept invite endpoint to join a team.' });
  } catch (error) {
    res.status(500).json({ error: "Join request failed", details: error.message });
  }
};


export const invitePlayer = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    const inviterId = req.user.id;

    const team = await prisma.team.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== inviterId) {
      return res.status(403).json({ error: "Only the team owner can invite players." });
    }

    // Check if player is already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } }
    });
    if (existing) return res.status(400).json({ error: "Player is already invited or in the team." });

    const invite = await prisma.teamMember.create({
      data: { teamId: Number(teamId), userId, status: "pending" }
    });

    res.status(201).json(invite);
  } catch (error) {
    res.status(500).json({ error: "Failed to invite player", details: error.message });
  }
};


export const acceptInvite = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    await prisma.teamMember.updateMany({
      where: { teamId: Number(teamId), userId },
      data: { status: "accepted" },
    });

    res.status(200).json({ message: "Joined team successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to join team", details: error.message });
  }
};

// reject invite -> delete the teamMember row (only invited user can reject)
export const rejectInvite = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: Number(teamId), userId } }
    });

    if (!member) return res.status(404).json({ error: "Invite not found" });
    if (member.userId !== userId) return res.status(403).json({ error: "Not authorized" });

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: Number(teamId), userId } }
    });

    res.status(200).json({ message: "Invite rejected" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject invite", details: error.message });
  }
};

export const getTeams = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: { members: { include: { user: true } } },
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch teams", details: error.message });
  }
};

// View joined/created teams

export const getMyTeams = async (req, res) => {
  try {
    const userId = req.user.id;

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: Number(userId) },
          { members: { some: { userId: Number(userId), status: 'accepted' } } }
        ]
      },
      include: { members: { include: { user: true } } },
    });

    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user's teams", details: error.message });
  }
};
