import express from 'express';
import {
  createTeam,
  getTeams,
  invitePlayer,
  listInviteCandidates,
  acceptInvite,
  rejectInvite,
  getMyTeams,
  getTeam,
  requestToJoin,
  cancelMyRequest,
  approveRequest,
  rejectRequest,
  removePlayer,
  cancelInvite,
  deleteTeam,
  leaveTeam,
  transferCaptaincy,
  updateTeam,
} from '../controllers/teamController.js';
import { verifyToken, playersOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamSchema,
  inviteSchema,
  joinRequestSchema,
  teamListQuerySchema,
  transferSchema,
  updateTeamSchema,
} from '../validation/teamSchemas.js';
import { playerListQuerySchema } from '../validation/playerSchemas.js';

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
router.delete('/:teamId/members/:userId', verifyToken, playersOnly, removePlayer);
router.delete('/:teamId/invites/:userId', verifyToken, playersOnly, cancelInvite);
router.post('/:teamId/leave', verifyToken, playersOnly, leaveTeam);
router.post('/:teamId/transfer', verifyToken, playersOnly, validate({ body: transferSchema }), transferCaptaincy);
router.patch('/:teamId', verifyToken, playersOnly, validate({ body: updateTeamSchema }), updateTeam);
router.delete('/:teamId', verifyToken, playersOnly, deleteTeam);
// The search behind Invite players (captain only; docs/features/explore.md, d endpoint 7).
router.get('/:teamId/invite-candidates', verifyToken, playersOnly, validate({ query: playerListQuerySchema }), listInviteCandidates);
router.get('/me', verifyToken, getMyTeams); // must be above /:teamId
router.get('/:teamId', verifyToken, getTeam);
router.get('/', verifyToken, validate({ query: teamListQuerySchema }), getTeams);

export default router;