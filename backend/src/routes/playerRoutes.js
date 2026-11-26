import express from 'express';
import {
  listPlayers,
  getMyRequests,
  getPlayer,
  getMyPlayerProfile,
  updateMyPlayerProfile,
} from '../controllers/playerController.js';
import { verifyToken, playersOnly, onlyRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { playerListQuerySchema, updatePlayerProfileSchema } from '../validation/playerSchemas.js';

const router = express.Router();

router.get('/me', verifyToken, getMyPlayerProfile);     // must be before /:id
// Edit profile: the role is checked before the body, so an owner always gets 403.
router.patch('/me', verifyToken, onlyRole('PLAYER', 'Players only'), validate({ body: updatePlayerProfileSchema }), updateMyPlayerProfile);
router.get('/requests', verifyToken, playersOnly, getMyRequests); // must be before /:id
router.get('/', verifyToken, validate({ query: playerListQuerySchema }), listPlayers);
// One player's public profile (Player detail). Must stay below /me and /requests.
router.get('/:id', verifyToken, getPlayer);

export default router;