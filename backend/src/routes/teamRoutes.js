import express from 'express';
import {
  createTeam,
  getTeams,
  invitePlayer,
  acceptInvite,
  rejectInvite,
  getMyTeams,
  removePlayer,
  deleteTeam,
} from '../controllers/teamController.js';
import { verifyToken, playersOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', verifyToken, playersOnly, createTeam);
router.post('/:teamId/invite', verifyToken, playersOnly, invitePlayer);
router.post('/:teamId/accept', verifyToken, playersOnly, acceptInvite);
router.post('/:teamId/reject', verifyToken, playersOnly, rejectInvite);
router.delete('/:teamId/members/:userId', verifyToken, removePlayer); 
router.delete('/:teamId', verifyToken, deleteTeam);                   
router.get('/me', verifyToken, getMyTeams);
router.get('/', verifyToken, getTeams);

export default router;