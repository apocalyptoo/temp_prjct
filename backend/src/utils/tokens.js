import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Email verification and password reset tokens: 32 random bytes written as
// 64 lowercase hex characters. The generator and the format check live together
// so they always agree.
export const generateToken = () => crypto.randomBytes(32).toString('hex');

export const isWellFormedToken = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

// What the database stores instead of the token: its SHA-256 hash in lowercase hex.
// The email link carries the token itself; when it comes back, hash it and look up the
// hash. If the database ever leaks, the stored values can't be used as working links.
// A fast hash is fine here (unlike passwords) because the tokens are long and random.
// The migration that converted old tokens uses the same thing in SQL:
// encode(sha256(convert_to(token, 'UTF8')), 'hex').
export const hashToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const MINUTE = 60 * 1000;

// How long a password reset link works after it's sent.
export const RESET_LINK_LIFETIME_MS = 60 * MINUTE;

// How long an email verification link works after it's sent.
export const VERIFY_LINK_LIFETIME_MS = 24 * 60 * MINUTE;

// How long a login token (JWT) is valid after login: 30 days, in seconds (the unit
// jsonwebtoken's expiresIn takes). Logins can still be cancelled earlier by increasing
// the account's tokenVersion (see src/middleware/auth.js).
export const LOGIN_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

// A login token (JWT) for this user: HS256, valid for 30 days, carrying the account's
// current tokenVersion as `tv` (src/middleware/auth.js refuses it once that number has
// been increased). Used by login and by change password, which replies with a fresh
// token so the phone that changed the password stays logged in.
// `user` needs id, role, email and tokenVersion.
export const signLoginToken = (user) =>
  jwt.sign(
    { id: user.id, userId: user.id, role: user.role, email: user.email, tv: user.tokenVersion },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: LOGIN_TOKEN_LIFETIME_SECONDS }
  );

// Minimum time between two account emails of the same kind to the same account.
export const EMAIL_COOLDOWN_MS = 5 * MINUTE;

// True if an email with a link of this lifetime was sent less than EMAIL_COOLDOWN_MS ago.
// The send time isn't stored, but it's the expiry time minus the link's lifetime.
export const sentRecently = (expiresAt, lifetimeMs) => {
  if (!expiresAt) return false;
  const sentAt = expiresAt.getTime() - lifetimeMs;
  return Date.now() - sentAt < EMAIL_COOLDOWN_MS;
};
