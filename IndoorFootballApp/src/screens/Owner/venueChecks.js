// The checks Edit venue runs before sending (docs/features/profiles-and-registration.md,
// section e; the backend's updateVenueSchema), with the backend's own messages, and the
// values to send. Only the venue name is required; an optional field left empty is sent
// as null, which clears it (P11).
import {
  cleanPhone,
  isMobileNumber,
  PHONE_RULE_MESSAGE,
} from '../../utils/phone';
import { isWebLink, WEBSITE_MESSAGE } from '../../utils/links';
import { charCount, nameProblem, VENUE_NAME } from '../Auth/signUpCommon';

export const VENUE_ADDRESS_MAX = 200;
export const VENUE_WEBSITE_MAX = 200;
export const VENUE_DESCRIPTION_MAX = 500;

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
// every field each time, trimmed, empty optional fields as null.
export function checkVenueEdit({
  indoorName,
  phone,
  address,
  website,
  description,
}) {
  const errors = {
    indoorName: nameProblem(indoorName, VENUE_NAME, {
      required: 'Venue name is required',
      label: 'Venue name',
    }),
    phone: venuePhoneProblem(phone),
    address: tooLong(trimmed(address), VENUE_ADDRESS_MAX, 'Address'),
    website: websiteProblem(website),
    description: tooLong(
      trimmed(description),
      VENUE_DESCRIPTION_MAX,
      'Description',
    ),
  };
  return {
    errors,
    ok: Object.values(errors).every(problem => problem === null),
    body: {
      indoorName: trimmed(indoorName),
      phone: orNull(cleanPhone(trimmed(phone))),
      address: orNull(trimmed(address)),
      website: orNull(trimmed(website)),
      description: orNull(trimmed(description)),
    },
  };
}
