import express from 'express';
import {
  register,
  login,
  verifyEmail,
  sendInvalidVerifyLinkPage,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  sendResetFailure,
  getMe,
  changePassword,
  previewMyDeletion,
  deleteMyAccount,
  ADMIN_STAYS,
} from '../controllers/authController.js';
import { verifyToken, notAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  emailOnlySchema,
  resetSchema,
  emailLinkQuerySchema,
  changePasswordSchema,
  deleteAccountSchema,
  INVALID_LOGIN,
} from '../validation/authSchemas.js';
import { escapeHtml } from '../utils/html.js';
import { messagePage } from '../utils/pages.js';
import {
  loginLimiters,
  registerLimiter,
  forgotPasswordLimiters,
  resetPasswordLimiter,
  resetPageLimiter,
  verifyLinkLimiter,
  resendVerificationLimiters,
  changePasswordLimiters,
  deleteAccountLimiters,
} from '../middleware/rateLimits.js';
const router = express.Router();

// Rate limiters come first on each route, then validation (validate.js), then the controller.
router.post('/register', registerLimiter, validate({ body: registerSchema }), register);
router.post('/login', ...loginLimiters, validate({ body: loginSchema }, { message: INVALID_LOGIN }), login);
router.get(
  '/verify',
  verifyLinkLimiter,
  validate({ query: emailLinkQuerySchema }, { onInvalid: sendInvalidVerifyLinkPage }),
  verifyEmail
);
router.post(
  '/resend-verification',
  ...resendVerificationLimiters,
  validate({ body: emailOnlySchema }),
  resendVerification
);
router.get('/me', verifyToken, getMe); // who is logged in (the app calls it at start-up)

// Change password while logged in. verifyToken first: the per-account limiter needs
// req.user. A success replies with a fresh token (the other devices are logged out).
router.post('/change-password', verifyToken, ...changePasswordLimiters, validate({ body: changePasswordSchema }), changePassword);

// Delete my account (docs/features/account-deletion.md, d.4): players and venue owners.
// The admin is refused first, whatever the body says.
router.get('/deletion-preview', verifyToken, notAdmin(ADMIN_STAYS), previewMyDeletion);
router.post(
  '/delete-account',
  verifyToken,
  notAdmin(ADMIN_STAYS),
  ...deleteAccountLimiters,
  validate({ body: deleteAccountSchema }),
  deleteMyAccount
);

//password reset
router.post('/forgot', ...forgotPasswordLimiters, validate({ body: emailOnlySchema }), requestPasswordReset);
// A problem goes through the controller's failure reply: JSON for the app, an HTML
// page (with "Try again" where it helps) for the browser form.
router.post('/reset', resetPasswordLimiter, validate({ body: resetSchema }, { onInvalid: sendResetFailure }), resetPassword);

// Only a token shaped like the ones the server generates (64 lowercase hex characters)
// gets the form. Anything else can't be a real reset link.
const sendInvalidResetPage = (req, res) =>
  res.status(400).send(
    messagePage({ title: 'Invalid or expired link', message: 'Please request a new password reset from the app.' })
  );

router.get(
  '/reset-password-page',
  resetPageLimiter,
  validate({ query: emailLinkQuerySchema }, { onInvalid: sendInvalidResetPage }),
  (req, res) => {
    const { token } = req.valid.query;

    // escapeHtml is a second line of defence: a well-formed token has nothing to escape.
    res.send(`
    <h2>Reset Your Password</h2>
    <form method="POST" action="/auth/reset">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <input type="password" name="password" placeholder="New Password" required />
      <button type="submit">Reset Password</button>
    </form>
  `);
  }
);

export default router;
