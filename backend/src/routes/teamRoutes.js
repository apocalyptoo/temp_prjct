import express from 'express';
import {
  createTeam,
  getTeams,
  invitePlayer,
  acceptInvite,
  rejectInvite,
  getMyTeams,
  getTeam,
  removePlayer,
  deleteTeam,
} from '../controllers/teamController.js';
import { verifyToken, playersOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTeamSchema, inviteSchema } from '../validation/teamSchemas.js';

const router = express.Router();

// Only these two read a request body; ids in the URL are checked with parseId in the controller.
router.post('/create', verifyToken, playersOnly, validate({ body: createTeamSchema }), createTeam);
router.post('/:teamId/invite', verifyToken, playersOnly, validate({ body: inviteSchema }), invitePlayer);
router.post('/:teamId/accept', verifyToken, playersOnly, acceptInvite);
router.post('/:teamId/reject', verifyToken, playersOnly, rejectInvite);
router.delete('/:teamId/members/:userId', verifyToken, removePlayer); 
router.delete('/:teamId', verifyToken, deleteTeam);                   
router.get('/me', verifyToken, getMyTeams); // must be above /:teamId
router.get('/:teamId', verifyToken, getTeam);
router.get('/', verifyToken, getTeams);

export default router;