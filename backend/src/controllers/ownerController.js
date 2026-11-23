import { prisma } from '../db.js';
import { viewerFrom, seesEverything, toVisibleUser, toPublicVenue } from '../utils/visibility.js';
import { LIVE_VENUE_NEEDS, missingFields, withMissingFields } from '../utils/venues.js';
import { containsText } from '../utils/search.js';
import { parseId } from '../utils/ids.js';
import { pageArgs, pagedReply } from '../utils/paging.js';

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

// The public listing fields of a venue, with the owner's email and join date (the email
// is kept only for the owner themselves and the admin, by toPublicVenue).
const PUBLIC_VENUE_SELECT = {
  userId: true,
  indoorName: true,
  phone: true,
  address: true,
  area: true,
  website: true,
  description: true,
  openingHours: true,
  pricingInfo: true,
  user: { select: { email: true, createdAt: true } },
};

const toVenueReply = (o, viewer) => {
  const { user, ...listing } = o;
  return toPublicVenue({ ...listing, email: user.email, createdAt: user.createdAt }, { canSeeEmail: seesEverything(viewer, o.userId) });
};

// GET /owners: the venue list (docs/features/venues.md, d endpoint 3). Only live venues
// (approved: approvedAt set). Optional `search` (part of the venue name) and `area` (part
// of the venue's area), both ignoring case, with % and _ matched literally
// (containsText). Sorted by venue name A to Z, ties by user id (spec P12), which keeps
// the order the same from one page to the next. Paged: { items, page, limit, total }
// (docs/features/explore.md, d.1 and d endpoint 8).
//
// Moderation hook (docs/features/explore.md, section g): a suspended owner's venue is
// left out here, and in getVenue below, by adding that condition to `where`.
export const listIndoors = async (req, res, next) => {
  try {
    const { search, area, page, limit } = req.valid.query;
    const where = {
      approvedAt: { not: null },
      ...(search ? { indoorName: containsText(search) } : {}),
      ...(area ? { area: containsText(area) } : {}),
    };
    const [venues, total] = await Promise.all([
      prisma.ownerProfile.findMany({
        where,
        select: PUBLIC_VENUE_SELECT,
        orderBy: [{ indoorName: 'asc' }, { userId: 'asc' }],
        ...pageArgs({ page, limit }),
      }),
      prisma.ownerProfile.count({ where }),
    ]);
    const viewer = viewerFrom(req);
    return res.json(pagedReply(venues.map((o) => toVenueReply(o, viewer)), total, { page, limit }));
  } catch (err) {
    return next(err);
  }
};

// GET /owners/:userId: one live venue (Venue detail; spec d endpoint 4). A venue that
// isn't live is hidden even from someone who knows the id: 404, as for no venue at all.
export const getVenue = async (req, res, next) => {
  try {
    const userId = parseId(req.params.userId);
    if (userId === null) return res.status(400).json({ error: 'Invalid venue id' });
    const venue = await prisma.ownerProfile.findFirst({
      where: { userId, approvedAt: { not: null } },
      select: PUBLIC_VENUE_SELECT,
    });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    return res.json(toVenueReply(venue, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};
