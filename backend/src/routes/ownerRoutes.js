import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getMyOwnerProfile, listIndoors } from '../controllers/ownerController.js';

const router = express.Router();

// Owner sees own profile
router.get('/me', verifyToken, getMyOwnerProfile);

// Owner sees all registered indoors (OwnerProfiles)
router.get('/', verifyToken, listIndoors);

export default router;