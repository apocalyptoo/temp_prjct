import express from 'express';
import { verifyToken, isAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { moveToReviewSchema, reviewNoteSchema } from '../validation/adminSchemas.js';
import {
  getAllUsers, deleteUser, deleteIndoor,
  getAllTeams, deleteTeam,
  getAllIndoors, approveIndoor, setIndoorNote, moveIndoorToReview,
  getStats,
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/users', verifyToken, isAdmin, getAllUsers);
router.delete('/users/:id', verifyToken, isAdmin, deleteUser);
router.get('/teams', verifyToken, isAdmin, getAllTeams);
router.delete('/teams/:id', verifyToken, isAdmin, deleteTeam);
router.get('/indoors', verifyToken, isAdmin, getAllIndoors);
// Deletes a venue owner's account (only OWNER accounts; see adminController).
router.delete('/indoors/:id', verifyToken, isAdmin, deleteIndoor);
// Venue review (docs/features/venues.md, d endpoints 6–8).
router.post('/indoors/:id/approve', verifyToken, isAdmin, approveIndoor);
router.put('/indoors/:id/note', verifyToken, isAdmin, validate({ body: reviewNoteSchema }), setIndoorNote);
router.post('/indoors/:id/move-to-review', verifyToken, isAdmin, validate({ body: moveToReviewSchema }), moveIndoorToReview);
router.get('/stats', verifyToken, isAdmin, getStats);

export default router;