// Request schemas for the /auth routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { normalizeEmail } from '../utils/email.js';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password.js';
import { isWellFormedToken } from '../utils/tokens.js';
import { byteCount, charCount, inStages, isFilled, optionalText, requiredText } from './common.js';

// ── Limits ──
export const MAX_EMAIL_LENGTH = 254; // the longest address email systems accept
export const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes
export const PLAYER_NAME = { min: 2, max: 50 };
export const POSITION_MAX = 30;
export const PLAYER_ADDRESS_MAX = 100;
export const VENUE_NAME = { min: 2, max: 60 };
export const VENUE_ADDRESS_MAX = 200;
export const VENUE_DESCRIPTION_MAX = 500;
export const VENUE_WEBSITE_MAX = 200;

// ── Messages (the app shows `error` in an alert) ──
export const INVALID_LOGIN = 'Invalid email or password';
export const INVALID_RESET_LINK = 'Invalid or expired token';
const REGISTER_REQUIRED = 'Email, password, role, and profileData are required';
const PLAYER_REQUIRED = 'PLAYER profile requires phone and position';
const OWNER_REQUIRED = 'OWNER profile requires indoorName, phone, and address';
const PHONE_DIGITS = 'Phone number must be exactly 11 digits';
const RESET_REQUIRED = 'Token and new password required';
const EMAIL_REQUIRED = 'Email is required';
export const PASSWORD_TOO_LONG = `Password must be at most ${MAX_PASSWORD_BYTES} characters (emoji and non-English letters count as more than one)`;

// ── Pieces ──

// An email that normalizeEmail accepts (a non-blank string), lowercased and trimmed.
const normalisedEmail = (message) =>
  z.custom((value) => normalizeEmail(value) !== null, { error: message }).transform(normalizeEmail);

// The shared strength rule from utils/password.js, plus bcrypt's 72-byte limit.
const newPassword = z
  .custom(isStrongPassword, { error: PASSWORD_RULE_MESSAGE })
  .refine((password) => byteCount(password) <= MAX_PASSWORD_BYTES, { error: PASSWORD_TOO_LONG });

// 11 digits, as text. Missing gets the profile's "requires" message.
const phone = (requiredMessage) =>
  z.string({ error: (issue) => (isFilled(issue.input) ? PHONE_DIGITS : requiredMessage) }).refine(
    (text) => text !== '',
    { error: requiredMessage },
  ).refine((text) => /^\d{11}$/.test(text), { error: PHONE_DIGITS });

const lengthBetween = ({ min, max }) => (text) => charCount(text) >= min && charCount(text) <= max;

// A number in a range, or missing/null. Numbers only: "170" (text) is refused.
const optionalMeasurement = ({ min, max, notNumber, outOfRange }) =>
  z
    .number({ error: notNumber })
    .refine((n) => n >= min && n <= max, { error: outOfRange })
    .nullable()
    .optional()
    .transform((n) => n ?? null);

// ── POST /auth/register ──
// The checks run in stages, in the same order as before zod, so a request with several
// problems still gets the same message: required fields, then role, then email and
// password, then the role's profile fields.

const registerRequired = z.looseObject(
  {
    email: z.custom((value) => normalizeEmail(value) !== null, { error: REGISTER_REQUIRED }),
    password: z.custom(isFilled, { error: REGISTER_REQUIRED }),
    role: z.custom(isFilled, { error: REGISTER_REQUIRED }),
    profileData: z.custom(isFilled, { error: REGISTER_REQUIRED }),
  },
  { error: REGISTER_REQUIRED },
);

const registerRole = z.looseObject({
  role: z.enum(['PLAYER', 'OWNER'], { error: 'Invalid role selected' }),
});

const registerAccount = z.looseObject({
  email: normalisedEmail(REGISTER_REQUIRED)
    .pipe(z.email({ error: 'Please enter a valid email address' }))
    .refine((email) => email.length <= MAX_EMAIL_LENGTH, {
      error: `Email must be at most ${MAX_EMAIL_LENGTH} characters`,
    }),
  password: newPassword,
});

const playerRegistration = z.object({
  email: z.string(),
  password: z.string(),
  role: z.literal('PLAYER'),
  name: requiredText({ required: 'Name is required for PLAYER', notText: 'Name must be text' }).refine(
    lengthBetween(PLAYER_NAME),
    { error: `Name must be between ${PLAYER_NAME.min} and ${PLAYER_NAME.max} characters` },
  ),
  profileData: z.object(
    {
      phone: phone(PLAYER_REQUIRED),
      position: requiredText({ required: PLAYER_REQUIRED, notText: 'Position must be text' }).refine(
        (text) => charCount(text) <= POSITION_MAX,
        { error: `Position must be at most ${POSITION_MAX} characters` },
      ),
      height: optionalMeasurement({
        min: 100,
        max: 250,
        notNumber: 'Height must be a number',
        outOfRange: 'Height must be between 100 and 250 cm',
      }),
      weight: optionalMeasurement({
        min: 30,
        max: 200,
        notNumber: 'Weight must be a number',
        outOfRange: 'Weight must be between 30 and 200 kg',
      }),
      address: optionalText({
        max: PLAYER_ADDRESS_MAX,
        notText: 'Address must be text',
        tooLong: `Address must be at most ${PLAYER_ADDRESS_MAX} characters`,
      }),
    },
    { error: PLAYER_REQUIRED },
  ),
});

const ownerRegistration = z.object({
  email: z.string(),
  password: z.string(),
  role: z.literal('OWNER'),
  profileData: z.object(
    {
      indoorName: requiredText({ required: OWNER_REQUIRED, notText: 'Venue name must be text' }).refine(
        lengthBetween(VENUE_NAME),
        { error: `Venue name must be between ${VENUE_NAME.min} and ${VENUE_NAME.max} characters` },
      ),
      phone: phone(OWNER_REQUIRED),
      // Required, but stored as sent (not trimmed), as before.
      address: z
        .string({ error: (issue) => (isFilled(issue.input) ? 'Address must be text' : OWNER_REQUIRED) })
        .refine((text) => text !== '', { error: OWNER_REQUIRED })
        .refine((text) => charCount(text) <= VENUE_ADDRESS_MAX, {
          error: `Address must be at most ${VENUE_ADDRESS_MAX} characters`,
        }),
      description: optionalText({
        max: VENUE_DESCRIPTION_MAX,
        notText: 'Description must be text',
        tooLong: `Description must be at most ${VENUE_DESCRIPTION_MAX} characters`,
      }),
      website: optionalText({
        max: VENUE_WEBSITE_MAX,
        notText: 'Website must be text',
        tooLong: `Website must be at most ${VENUE_WEBSITE_MAX} characters`,
      }),
    },
    { error: OWNER_REQUIRED },
  ),
});

export const registerSchema = inStages(
  registerRequired,
  registerRole,
  registerAccount,
  z.discriminatedUnion('role', [playerRegistration, ownerRegistration]),
);

// ── POST /auth/login ──
// Used with validate's fixed `message` option: any problem replies INVALID_LOGIN, so
// the reply never says which part was wrong. No email-format check here.
export const loginSchema = z.object({
  email: normalisedEmail(INVALID_LOGIN),
  password: z.string().min(1),
});

// ── POST /auth/forgot and POST /auth/resend-verification ──
// No email-format check: an unknown or odd address gets the usual generic reply.
export const emailOnlySchema = z.object({ email: normalisedEmail(EMAIL_REQUIRED) }, { error: EMAIL_REQUIRED });

// ── POST /auth/reset ──
// Same order as before: both fields present, then the token must be text (an object
// like token[not]= could act as a query operator), then the password rules.
export const resetSchema = inStages(
  z.looseObject(
    {
      token: z.custom(isFilled, { error: RESET_REQUIRED }),
      password: z.custom(isFilled, { error: RESET_REQUIRED }),
    },
    { error: RESET_REQUIRED },
  ),
  z.looseObject({ token: z.string({ error: INVALID_RESET_LINK }) }),
  z.object({ token: z.string(), password: newPassword }),
);

// ── GET /auth/verify and GET /auth/reset-password-page ──
// Only a token shaped like the ones the server makes (64 lowercase hex characters).
// Missing, repeated (an array) or odd tokens fail; the routes then show their HTML page.
export const emailLinkQuerySchema = z.object({ token: z.custom(isWellFormedToken) });
