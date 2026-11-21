// Request schemas for the /owners routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { optionalPhone, venueAddress, venueDescription, venueName, website } from './profileFields.js';

// ── PATCH /owners/me ── (edit the venue listing; docs/features/profiles-and-registration.md,
// d endpoint 5). The app sends every field each time (spec P11): leaving an optional
// field out, or sending null or "", clears it. The first problem wins, in this order.
export const updateVenueSchema = z.object({
  indoorName: venueName('Venue name is required'),
  phone: optionalPhone(),
  address: venueAddress(),
  website: website(),
  description: venueDescription(),
});
