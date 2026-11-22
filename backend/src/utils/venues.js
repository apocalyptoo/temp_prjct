// Shared venue rules (docs/features/venues.md): when a venue is complete, when it's
// live, and the messages for a live venue that would lose a required field.

// A venue can go live only when these are filled in (PRODUCT.md, "Venue owners"), and a
// live venue can't empty them. Always in this order, in replies and messages.
export const REQUIRED_VENUE_FIELDS = ['address', 'area', 'phone'];

// The required fields a venue (or an edit's values) leaves empty, in order (spec P8).
export const missingFields = (venue) =>
  REQUIRED_VENUE_FIELDS.filter((field) => venue[field] === null || venue[field] === undefined || venue[field] === '');

// Live = approved by the admin; null approvedAt means "Pending review" (spec P4).
export const isLive = (venue) => venue.approvedAt !== null && venue.approvedAt !== undefined;

// Spec P10: why a live venue can't empty the field.
export const LIVE_VENUE_NEEDS = {
  address: 'A live venue needs an address',
  area: 'A live venue needs an area',
  phone: 'A live venue needs a phone number',
};

// The venue with its missingFields added (for the owner's and the admin's replies only).
export const withMissingFields = (venue) => (venue ? { ...venue, missingFields: missingFields(venue) } : venue);
