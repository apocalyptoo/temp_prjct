import express from 'express';
import {
  listPlayers,
  getPendingInvites,
  getMyRequests,
  getPlayerStats,
  getMyPlayerProfile,
} from '../controllers/playerController.js';
import { verifyToken, playersOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', verifyToken, getMyPlayerProfile);     // must be before /:id
router.get('/invites', verifyToken, getPendingInvites); // must be before /:id
router.get('/requests', verifyToken, playersOnly, getMyRequests); // must be before /:id
router.get('/', verifyToken, listPlayers);
router.get('/:id', verifyToken, getPlayerStats);

export default router;