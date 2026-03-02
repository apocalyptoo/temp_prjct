/*import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    //  Remove this user from any team memberships
    await prisma.teamMember.deleteMany({ where: { userId: id } });

    //  Delete all teams owned by this user
    const ownedTeams = await prisma.team.findMany({ where: { ownerId: id } });
    for (const team of ownedTeams) {
      // Delete team members first
      await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
      // Then delete the team
      await prisma.team.delete({ where: { id: team.id } });
    }

    //  Delete the user
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
};


// Get all teams
export const getAllTeams = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: { owner: { select: { name: true, email: true } } }
    });
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete team 
export const deleteTeam = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    //  Delete all team members
    await prisma.teamMember.deleteMany({ where: { teamId: id } });

    // Delete the team
    await prisma.team.delete({ where: { id } });

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team', details: err.message });
  }
};

// System summary
export const getStats = async (req, res) => {
  try {
    const [userCount, teamCount] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
    ]);
    res.json({ userCount, teamCount });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
*/

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Get all users ──
export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        verified: true,
        playerProfile: { select: { name: true } },
        ownerProfile: { select: { indoorName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      verified: u.verified,
      name:
        u.role === 'PLAYER'
          ? u.playerProfile?.name || 'N/A'
          : u.role === 'OWNER'
          ? u.ownerProfile?.indoorName || 'N/A'
          : 'Admin',
    }));

    return res.json(result);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ── Delete user (full cascade) ──
export const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 1) Remove from team memberships
    await prisma.teamMember.deleteMany({ where: { userId: id } });

    // 2) Delete owned teams
    const ownedTeams = await prisma.team.findMany({ where: { ownerId: id } });
    for (const team of ownedTeams) {
      await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
      await prisma.team.delete({ where: { id: team.id } });
    }

    // 3) Delete profile
    await prisma.playerProfile.deleteMany({ where: { userId: id } });
    await prisma.ownerProfile.deleteMany({ where: { userId: id } });

    // 4) Delete user
    await prisma.user.delete({ where: { id } });

    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
};

// ── Get all teams ──
export const getAllTeams = async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            ownerProfile: { select: { indoorName: true } },
            playerProfile: { select: { name: true } },
          },
        },
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.createdAt,
      memberCount: t.members.length,
      owner: {
        id: t.owner.id,
        email: t.owner.email,
        name:
          t.owner.ownerProfile?.indoorName ||
          t.owner.playerProfile?.name ||
          'Unknown',
      },
    }));

    return res.json(result);
  } catch (err) {
    console.error('Error fetching teams:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ── Delete team ──
export const deleteTeam = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });
    return res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('Error deleting team:', err);
    return res.status(500).json({ error: 'Failed to delete team', details: err.message });
  }
};

// ── Get all indoors (owner profiles) ──
export const getAllIndoors = async (req, res) => {
  try {
    const indoors = await prisma.ownerProfile.findMany({
      include: {
        user: {
          select: { id: true, email: true, createdAt: true, verified: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    const result = indoors.map((o) => ({
      userId: o.userId,
      email: o.user.email,
      createdAt: o.user.createdAt,
      verified: o.user.verified,
      indoorName: o.indoorName,
      phone: o.phone,
      address: o.address,
      description: o.description,
    }));

    return res.json(result);
  } catch (err) {
    console.error('Error fetching indoors:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ── Stats ──
export const getStats = async (req, res) => {
  try {
    const [userCount, teamCount, playerCount, ownerCount, adminCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.user.count({ where: { role: 'PLAYER' } }),
        prisma.user.count({ where: { role: 'OWNER' } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
      ]);

    return res.json({
      userCount,
      teamCount,
      playerCount,
      ownerCount,
      adminCount,
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};