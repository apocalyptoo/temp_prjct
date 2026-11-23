// Request schemas for the /owners routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import {
  openingHours,
  optionalPhone,
  pricingInfo,
  venueAddress,
  venueArea,
  venueDescription,
  venueName,
  website,
} from './profileFields.js';
import { areaFilter, limitParam, pageParam, searchFilter } from './listQuery.js';

// ── PATCH /owners/me ── (edit the venue listing; docs/features/profiles-and-registration.md,
// d endpoint 5, and docs/features/venues.md, d endpoint 2). The app sends every field
// each time: leaving an optional field out, or sending null or "", clears it. The first
// problem wins, in this order. Whether a live venue may empty its address, area or phone
// is checked in the controller, which knows the venue's state.
export const updateVenueSchema = z.object({
  indoorName: venueName('Venue name is required'),
  phone: optionalPhone(),
  address: venueAddress(),
  area: venueArea(),
  openingHours: openingHours(),
  pricingInfo: pricingInfo(),
  website: website(),
  description: venueDescription(),
});

// ── GET /owners ── (the venue list; docs/features/venues.md, d endpoint 3, and
// docs/features/explore.md, d endpoint 8). Both filters are optional; a blank one is
// ignored (undefined). `search` matches part of the venue name, `area` part of the
// venue's area, both ignoring case. `page` and `limit` choose the page. The first
// problem wins, in this order.
export const venueListQuerySchema = z.object({
  search: searchFilter(),
  area: areaFilter(),
  page: pageParam(),
  limit: limitParam(),
});
