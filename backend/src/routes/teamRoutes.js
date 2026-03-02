import express from 'express';
import {
  createTeam,
  joinTeam,
  getTeams,
  invitePlayer,
  acceptInvite,
  rejectInvite,
  getMyTeams,
  removePlayer,
  deleteTeam,
} from '../controllers/teamController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', verifyToken, createTeam);
router.post('/:teamId/join', verifyToken, joinTeam);
router.post('/:teamId/invite', verifyToken, invitePlayer);
router.post('/:teamId/accept', verifyToken, acceptInvite);
router.post('/:teamId/reject', verifyToken, rejectInvite);
router.delete('/:teamId/members/:userId', verifyToken, removePlayer); 
router.delete('/:teamId', verifyToken, deleteTeam);                   
router.get('/me', verifyToken, getMyTeams);
router.get('/', verifyToken, getTeams);

export default router;