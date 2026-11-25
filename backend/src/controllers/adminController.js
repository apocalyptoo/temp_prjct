import { prisma } from '../db.js';
import { viewerFrom, withoutSecrets } from '../utils/visibility.js';
import { deleteAccountAndNotify } from '../utils/accountDeletion.js';
import { deleteTeamAndMembers, planAccountDeletion, toDeletionPreview } from '../utils/deletion.js';
import { parseId } from '../utils/ids.js';
import { isLive, missingFields, withMissingFields } from '../utils/venues.js';
import { createUpdates, lockUsers, venueUpdate } from '../utils/notifications.js';

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

// ── Delete an account, and preview it (/admin/users/:id and /admin/indoors/:id) ──
// Safety rules for both, in this order:
// - the admin can't delete their own account, or any ADMIN account (403);
// - each route deletes only the roles it's for; any other account is "not found" (404).
// Roles can't change through the API, so checking the role just before the delete is
// safe (and the shared deletion refuses an ADMIN account itself).
const CANT_DELETE_SELF = "You can't delete your own account from the admin screens.";
const CANT_DELETE_ADMIN = "Admin accounts can't be deleted from the admin screens.";
const DELETION_CHANGED = "Something changed in this user's teams. Check what will happen and try again.";

// /admin/users/:id: players and venue owners.
const USERS = {
  allowedRoles: ['PLAYER', 'OWNER'],
  invalidIdMessage: 'Invalid user id',
  notFoundMessage: 'User not found',
  successMessage: 'User deleted successfully',
};
// /admin/indoors/:id: venue owners only (deleting the venue deletes the owner's account).
const INDOORS = {
  allowedRoles: ['OWNER'],
  invalidIdMessage: 'Invalid venue id',
  notFoundMessage: 'Venue not found',
  successMessage: 'Venue deleted successfully',
};

// The account the route may act on, as { id }, or why not, as { refusal: [status, error] }.
async function findDeletable(req, { allowedRoles, invalidIdMessage, notFoundMessage }) {
  const id = parseId(req.params.id);
  if (id === null) return { refusal: [400, invalidIdMessage] };
  if (id === req.user.id) return { refusal: [403, CANT_DELETE_SELF] };

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return { refusal: [404, notFoundMessage] };
  if (target.role === 'ADMIN') return { refusal: [403, CANT_DELETE_ADMIN] };
  if (!allowedRoles.includes(target.role)) return { refusal: [404, notFoundMessage] };
  return { id };
}

const refuse = (res, [status, error]) => res.status(status).json({ error });

// What the delete would do to the account's teams and venue
// (docs/features/account-deletion.md, d.4 endpoints 3 and 4).
const previewDelete = (route) => async (req, res, next) => {
  try {
    const { id, refusal } = await findDeletable(req, route);
    if (refusal) return refuse(res, refusal);

    const plan = await planAccountDeletion(prisma, id);
    if (!plan) return refuse(res, [404, route.notFoundMessage]); // deleted since the check
    return res.json(toDeletionPreview(plan, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};

// The shared deletion (endpoints 5 and 6): captained teams are handed over or deleted,
// and the account's owner gets the notice email.
// With ?previewCode=… it's refused when the outcome isn't what the preview showed (P12).
const deleteAccount = (route) => async (req, res, next) => {
  try {
    const { id, refusal } = await findDeletable(req, route);
    if (refusal) return refuse(res, refusal);

    const { previewCode } = req.valid.query;
    const { status } = await deleteAccountAndNotify(prisma, id, { previewCode, adminId: req.user.id });
    if (status === 'gone') return refuse(res, [404, route.notFoundMessage]);
    if (status === 'admin') return refuse(res, [403, CANT_DELETE_ADMIN]);
    if (status === 'stale') return refuse(res, [409, DELETION_CHANGED]);
    return res.json({ message: route.successMessage });
  } catch (err) {
    return next(err);
  }
};

export const previewDeleteUser = previewDelete(USERS);
export const deleteUser = deleteAccount(USERS);
export const previewDeleteIndoor = previewDelete(INDOORS);
export const deleteIndoor = deleteAccount(INDOORS);

// ── Get all teams ──
export const getAllTeams = async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        captain: {
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
      captain: {
        id: t.captain.id,
        email: t.captain.email,
        name:
          t.captain.ownerProfile?.indoorName ||
          t.captain.playerProfile?.name ||
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

    const deleted = await deleteTeamAndMembers(prisma, id, { actorId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Team not found' });

    return res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// ── Venues (docs/features/venues.md, d endpoints 5–8) ──

// Everything the admin sees about a venue: the listing, the owner's email, join date
// and whether they verified their email, the review state and the admin's note.
const ADMIN_VENUE_SELECT = {
  userId: true,
  indoorName: true,
  phone: true,
  address: true,
  area: true,
  website: true,
  description: true,
  openingHours: true,
  pricingInfo: true,
  approvedAt: true,
  reviewNote: true,
  user: { select: { email: true, createdAt: true, verified: true } },
};

// Flattened, with missingFields (spec P8). Admin replies keep everything but secrets.
const toAdminVenue = ({ user, ...venue }) =>
  withoutSecrets(withMissingFields({ ...venue, email: user.email, createdAt: user.createdAt, verified: user.verified }));

// `db` is the Prisma client or a transaction.
const loadAdminVenue = (userId, db = prisma) => db.ownerProfile.findUnique({ where: { userId }, select: ADMIN_VENUE_SELECT });

// Runs `work(tx)` in one transaction whose first step locks the venue owner's user row
// (docs/features/notifications.md, P20): the change to the venue and the owner's update
// are saved together, or not at all. The lock must come before the venue is written,
// because account deletion takes them in that order too: the other way round, an approval
// and the owner deleting their account would wait for each other (tried on 2026-11-26).
// `work` returns the reply as [status, body]; no such account is 404 "Venue not found".
const withLockedOwner = (userId, work) =>
  prisma.$transaction(async (tx) => {
    const found = await lockUsers(tx, [userId]);
    return found.has(userId) ? work(tx) : [404, { error: VENUE_NOT_FOUND }];
  });

// GET /admin/indoors: every venue. Pending venues first, oldest waiting first (by the
// owner's sign-up date), then live venues by name A to Z (spec P13).
export const getAllIndoors = async (req, res, next) => {
  try {
    const venues = (await prisma.ownerProfile.findMany({ select: ADMIN_VENUE_SELECT })).map(toAdminVenue);
    const pending = venues.filter((v) => !isLive(v)).sort((a, b) => a.createdAt - b.createdAt || a.userId - b.userId);
    const live = venues
      .filter((v) => isLive(v))
      .sort((a, b) => (a.indoorName < b.indoorName ? -1 : a.indoorName > b.indoorName ? 1 : a.userId - b.userId));
    return res.json([...pending, ...live]);
  } catch (err) {
    return next(err);
  }
};

const INVALID_VENUE_ID = 'Invalid venue id';
const VENUE_NOT_FOUND = 'Venue not found';
const ALREADY_LIVE = 'This venue is already live';
const OWNER_UNVERIFIED = "The owner hasn't verified their email yet";
const LIVE_NO_NOTE = 'This venue is live. Move it back to review to leave a note';
const ALREADY_PENDING = 'This venue is already waiting for review';

// Why a venue can't be approved right now, as a reply ([status, body]), or null if it can.
// Checked in this order: already live, the owner unverified (spec Q5), incomplete (with
// the missing fields in the reply, spec P14).
function approvalRefusal(venue) {
  if (isLive(venue)) return [409, { error: ALREADY_LIVE }];
  if (!venue.user.verified) return [409, { error: OWNER_UNVERIFIED }];
  const missing = missingFields(venue);
  if (missing.length > 0) {
    return [409, { error: `This venue can't go live yet. Missing: ${missing.join(', ')}`, missingFields: missing }];
  }
  return null;
}

// POST /admin/indoors/:id/approve (spec d endpoint 6). The approval is one conditional
// update that only applies while the venue is still pending, complete and its owner
// verified (spec P11), so an owner emptying a field at the same moment can't leave an
// incomplete venue live. Approving clears the admin's note (spec D5), and tells the owner
// in the same transaction.
export const approveIndoor = async (req, res, next) => {
  try {
    const userId = parseId(req.params.id);
    if (userId === null) return res.status(400).json({ error: INVALID_VENUE_ID });

    const [status, body] = await withLockedOwner(userId, async (tx) => {
      const venue = await loadAdminVenue(userId, tx);
      if (!venue) return [404, { error: VENUE_NOT_FOUND }];
      const refusal = approvalRefusal(venue);
      if (refusal) return refusal;

      const { count } = await tx.ownerProfile.updateMany({
        where: {
          userId,
          approvedAt: null,
          address: { not: null },
          area: { not: null },
          phone: { not: null },
          user: { is: { verified: true } },
        },
        data: { approvedAt: new Date(), reviewNote: null },
      });
      const now = await loadAdminVenue(userId, tx);
      if (count === 0) {
        // The venue changed between the check and the update: say what stops it now.
        if (!now) return [404, { error: VENUE_NOT_FOUND }];
        return approvalRefusal(now) ?? [409, { error: ALREADY_LIVE }];
      }

      await createUpdates(tx, [venueUpdate('venueApproved', userId, now.indoorName)], { actorId: req.user.id });
      return [200, toAdminVenue(now)];
    });
    return res.status(status).json(body);
  } catch (err) {
    return next(err);
  }
};

// PUT /admin/indoors/:id/note (spec d endpoint 7): set, replace or clear the note on a
// pending venue. A live venue gets 409 (the owner only sees the note while pending,
// spec P15). Written only while pending, so an approval at the same moment wins cleanly.
export const setIndoorNote = async (req, res, next) => {
  try {
    const userId = parseId(req.params.id);
    if (userId === null) return res.status(400).json({ error: INVALID_VENUE_ID });

    const { count } = await prisma.ownerProfile.updateMany({
      where: { userId, approvedAt: null },
      data: { reviewNote: req.valid.body.note },
    });
    if (count === 0) {
      const venue = await loadAdminVenue(userId);
      if (!venue) return res.status(404).json({ error: VENUE_NOT_FOUND });
      return res.status(409).json({ error: LIVE_NO_NOTE });
    }
    return res.json(toAdminVenue(await loadAdminVenue(userId)));
  } catch (err) {
    return next(err);
  }
};

// POST /admin/indoors/:id/move-to-review (spec d endpoint 8): a live venue goes back to
// "Pending review", hidden from discovery at once, with the admin's note saying why. The
// owner is told, with the note, in the same transaction.
export const moveIndoorToReview = async (req, res, next) => {
  try {
    const userId = parseId(req.params.id);
    if (userId === null) return res.status(400).json({ error: INVALID_VENUE_ID });

    const { note } = req.valid.body;

    const [status, body] = await withLockedOwner(userId, async (tx) => {
      const { count } = await tx.ownerProfile.updateMany({
        where: { userId, approvedAt: { not: null } },
        data: { approvedAt: null, reviewNote: note },
      });
      const venue = await loadAdminVenue(userId, tx);
      if (!venue) return [404, { error: VENUE_NOT_FOUND }];
      if (count === 0) return [409, { error: ALREADY_PENDING }];

      await createUpdates(tx, [venueUpdate('venueMovedToReview', userId, venue.indoorName, note)], { actorId: req.user.id });
      return [200, toAdminVenue(venue)];
    });
    return res.status(status).json(body);
  } catch (err) {
    return next(err);
  }
};

// ── Stats ──
export const getStats = async (req, res, next) => {
  try {
    const [userCount, teamCount, playerCount, ownerCount, adminCount, pendingVenueCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.user.count({ where: { role: 'PLAYER' } }),
        prisma.user.count({ where: { role: 'OWNER' } }),
        prisma.user.count({ where: { role: 'ADMIN' } }),
        // "Venues waiting for review" on the Dashboard (docs/features/venues.md, d endpoint 9).
        prisma.ownerProfile.count({ where: { approvedAt: null } }),
      ]);

    return res.json({
      userCount,
      teamCount,
      playerCount,
      ownerCount,
      adminCount,
      pendingVenueCount,
    });
  } catch (err) {
    return next(err);
  }
};