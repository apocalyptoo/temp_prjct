import express from 'express';
import { createTeam, joinTeam, getTeams, invitePlayer, acceptInvite, getMyTeams, rejectInvite, removePlayer, deleteTeam } from '../controllers/teamController.js';
// Remove a player from team (owner only)
router.delete('/:teamId/member/:userId', verifyToken, removePlayer);

// Delete a team (owner only)
router.delete('/:teamId', verifyToken, deleteTeam);
import { verifyToken } from '../middleware/auth.js';
const router = express.Router();

// Protected routes
router.post("/create", verifyToken, createTeam);
router.post("/:teamId/join", verifyToken, joinTeam);
router.post("/:teamId/invite", verifyToken, invitePlayer);
router.post("/:teamId/accept", verifyToken, acceptInvite);
router.post("/:teamId/reject", verifyToken, rejectInvite); // NEW
router.get("/", verifyToken, getTeams);
router.get("/me", verifyToken, getMyTeams);

export default router;
