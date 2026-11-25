import express from 'express';
import { verifyToken, notAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { readNotificationsSchema } from '../validation/notificationSchemas.js';
import { getNotifications, getNotificationCount, readNotifications } from '../controllers/notificationController.js';

const router = express.Router();

// Players and venue owners only (docs/features/notifications.md, P12): the admin has no
// Notifications tab.
const notForAdmin = notAdmin('The admin account has no notifications.');

router.get('/', verifyToken, notForAdmin, getNotifications);
router.get('/count', verifyToken, notForAdmin, getNotificationCount);
router.post('/read', verifyToken, notForAdmin, validate({ body: readNotificationsSchema }), readNotifications);

export default router;
