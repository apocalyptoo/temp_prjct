// Request schemas for the /auth routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { normalizeEmail } from '../utils/email.js';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password.js';
import { isWellFormedToken } from '../utils/tokens.js';
import { byteCount, inStages, isFilled } from './common.js';
import { playerName, position, requiredPhone, venueName } from './profileFields.js';

// ── Limits ──
export const MAX_EMAIL_LENGTH = 254; // the longest address email systems accept
export const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes

// ── Messages (the app shows `error` in an alert) ──
export const INVALID_LOGIN = 'Invalid email or password';
export const INVALID_RESET_LINK = 'Invalid or expired token';
const REGISTER_REQUIRED = 'Email, password, role, and profileData are required';
const PLAYER_REQUIRED = 'PLAYER profile requires phone and position';
const VENUE_NAME_REQUIRED = 'Venue name is required';
export const TERMS_REQUIRED = 'Please accept the Terms of Use and Privacy Policy';
const RESET_REQUIRED = 'Token and new password required';
const EMAIL_REQUIRED = 'Email is required';
export const PASSWORD_TOO_LONG = `Password must be at most ${MAX_PASSWORD_BYTES} characters (emoji and non-English letters count as more than one)`;

// ── Pieces ──

// An email that normalizeEmail accepts (a non-blank string), lowercased and trimmed.
const normalisedEmail = (message) =>
  z.custom((value) => normalizeEmail(value) !== null, { error: message }).transform(normalizeEmail);

// The shared strength rule from utils/password.js, plus bcrypt's 72-byte limit.
export const newPassword = z
  .custom(isStrongPassword, { error: PASSWORD_RULE_MESSAGE })
  .refine((password) => byteCount(password) <= MAX_PASSWORD_BYTES, { error: PASSWORD_TOO_LONG });

// "I agree to the Terms of Use and Privacy Policy": exactly true (not "true", not 1).
// It's the last key of each role's object, so a request with other problems still gets
// the message it got before (spec P9).
const acceptedTerms = z.literal(true, { error: TERMS_REQUIRED });

// ── POST /auth/register ──
// The short sign-up forms (docs/PRODUCT.md, "Registration"). The checks run in stages,
// in the same order as before, so a request with several problems still gets the same
// message: required fields, then role, then email and password, then the role's
// profile fields, and the Terms last. Fields the short forms no longer have (height,
// weight, address, the venue's phone, address, description and website) are ignored.

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
  name: playerName('Name is required for PLAYER'),
  profileData: z.object(
    {
      phone: requiredPhone(PLAYER_REQUIRED),
      position: position(PLAYER_REQUIRED),
    },
    { error: PLAYER_REQUIRED },
  ),
  acceptedTerms,
});

const ownerRegistration = z.object({
  email: z.string(),
  password: z.string(),
  role: z.literal('OWNER'),
  profileData: z.object({ indoorName: venueName(VENUE_NAME_REQUIRED) }, { error: VENUE_NAME_REQUIRED }),
  acceptedTerms,
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
