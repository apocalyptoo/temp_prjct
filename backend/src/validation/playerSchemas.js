// Request schemas for the /players routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { area, height, playerName, position, requiredPhone, weight } from './profileFields.js';

// ── PATCH /players/me ── (Edit profile; docs/features/profiles-and-registration.md,
// d endpoint 3). The app sends every field each time (spec P11): leaving an optional
// field out, or sending null or "", clears it. The first problem wins, in this order.
export const updatePlayerProfileSchema = z.object({
  name: playerName('Name is required'),
  phone: requiredPhone('Phone number is required'),
  position: position('Position is required'),
  height: height(),
  weight: weight(),
  area: area(),
});
