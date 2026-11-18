import express from 'express';
import { register, login, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { escapeHtml } from '../utils/html.js';
import { isWellFormedToken } from '../utils/tokens.js';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyEmail);

//password reset
router.post('/forgot', requestPasswordReset); 
router.post('/reset', resetPassword);   

router.get('/reset-password-page', (req, res) => {
  const { token } = req.query;

  // Only show the form for a token shaped like the ones the server generates
  // (64 lowercase hex characters). Anything else can't be a real reset link.
  if (!isWellFormedToken(token)) {
    return res.status(400).send('<h3>Invalid or expired link</h3><p>Please request a new password reset.</p>');
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
