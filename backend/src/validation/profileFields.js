// Profile fields shared by registration (authSchemas.js) and the profile edit
// endpoints, so sign-up and editing can't drift apart.
// Rules: docs/PRODUCT.md "Registration" and "Profiles"; details in
// docs/features/profiles-and-registration.md (section d).
import { z } from 'zod';
import { isWebLink } from '../utils/links.js';
import { charCount, isFilled, requiredText } from './common.js';

// ── Limits ──
export const PLAYER_NAME = { min: 2, max: 50 };
export const AREA = { min: 2, max: 40 }; // spec P3
export const VENUE_NAME = { min: 2, max: 60 };
export const VENUE_ADDRESS_MAX = 200;
export const VENUE_DESCRIPTION_MAX = 500;
export const VENUE_WEBSITE_MAX = 200;

// The position list, spelled exactly as the app shows it (spec P1). Same values as the
// Position enum in prisma/schema.prisma.
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any'];

// A Bangladeshi mobile number: 01, then 3–9, then 8 more digits (DECISIONS.md 2026-11-22).
export const MOBILE_NUMBER = /^01[3-9]\d{8}$/;

// ── Messages ──
export const PHONE_RULE_MESSAGE = 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
export const POSITION_MESSAGE = 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any';
export const WEBSITE_MESSAGE = 'Website must start with http:// or https://';

const lengthBetween = ({ min, max }) => (text) => charCount(text) >= min && charCount(text) <= max;

// ── Pieces ──

// A player's name: required, trimmed, 2–50 characters.
export const playerName = (required) =>
  requiredText({ required, notText: 'Name must be text' }).refine(lengthBetween(PLAYER_NAME), {
    error: `Name must be between ${PLAYER_NAME.min} and ${PLAYER_NAME.max} characters`,
  });

// A venue's name: required, trimmed, 2–60 characters.
export const venueName = (required) =>
  requiredText({ required, notText: 'Venue name must be text' }).refine(lengthBetween(VENUE_NAME), {
    error: `Venue name must be between ${VENUE_NAME.min} and ${VENUE_NAME.max} characters`,
  });

// A required mobile number, as text. Missing or blank gets `required`; anything else
// that isn't the mobile shape (after trimming spaces at both ends) gets the rule.
export const requiredPhone = (required) =>
  z
    .string({ error: (issue) => (isFilled(issue.input) ? PHONE_RULE_MESSAGE : required) })
    .trim()
    .refine((text) => text !== '', { error: required })
    .refine((text) => MOBILE_NUMBER.test(text), { error: PHONE_RULE_MESSAGE });

// An optional mobile number (the venue's): missing, null or blank becomes null;
// otherwise the same mobile rule, after trimming the ends (venue phones are mobile only,
// spec Q1).
export const optionalPhone = () =>
  z
    .preprocess(
      (value) => (value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value),
      z.string({ error: PHONE_RULE_MESSAGE }).trim().nullable(),
    )
    .refine((text) => text === null || MOBILE_NUMBER.test(text), { error: PHONE_RULE_MESSAGE });

// One of the five positions, exactly as spelled. Missing gets `required`.
export const position = (required) =>
  z.enum(POSITIONS, { error: (issue) => (isFilled(issue.input) ? POSITION_MESSAGE : required) });

// The player's area: free text, spaces at both ends removed and every run of spaces,
// tabs or line breaks inside made one space (spec P4). Blank or missing becomes null;
// otherwise 2–40 characters. The letters stay as typed.
export const area = () =>
  z
    .preprocess((value) => (value === undefined ? null : value), z.string({ error: 'Area must be text' }).nullable())
    .transform((text) => (text === null ? null : text.trim().replace(/\s+/g, ' ')))
    .transform((text) => (text === '' ? null : text))
    .refine((text) => text === null || lengthBetween(AREA)(text), {
      error: `Area must be between ${AREA.min} and ${AREA.max} characters`,
    });

// A number in a range, or missing/null. Numbers only: "170" (text) is refused.
const optionalMeasurement = ({ min, max, notNumber, outOfRange }) =>
  z
    .number({ error: notNumber })
    .refine((n) => n >= min && n <= max, { error: outOfRange })
    .nullable()
    .optional()
    .transform((n) => n ?? null);

export const height = () =>
  optionalMeasurement({
    min: 100,
    max: 250,
    notNumber: 'Height must be a number',
    outOfRange: 'Height must be between 100 and 250 cm',
  });

export const weight = () =>
  optionalMeasurement({
    min: 30,
    max: 200,
    notNumber: 'Weight must be a number',
    outOfRange: 'Weight must be between 30 and 200 kg',
  });

// Optional text that's trimmed: missing, null or blank becomes null; otherwise at most
// `max` characters after trimming (spec P13).
const trimmedOptionalText = ({ max, notText, tooLong }) =>
  z
    .preprocess((value) => (value === undefined ? null : value), z.string({ error: notText }).trim().nullable())
    .transform((text) => (text === '' ? null : text))
    .refine((text) => text === null || charCount(text) <= max, { error: tooLong });

export const venueAddress = () =>
  trimmedOptionalText({
    max: VENUE_ADDRESS_MAX,
    notText: 'Address must be text',
    tooLong: `Address must be at most ${VENUE_ADDRESS_MAX} characters`,
  });

export const venueDescription = () =>
  trimmedOptionalText({
    max: VENUE_DESCRIPTION_MAX,
    notText: 'Description must be text',
    tooLong: `Description must be at most ${VENUE_DESCRIPTION_MAX} characters`,
  });

// An optional website: trimmed, blank becomes null, otherwise at most 200 characters
// and a real http/https link (isWebLink, spec P18).
export const website = () =>
  trimmedOptionalText({
    max: VENUE_WEBSITE_MAX,
    notText: 'Website must be text',
    tooLong: `Website must be at most ${VENUE_WEBSITE_MAX} characters`,
  }).refine((text) => text === null || isWebLink(text), { error: WEBSITE_MESSAGE });
