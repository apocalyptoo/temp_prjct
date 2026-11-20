import { prisma } from '../db.js';
import { viewerFrom, seesEverything, toVisibleUser, toPublicVenue } from '../utils/visibility.js';

export const getMyOwnerProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Owners only' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
            description: true,
            website: true,
          },
        },
      },
    });

    if (!user || !user.ownerProfile) {
      return res.status(404).json({ error: 'Owner profile not found' });
    }

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