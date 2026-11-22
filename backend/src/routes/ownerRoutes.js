import express from 'express';
import { verifyToken, onlyRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getMyOwnerProfile, updateMyVenue, listIndoors, getVenue } from '../controllers/ownerController.js';
import { updateVenueSchema, venueListQuerySchema } from '../validation/ownerSchemas.js';

const router = express.Router();

// Owner sees own profile
router.get('/me', verifyToken, getMyOwnerProfile);

// Owner edits their venue listing. The role is checked before the body, so a player or
// the admin always gets 403.
router.patch('/me', verifyToken, onlyRole('OWNER', 'Owners only'), validate({ body: updateVenueSchema }), updateMyVenue);

// The venue list for every logged-in user: live venues only, with optional search and
// area filters (docs/features/venues.md, d endpoint 3).
router.get('/', verifyToken, validate({ query: venueListQuerySchema }), listIndoors);

// One live venue (Venue detail). Must stay below /me, or "me" would be read as an id.
router.get('/:userId', verifyToken, getVenue);

export default router;