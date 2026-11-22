// Shared by the admin's venue screens (docs/features/venues.md, section e, "The admin's
// Venues tab"): what a venue is missing, the date it went live, and the note checks.
import { charCount } from '../Auth/signUpCommon';

// The backend's limit and messages for the admin's note (reviewNoteSchema and
// moveToReviewSchema, spec P2).
export const REVIEW_NOTE_MAX = 200;
export const NOTE_TOO_LONG = `Note must be at most ${REVIEW_NOTE_MAX} characters`;
export const NOTE_REQUIRED = 'Add a note for the owner';
export const OWNER_UNVERIFIED = "The owner hasn't verified their email yet";

// Live = approved by the admin; no approval date means "Pending review" (spec P4).
export const isLive = venue => Boolean(venue?.approvedAt);

// "Missing: area, phone" from the backend's missingFields (always in its order), or
// "Complete" when nothing is missing.
export const missingText = missingFields =>
  missingFields && missingFields.length > 0
    ? `Missing: ${missingFields.join(', ')}`
    : 'Complete';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// "23 Nov 2026" in the phone's time zone, written by the app (not the phone's locale),
// so it reads the same on every phone.
export function shortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const liveSinceText = approvedAt =>
  `Live since ${shortDate(approvedAt)}`;

// The note's problem before sending, with the backend's messages (null when fine).
// Trimmed and counted in characters as people see them, like the backend. required:
// moving a venue back to review needs a note; saving one on a pending venue doesn't
// (an empty note clears it).
export function noteProblem(note, { required = false } = {}) {
  const text = String(note ?? '').trim();
  if (text === '') return required ? NOTE_REQUIRED : null;
  return charCount(text) > REVIEW_NOTE_MAX ? NOTE_TOO_LONG : null;
}

// What's sent: the note trimmed, an empty one as null (clears it).
export const noteBody = note => {
  const text = String(note ?? '').trim();
  return { note: text === '' ? null : text };
};
