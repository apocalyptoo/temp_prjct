import express from 'express';
import {
  listPlayers,
  getPendingInvites,
  getMyRequests,
  getPlayerStats,
  getMyPlayerProfile,
  updateMyPlayerProfile,
} from '../controllers/playerController.js';
import { verifyToken, playersOnly, onlyRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updatePlayerProfileSchema } from '../validation/playerSchemas.js';

const router = express.Router();

router.get('/me', verifyToken, getMyPlayerProfile);     // must be before /:id
// Edit profile: the role is checked before the body, so an owner always gets 403.
router.patch('/me', verifyToken, onlyRole('PLAYER', 'Players only'), validate({ body: updatePlayerProfileSchema }), updateMyPlayerProfile);
router.get('/invites', verifyToken, getPendingInvites); // must be before /:id
router.get('/requests', verifyToken, playersOnly, getMyRequests); // must be before /:id
router.get('/', verifyToken, listPlayers);
router.get('/:id', verifyToken, getPlayerStats);

export default router;