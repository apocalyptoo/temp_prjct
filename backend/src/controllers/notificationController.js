import { prisma } from '../db.js';
import { viewerFrom } from '../utils/visibility.js';
import { countNotifications, loadNotifications } from '../utils/notificationFeed.js';
import { markUpdatesRead } from '../utils/notifications.js';

// The Notifications screen and its badge (docs/features/notifications.md, d.2). The
// routes let in players and venue owners only (notificationRoutes.js).

// GET /notifications: "Needs your action" and the newest 50 updates.
export const getNotifications = async (req, res, next) => {
  try {
    return res.json(await loadNotifications(prisma, viewerFrom(req)));
  } catch (err) {
    return next(err);
  }
};

// GET /notifications/count: the badge's number.
export const getNotificationCount = async (req, res, next) => {
  try {
    return res.json({ count: await countNotifications(prisma, viewerFrom(req)) });
  } catch (err) {
    return next(err);
  }
};

// POST /notifications/read: marks the viewer's own updates as read, up to the newest one
// their screen showed. Replies with the badge's new number.
export const readNotifications = async (req, res, next) => {
  try {
    const viewer = viewerFrom(req);
    const count = await prisma.$transaction(async (tx) => {
      await markUpdatesRead(tx, viewer.id, req.valid.body.upToId);
      return countNotifications(tx, viewer);
    });
    return res.json({ count });
  } catch (err) {
    return next(err);
  }
};
