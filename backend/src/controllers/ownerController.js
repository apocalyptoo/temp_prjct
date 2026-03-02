import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getMyOwnerProfile = async (req, res) => {
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
          },
        },
      },
    });

    if (!user || !user.ownerProfile) {
      return res.status(404).json({ error: 'Owner profile not found' });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch owner profile', details: err.message });
  }
};

export const listIndoors = async (req, res) => {
  try {
    // If you want ONLY owners to access this list, uncomment:
    // if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'Owners only' });

    const indoors = await prisma.ownerProfile.findMany({
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
      },
      orderBy: { id: 'desc' },
    });

    // Flatten for easy frontend use
    const result = indoors.map((o) => ({
      userId: o.userId,
      email: o.user.email,
      createdAt: o.user.createdAt,
      indoorName: o.indoorName,
      phone: o.phone,
      address: o.address,
      description: o.description,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch indoors', details: err.message });
  }
};