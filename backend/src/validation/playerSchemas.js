// Request schemas for the /players routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { area, height, playerName, position, requiredPhone, weight } from './profileFields.js';
import { areaFilter, limitParam, pageParam, positionFilter, searchFilter } from './listQuery.js';

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

// ── GET /players and GET /teams/:teamId/invite-candidates ── (the player list of Explore
// and the search behind Invite players; docs/features/explore.md, d endpoints 5 and 7).
// `search` matches part of the player's name and `area` part of their area, both
// ignoring case; `position` is one of the five positions, matched exactly. A blank
// filter is ignored. `page` and `limit` choose the page. The first problem wins, in
// this order.
export const playerListQuerySchema = z.object({
  search: searchFilter(),
  area: areaFilter(),
  position: positionFilter(),
  page: pageParam(),
  limit: limitParam(),
});
