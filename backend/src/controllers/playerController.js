import { prisma } from '../db.js';
import { viewerFrom, toVisibleUser, toPlayerStats } from '../utils/visibility.js';
import { parseId } from '../utils/ids.js';

export const listPlayers = async (req, res, next) => {
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

    // flatten to match frontend expecting {id, name, email}; the visibility rules then
    // drop the email for everyone except yourself (and the admin)
    const viewer = viewerFrom(req);
    const result = players.map((p) =>
      toVisibleUser(
        { id: p.id, email: p.email, createdAt: p.createdAt, name: p.playerProfile?.name || 'Unknown' },
        viewer
      )
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
};


export const getMyPlayerProfile = async (req, res, next) => {
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

    return res.json(toVisibleUser(user, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};
// NEW: get pending invites for current user
export const getPendingInvites = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const invites = await prisma.teamMember.findMany({
      where: { userId, status: "pending" },
      include: {
        team: {
          include: {
            // The team's creator (captain) is always a player, so the name comes
            // from their player profile.
            owner: {
              select: {
                id: true,
                playerProfile: { select: { name: true } },
              },
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
    // The captain is another user: show them through the visibility rules ({ id, name }).
    const viewer = viewerFrom(req);
    res.json(
      invites.map((invite) => {
        const { owner } = invite.team;
        return {
          ...invite,
          team: {
            ...invite.team,
            owner: toVisibleUser({ id: owner.id, name: owner.playerProfile?.name || 'Unknown' }, viewer),
          },
        };
      })
    );
  } catch (err) {
    return next(err);
  }
};


//  get player stats
export const getPlayerStats = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid player id' });
    // Only accepted memberships count; a pending invite isn't a team yet.
    const totalTeams = await prisma.teamMember.count({ where: { userId: id, status: 'accepted' } });
    const user = await prisma.user.findUnique({ where: { id }, select: { createdAt: true } });
    res.json(toPlayerStats({ totalTeams, user }));
  } catch (err) {
    return next(err);
  }
};



