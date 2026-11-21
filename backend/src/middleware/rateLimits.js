// Rate limits for the account routes (docs/DECISIONS.md, 2026-11-19).
//
// In Bangladesh many phones on a mobile network can share one public IP address, so
// limits that count only by IP would block whole groups of real users. Instead:
// - login counts only FAILED attempts, per IP + email, with a looser per-IP cap;
// - forgot-password counts per IP + email, with a per-IP cap;
// - the other routes count per IP, with generous numbers.
//
// The IP is req.ip, which is the visitor's real address only because server.js sets
// "trust proxy" to 1 (ngrok). Counters live in memory, so they reset when the server
// restarts and aren't shared between several servers.
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { isFormRequest, messagePage } from '../utils/pages.js';
import { normalizeEmail } from '../utils/email.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// The client's address as a counter key. ipKeyGenerator (from express-rate-limit)
// groups an IPv6 address with the rest of its /56 network, because one connection
// usually owns a whole IPv6 range and could otherwise switch addresses to dodge limits.
const ipKey = (req) => ipKeyGenerator(req.ip);

// The client's address plus the email they typed (lowercased and trimmed, so "A@x.com "
// and "a@x.com" share a counter, via normalizeEmail). If there's no usable email, the
// address alone.
const ipAndEmailKey = (req) => {
  const email = normalizeEmail(req.body?.email);
  return email ? `${ipKey(req)}|${email}` : ipKey(req);
};

const limiter = ({
  windowMs,
  limit,
  message,
  keyGenerator = ipKey,
  onlyFailures = false,
  wasSuccessful,
  html = false,
}) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    // When true, requests that succeed are taken off the count again. By default
    // "succeed" means a status below 400; wasSuccessful can widen that.
    skipSuccessfulRequests: onlyFailures,
    ...(wasSuccessful ? { requestWasSuccessful: wasSuccessful } : {}),
    standardHeaders: 'draft-8', // tells clients when they can try again (RateLimit headers)
    legacyHeaders: false,
    handler: (req, res) => {
      // Pages opened in a browser (the reset form, the verify link) get a readable page.
      if (html || isFormRequest(req)) {
        return res.status(429).send(messagePage({ title: 'Too many attempts', message }));
      }
      return res.status(429).json({ error: message });
    },
  });

const tooManyLogins = 'Too many failed login attempts. Please wait 15 minutes and try again.';

// A login only counts as failed when the password was wrong. Login replies 403 ("please
// verify your email") only after the password was checked and correct, so a 403 is not
// a failed attempt.
const loginWasSuccessful = (req, res) => res.statusCode < 400 || res.statusCode === 403;

// Login: both limits apply. The per-email one runs first, so attempts it has already
// blocked don't also use up the shared per-IP cap.
export const loginLimiters = [
  limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    keyGenerator: ipAndEmailKey,
    onlyFailures: true,
    wasSuccessful: loginWasSuccessful,
    message: tooManyLogins,
  }),
  limiter({ windowMs: 15 * MINUTE, limit: 50, onlyFailures: true, wasSuccessful: loginWasSuccessful, message: tooManyLogins }),
];

export const registerLimiter = limiter({
  windowMs: HOUR,
  limit: 20,
  message: 'Too many sign-up attempts. Please try again in an hour.',
});

const tooManyResets = 'Too many password reset requests. Please try again in an hour.';

export const forgotPasswordLimiters = [
  limiter({ windowMs: HOUR, limit: 5, keyGenerator: ipAndEmailKey, message: tooManyResets }),
  limiter({ windowMs: HOUR, limit: 20, message: tooManyResets }),
];

const tooManyResends = 'Too many requests for a new verification email. Please try again in an hour.';

// Resend verification: like forgot-password, per IP + email with a per-IP cap.
export const resendVerificationLimiters = [
  limiter({ windowMs: HOUR, limit: 5, keyGenerator: ipAndEmailKey, message: tooManyResends }),
  limiter({ windowMs: HOUR, limit: 20, message: tooManyResends }),
];

export const resetPasswordLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Too many attempts to reset the password. Please wait 15 minutes and try again.',
});

export const resetPageLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 30,
  html: true,
  message: 'Too many requests. Please wait 15 minutes and try again.',
});

export const verifyLinkLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 30,
  html: true,
  message: 'Too many requests. Please wait 15 minutes and try again.',
});

// Change password while logged in (DECISIONS.md 2026-11-22, spec D5): like login, only
// failed requests count (a wrong current password, or a new password that breaks the
// rule), 10 per 15 minutes per account and 50 per 15 minutes per IP. The route runs
// verifyToken first, so req.user is the logged-in account.
const tooManyPasswordChanges = 'Too many attempts to change your password. Please wait 15 minutes and try again.';
const accountKey = (req) => `account:${req.user.id}`;

export const changePasswordLimiters = [
  limiter({ windowMs: 15 * MINUTE, limit: 10, keyGenerator: accountKey, onlyFailures: true, message: tooManyPasswordChanges }),
  limiter({ windowMs: 15 * MINUTE, limit: 50, onlyFailures: true, message: tooManyPasswordChanges }),
];
