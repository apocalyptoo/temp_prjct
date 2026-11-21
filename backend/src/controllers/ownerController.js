import { prisma } from '../db.js';
import { viewerFrom, seesEverything, toVisibleUser, toPublicVenue } from '../utils/visibility.js';

// The logged-in venue owner's own profile with the listing: everything except
// secrets. Shared by GET /owners/me and the reply of PATCH /owners/me. Since the short
// sign-up, phone, address, description and website may each be null.
const loadOwnOwnerProfile = (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      ownerProfile: {
        select: { indoorName: true, phone: true, address: true, description: true, website: true },
      },
    },
  });

export const getMyOwnerProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Owners only' });
    }

    const user = await loadOwnOwnerProfile(req.user.id);
    if (!user || !user.ownerProfile) {
      return res.status(404).json({ error: 'Owner profile not found' });
    }

    return res.json(toVisibleUser(user, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};

// PATCH /owners/me: edit the venue listing (docs/features/profiles-and-registration.md,
// d endpoint 5). Owners only (checked by the route, before the body). The body was
// checked by updateVenueSchema: every field is present and cleaned (trimmed, blank as
// null, the phone a mobile number, the website a real http/https link), so one update
// replaces the whole editable listing. Feature 3 adds area, opening hours and pricing.
export const updateMyVenue = async (req, res, next) => {
  try {
    const { indoorName, phone, address, website, description } = req.valid.body;
    const { count } = await prisma.ownerProfile.updateMany({
      where: { userId: req.user.id },
      data: { indoorName, phone, address, website, description },
    });
    if (count === 0) return res.status(404).json({ error: 'Owner profile not found' });

    const user = await loadOwnOwnerProfile(req.user.id);
    return res.json(toVisibleUser(user, viewerFrom(req)));
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