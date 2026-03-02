import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/*export const listPlayers = async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: { id: true, name: true, email: true, createdAt: true }
    });
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players', details: err.message });
  }
};*/



export const listPlayers = async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: {
        role: 'PLAYER',
        playerProfile: { isNot: null }, // avoids null profiles breaking mapping
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        playerProfile: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // flatten to match frontend expecting {id, name, email}
    const result = players.map((p) => ({
      id: p.id,
      email: p.email,
      createdAt: p.createdAt,
      name: p.playerProfile?.name || 'Unknown',
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch players', details: err.message });
  }
};


export const getMyPlayerProfile = async (req, res) => {
  try {
    if (req.user.role !== 'PLAYER') {
      return res.status(403).json({ error: 'Players only' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        playerProfile: {
          select: {
            name: true,
            phone: true,
            position: true,
            height: true,
            weight: true,
            address: true,
          },
        },
      },
    });

    if (!user || !user.playerProfile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch player profile', details: err.message });
  }
};
// NEW: get pending invites for current user
export const getPendingInvites = async (req, res) => {
  try {
    const userId = req.user.id;
    const invites = await prisma.teamMember.findMany({
      where: { userId, status: "pending" },
      include: {
        team: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                ownerProfile: { select: { indoorName: true } },
              },
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites', details: err.message });
  }
};


//  get player stats
export const getPlayerStats = async (req, res) => {
  try {
    const { id } = req.params;
    const totalTeams = await prisma.teamMember.count({ where: { userId: Number(id) } });
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    res.json({
      totalTeams,
      joinedAt: user?.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
};



