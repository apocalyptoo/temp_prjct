import express from 'express';
import { register, login, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/authController.js';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyEmail);

//password reset
router.post('/forgot', requestPasswordReset); 
router.post('/reset', resetPassword);   

router.get('/reset-password-page', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.send('<h3>Invalid reset link</h3>');
  }

  res.send(`
    <h2>Reset Your Password</h2>
    <form method="POST" action="/auth/reset">
      <input type="hidden" name="token" value="${token}" />
      <input type="password" name="password" placeholder="New Password" required />
      <button type="submit">Reset Password</button>
    </form>
  `);
});

export default router;
