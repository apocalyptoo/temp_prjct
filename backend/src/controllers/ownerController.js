import { prisma } from '../db.js';
import { viewerFrom, seesEverything, toVisibleUser, toPublicVenue } from '../utils/visibility.js';
import { LIVE_VENUE_NEEDS, missingFields, withMissingFields } from '../utils/venues.js';

// The logged-in venue owner's own profile with the listing: everything except
// secrets, including the review status (approvedAt, null = "Pending review") and the
// admin's note. Shared by GET /owners/me and the reply of PATCH /owners/me. Since the
// short sign-up, every listing field except the venue name may be null.
const loadOwnOwnerProfile = (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      ownerProfile: {
        select: {
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
        },
      },
    },
  });

// The owner's own reply: the visible user, with the listing's missingFields (the
// required fields still empty, in order; docs/features/venues.md, P8).
const ownReply = (user, req) => {
  const out = toVisibleUser(user, viewerFrom(req));
  return { ...out, ownerProfile: withMissingFields(out.ownerProfile) };
};

export const getMyOwnerProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Owners only' });
    }

    const user = await loadOwnOwnerProfile(req.user.id);
    if (!user || !user.ownerProfile) {
      return res.status(404).json({ error: 'Owner profile not found' });
    }

    return res.json(ownReply(user, req));
  } catch (err) {
    return next(err);
  }
};

// PATCH /owners/me: edit the venue listing (docs/features/profiles-and-registration.md,
// d endpoint 5; docs/features/venues.md, d endpoint 2). Owners only (checked by the
// route, before the body). The body was checked by updateVenueSchema: every field is
// present and cleaned, so one update replaces the whole editable listing. The edit
// never changes the review status or the admin's note: edits to a live venue stay live.
//
// A live venue can't empty its address, area or phone. An edit that would leave one of
// them empty is written only while the venue is pending (where approvedAt is null), in
// one conditional update, so an approval landing at the same moment can't leave an
// incomplete venue live (spec P11). If nothing was written and the venue exists, it's
// live: the reply names the first field it needs (spec P10).
export const updateMyVenue = async (req, res, next) => {
  try {
    const listing = req.valid.body;
    const empty = missingFields(listing);
    const where = empty.length > 0 ? { userId: req.user.id, approvedAt: null } : { userId: req.user.id };
    const { count } = await prisma.ownerProfile.updateMany({ where, data: listing });
    if (count === 0) {
      const exists = await prisma.ownerProfile.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!exists) return res.status(404).json({ error: 'Owner profile not found' });
      return res.status(400).json({ error: LIVE_VENUE_NEEDS[empty[0]] });
    }

    const user = await loadOwnOwnerProfile(req.user.id);
    return res.json(ownReply(user, req));
  } catch (err) {
    return next(err);
  }
};

export const listIndoors = async (req, res, next) => {
  try {
    const indoors = await prisma.ownerProfile.findMany({
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
      },
      orderBy: { id: 'desc' },
    });

    // Flatten for easy frontend use. The listing is public; the owner's login email is
    // only kept for the owner themselves (and the admin).
    const viewer = viewerFrom(req);
    const result = indoors.map((o) =>
      toPublicVenue(
        {
          userId: o.userId,
          email: o.user.email,
          createdAt: o.user.createdAt,
          indoorName: o.indoorName,
          phone: o.phone,
          address: o.address,
          description: o.description,
          website: o.website,
        },
        { canSeeEmail: seesEverything(viewer, o.userId) }
      )
    );

    return res.json(result);
  } catch (err) {
    return next(err);
  }
};