import express from 'express';
import { register, login, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { escapeHtml } from '../utils/html.js';
import { isWellFormedToken } from '../utils/tokens.js';
import { messagePage } from '../utils/pages.js';
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../middleware/rateLimits.js';
const router = express.Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/verify', verifyEmail);

//password reset
router.post('/forgot', forgotPasswordLimiter, requestPasswordReset);
router.post('/reset', resetPasswordLimiter, resetPassword);

router.get('/reset-password-page', (req, res) => {
  const { token } = req.query;

  // Only show the form for a token shaped like the ones the server generates
  // (64 lowercase hex characters). Anything else can't be a real reset link.
  if (!isWellFormedToken(token)) {
    return res.status(400).send(
      messagePage({ title: 'Invalid or expired link', message: 'Please request a new password reset from the app.' })
    );
  }

  // escapeHtml is a second line of defence: a well-formed token has nothing to escape.
  res.send(`
    <h2>Reset Your Password</h2>
    <form method="POST" action="/auth/reset">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <input type="password" name="password" placeholder="New Password" required />
      <button type="submit">Reset Password</button>
    </form>
  `);
});

export default router;
