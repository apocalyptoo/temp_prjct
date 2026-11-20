import { prisma } from '../db.js';
import { withoutSecrets } from '../utils/visibility.js';
import { deleteUserAndData, deleteTeamAndMembers } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';

// ── Get all users ──
export const getAllUsers = async (req, res, next) => {
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

    return res.json(withoutSecrets(result)); // admin sees everything except secrets
  } catch (err) {
    return next(err);
  }
};

// ── Delete an account (shared by /admin/users/:id and /admin/indoors/:id) ──
// Safety rules for both routes:
// - the admin can't delete their own account, or any ADMIN account (403);
// - each route deletes only the roles it's for; any other account is "not found" (404).
// Roles can't change through the API, so checking the role just before the delete is safe.
const CANT_DELETE_SELF = "You can't delete your own account from the admin screens.";
const CANT_DELETE_ADMIN = "Admin accounts can't be deleted from the admin screens.";

const deleteAccount = ({ allowedRoles, invalidIdMessage, notFoundMessage, successMessage }) =>
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: invalidIdMessage });
      if (id === req.user.id) return res.status(403).json({ error: CANT_DELETE_SELF });

      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) return res.status(404).json({ error: notFoundMessage });
      if (target.role === 'ADMIN') return res.status(403).json({ error: CANT_DELETE_ADMIN });
      if (!allowedRoles.includes(target.role)) return res.status(404).json({ error: notFoundMessage });

      // Memberships, created teams, profile and account, all in one transaction.
      const deleted = await deleteUserAndData(prisma, id);
      if (!deleted) return res.status(404).json({ error: notFoundMessage });

      return res.json({ message: successMessage });
    } catch (err) {
      return next(err);
    }
  };

// /admin/users/:id: players and venue owners.
export const deleteUser = deleteAccount({
  allowedRoles: ['PLAYER', 'OWNER'],
  invalidIdMessage: 'Invalid user id',
  notFoundMessage: 'User not found',
  successMessage: 'User deleted successfully',
});

// /admin/indoors/:id: venue owners only (deleting the venue deletes the owner's account).
export const deleteIndoor = deleteAccount({
  allowedRoles: ['OWNER'],
  invalidIdMessage: 'Invalid venue id',
  notFoundMessage: 'Venue not found',
  successMessage: 'Venue deleted successfully',
});

// ── Get all teams ──
export const getAllTeams = async (req, res, next) => {
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
        // Count only accepted members (a pending invite isn't membership yet).
        _count: { select: { members: { where: { status: 'accepted' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.createdAt,
      memberCount: t._count.members,
      owner: {
        id: t.owner.id,
        email: t.owner.email,
        name:
          t.owner.ownerProfile?.indoorName ||
          t.owner.playerProfile?.name ||
          'Unknown',
      },
    }));

    return res.json(withoutSecrets(result)); // admin sees everything except secrets
  } catch (err) {
    return next(err);
  }
};

// ── Delete team ──
export const deleteTeam = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid team id' });

    const deleted = await deleteTeamAndMembers(prisma, id);
    if (!deleted) return res.status(404).json({ error: 'Team not found' });

    return res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// ── Get all indoors (owner profiles) ──
export const getAllIndoors = async (req, res, next) => {
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
      website: o.website, 
      description: o.description,
    }));

    return res.json(withoutSecrets(result)); // admin sees everything except secrets
  } catch (err) {
    return next(err);
  }
};

// ── Stats ──
export const getStats = async (req, res, next) => {
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
    return next(err);
  }
};