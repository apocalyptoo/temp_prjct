import express from 'express';
import {
  createTeam,
  getTeams,
  invitePlayer,
  acceptInvite,
  rejectInvite,
  getMyTeams,
  getTeam,
  requestToJoin,
  cancelMyRequest,
  approveRequest,
  rejectRequest,
  removePlayer,
  deleteTeam,
} from '../controllers/teamController.js';
import { verifyToken, playersOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTeamSchema, inviteSchema, joinRequestSchema } from '../validation/teamSchemas.js';

const router = express.Router();

// Routes that read a body run validate(); ids in the URL are checked with parseId in the controllers.
router.post('/create', verifyToken, playersOnly, validate({ body: createTeamSchema }), createTeam);
router.post('/:teamId/invite', verifyToken, playersOnly, validate({ body: inviteSchema }), invitePlayer);
router.post('/:teamId/accept', verifyToken, playersOnly, acceptInvite);
router.post('/:teamId/reject', verifyToken, playersOnly, rejectInvite);
router.post('/:teamId/requests', verifyToken, playersOnly, validate({ body: joinRequestSchema }), requestToJoin);
router.delete('/:teamId/requests/me', verifyToken, playersOnly, cancelMyRequest);
router.post('/:teamId/requests/:userId/approve', verifyToken, playersOnly, approveRequest);
router.post('/:teamId/requests/:userId/reject', verifyToken, playersOnly, rejectRequest);
router.delete('/:teamId/members/:userId', verifyToken, removePlayer); 
router.delete('/:teamId', verifyToken, deleteTeam);                   
router.get('/me', verifyToken, getMyTeams); // must be above /:teamId
router.get('/:teamId', verifyToken, getTeam);
router.get('/', verifyToken, getTeams);

export default router;