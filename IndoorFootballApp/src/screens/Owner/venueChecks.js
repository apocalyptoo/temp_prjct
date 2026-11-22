// The checks Edit venue runs before sending (docs/features/profiles-and-registration.md,
// section e, and docs/features/venues.md, section e; the backend's updateVenueSchema and
// its live-venue rule), with the backend's own messages, and the values to send. Only
// the venue name is required; an optional field left empty is sent as null, which clears
// it (P11). On a live venue the address, area and phone can't be emptied (P10).
import {
  cleanPhone,
  isMobileNumber,
  PHONE_RULE_MESSAGE,
} from '../../utils/phone';
import { isWebLink, WEBSITE_MESSAGE } from '../../utils/links';
import { charCount, nameProblem, VENUE_NAME } from '../Auth/signUpCommon';
import { areaProblem, tidyArea } from '../Player/profileChecks';

export const VENUE_ADDRESS_MAX = 200;
export const VENUE_WEBSITE_MAX = 200;
export const VENUE_DESCRIPTION_MAX = 500;
export const VENUE_OPENING_HOURS_MAX = 120; // venues spec P1
export const VENUE_PRICING_INFO_MAX = 120; // venues spec P1

// Why a live venue can't empty these (the backend's LIVE_VENUE_NEEDS, spec P10).
export const LIVE_VENUE_NEEDS = {
  address: 'A live venue needs an address',
  area: 'A live venue needs an area',
  phone: 'A live venue needs a phone number',
};

const trimmed = text => String(text ?? '').trim();
const orNull = text => (text === '' ? null : text);

const tooLong = (text, max, label) =>
  charCount(text) > max ? `${label} must be at most ${max} characters` : null;

// Optional: an empty phone (after removing spaces and dashes) is fine.
export function venuePhoneProblem(phone) {
  const cleaned = cleanPhone(trimmed(phone));
  if (cleaned === '') return null;
  return isMobileNumber(cleaned) ? null : PHONE_RULE_MESSAGE;
}

export function websiteProblem(website) {
  const text = trimmed(website);
  if (text === '') return null;
  return (
    tooLong(text, VENUE_WEBSITE_MAX, 'Website') ??
    (isWebLink(text) ? null : WEBSITE_MESSAGE)
  );
}

// "120 / 500 characters": the description's live count, counted like the backend
// (trimmed, in characters as people see them).
export const descriptionCount = description =>
  `${charCount(trimmed(description))} / ${VENUE_DESCRIPTION_MAX} characters`;

// Every field's problem (null when fine), whether there's any, and the request body:
// every field each time, trimmed (the area tidied like the player Area, D4), empty
// optional fields as null. Line breaks inside opening hours and pricing info are kept
// (P1). `live`: the venue is approved, so an emptied address, area or phone gets the
// live-venue message instead (the backend checks again).
export function checkVenueEdit(
  {
    indoorName,
    phone,
    address,
    area,
    website,
    openingHours,
    pricingInfo,
    description,
  },
  { live = false } = {},
) {
  const body = {
    indoorName: trimmed(indoorName),
    phone: orNull(cleanPhone(trimmed(phone))),
    address: orNull(trimmed(address)),
    area: orNull(tidyArea(area)),
    website: orNull(trimmed(website)),
    openingHours: orNull(trimmed(openingHours)),
    pricingInfo: orNull(trimmed(pricingInfo)),
    description: orNull(trimmed(description)),
  };
  const liveNeeds = field =>
    live && body[field] === null ? LIVE_VENUE_NEEDS[field] : null;
  const errors = {
    indoorName: nameProblem(indoorName, VENUE_NAME, {
      required: 'Venue name is required',
      label: 'Venue name',
    }),
    phone: liveNeeds('phone') ?? venuePhoneProblem(phone),
    address:
      liveNeeds('address') ??
      tooLong(trimmed(address), VENUE_ADDRESS_MAX, 'Address'),
    area: liveNeeds('area') ?? areaProblem(area),
    website: websiteProblem(website),
    openingHours: tooLong(
      trimmed(openingHours),
      VENUE_OPENING_HOURS_MAX,
      'Opening hours',
    ),
    pricingInfo: tooLong(
      trimmed(pricingInfo),
      VENUE_PRICING_INFO_MAX,
      'Pricing info',
    ),
    description: tooLong(
      trimmed(description),
      VENUE_DESCRIPTION_MAX,
      'Description',
    ),
  };
  return {
    errors,
    ok: Object.values(errors).every(problem => problem === null),
    body,
  };
}
