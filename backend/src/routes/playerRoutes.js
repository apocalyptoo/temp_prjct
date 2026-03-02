import express from 'express';
import {
  listPlayers,
  getPendingInvites,
  getPlayerStats,
  getMyPlayerProfile,
} from '../controllers/playerController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', verifyToken, getMyPlayerProfile);     // must be before /:id
router.get('/invites', verifyToken, getPendingInvites); // must be before /:id
router.get('/', verifyToken, listPlayers);
router.get('/:id', verifyToken, getPlayerStats);

export default router;