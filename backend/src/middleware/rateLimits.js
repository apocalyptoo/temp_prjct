// Rate limits for the account routes, counted per client address (req.ip).
// Behind ngrok, req.ip is only the real visitor's address because server.js sets
// "trust proxy" to 1. Counters live in memory, so they reset when the server restarts.
import { rateLimit } from 'express-rate-limit';
import { isFormRequest, messagePage } from '../utils/pages.js';

const MINUTE = 60 * 1000;

const limiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8', // tells clients when they can try again (RateLimit headers)
    legacyHeaders: false,
    handler: (req, res) => {
      // The reset form is used in a browser, so it gets a readable page instead of JSON.
      if (isFormRequest(req)) {
        return res.status(429).send(messagePage({ title: 'Too many attempts', message }));
      }
      return res.status(429).json({ error: message });
    },
  });

export const loginLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});

export const registerLimiter = limiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: 'Too many sign-up attempts. Please try again in an hour.',
});

export const forgotPasswordLimiter = limiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: 'Too many password reset requests. Please try again in an hour.',
});

export const resetPasswordLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Too many attempts to reset the password. Please wait 15 minutes and try again.',
});
