import express from 'express';
import { verifyToken, onlyRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getMyOwnerProfile, updateMyVenue, listIndoors } from '../controllers/ownerController.js';
import { updateVenueSchema } from '../validation/ownerSchemas.js';

const router = express.Router();

// Owner sees own profile
router.get('/me', verifyToken, getMyOwnerProfile);

// Owner edits their venue listing. The role is checked before the body, so a player or
// the admin always gets 403.
router.patch('/me', verifyToken, onlyRole('OWNER', 'Owners only'), validate({ body: updateVenueSchema }), updateMyVenue);

// Owner sees all registered indoors (OwnerProfiles)
router.get('/', verifyToken, listIndoors);

export default router;