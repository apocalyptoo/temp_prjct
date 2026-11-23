// The query pieces shared by every paged list: the venue list, the team list, the
// player list and the invite search (docs/features/explore.md, d.1, P7). One rule and
// one set of messages for all of them.
//
// Query values always arrive as text ("2", not 2). A value given twice arrives as a
// list and is refused with that field's message.
import { z } from 'zod';
import { AREA, POSITIONS, POSITION_MESSAGE } from './profileFields.js';
import { charCount } from './common.js';

export const SEARCH_MAX = 60;
export const PAGE_MAX = 1000; // spec P1
export const LIMIT_MAX = 50; // spec P1
export const DEFAULT_LIMIT = 20; // spec D1

// An optional text filter: tidied; a blank one is ignored (undefined); at most `max`
// characters (code points) after tidying.
const optionalFilter = ({ notText, tooLong, max, tidy }) =>
  z
    .string({ error: notText })
    .optional()
    .transform((text) => (text === undefined ? undefined : tidy(text)))
    .transform((text) => (text === '' ? undefined : text))
    .refine((text) => text === undefined || charCount(text) <= max, { error: tooLong });

// `search`: matches part of a name, ignoring case. Trimmed.
export const searchFilter = () =>
  optionalFilter({
    notText: 'Search must be text',
    tooLong: `Search must be at most ${SEARCH_MAX} characters`,
    max: SEARCH_MAX,
    tidy: (text) => text.trim(),
  });

// `area`: matches part of an area, ignoring case. Tidied like a stored area (spaces at
// both ends removed, inner runs made one), so "  dhanmondi   27 " finds "Dhanmondi 27".
export const areaFilter = () =>
  optionalFilter({
    notText: 'Area must be text',
    tooLong: `Area must be at most ${AREA.max} characters`,
    max: AREA.max,
    tidy: (text) => text.trim().replace(/\s+/g, ' '),
  });

// `position` (player lists): one of the five positions, exactly as spelled, matched
// exactly ("Any" is its own filter, spec P3). A blank one is ignored.
export const positionFilter = () =>
  z
    .string({ error: POSITION_MESSAGE })
    .optional()
    .transform((text) => (text === undefined || text.trim() === '' ? undefined : text))
    .refine((text) => text === undefined || POSITIONS.includes(text), { error: POSITION_MESSAGE });

// A whole number from 1 to `max`, written in digits only ("2"; not "02", "2.0", "+2"
// or " 2"). Missing means `fallback`.
const wholeNumber = ({ max, fallback, message }) =>
  z
    .string({ error: message })
    .optional()
    .refine((text) => text === undefined || (/^[1-9]\d{0,3}$/.test(text) && Number(text) <= max), { error: message })
    .transform((text) => (text === undefined ? fallback : Number(text)));

// `page`: 1 to 1000, the first page by default.
export const pageParam = () =>
  wholeNumber({ max: PAGE_MAX, fallback: 1, message: `Page must be a whole number from 1 to ${PAGE_MAX}` });

// `limit`: 1 to 50 rows per page, 20 by default.
export const limitParam = () =>
  wholeNumber({ max: LIMIT_MAX, fallback: DEFAULT_LIMIT, message: `Limit must be a whole number from 1 to ${LIMIT_MAX}` });
