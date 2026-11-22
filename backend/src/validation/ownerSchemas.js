// Request schemas for the /owners routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import {
  AREA,
  openingHours,
  optionalPhone,
  pricingInfo,
  venueAddress,
  venueArea,
  venueDescription,
  venueName,
  website,
} from './profileFields.js';

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

// ── GET /owners ── (the venue list; docs/features/venues.md, d endpoint 3). Both
// filters are optional; a blank one is ignored (undefined). `search` matches part of the
// venue name, `area` part of the venue's area, both ignoring case. The area is tidied
// like a stored area (spaces at both ends removed, inner runs made one), so
// "  dhanmondi   27 " finds "Dhanmondi 27".
export const VENUE_SEARCH_MAX = 60;

const optionalFilter = ({ notText, tooLong, max, tidy }) =>
  z
    .string({ error: notText })
    .optional()
    .transform((text) => (text === undefined ? undefined : tidy(text)))
    .transform((text) => (text === '' ? undefined : text))
    .refine((text) => text === undefined || [...text].length <= max, { error: tooLong });

export const venueListQuerySchema = z.object({
  search: optionalFilter({
    notText: 'Search must be text',
    tooLong: `Search must be at most ${VENUE_SEARCH_MAX} characters`,
    max: VENUE_SEARCH_MAX,
    tidy: (text) => text.trim(),
  }),
  area: optionalFilter({
    notText: 'Area must be text',
    tooLong: `Area must be at most ${AREA.max} characters`,
    max: AREA.max,
    tidy: (text) => text.trim().replace(/\s+/g, ' '),
  }),
});

