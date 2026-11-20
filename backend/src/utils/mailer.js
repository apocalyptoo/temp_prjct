// Sending account emails (verification and password reset).
//
// createMailer(transporter, settings) builds the senders around any nodemailer
// transporter, so tests can pass one that sends nothing (streamTransport). The server's
// own mailer, `mailer` below, uses Gmail SMTP with the settings from backend/.env.
// Creating the Gmail transporter doesn't connect to anything; only sending (and
// checkMailConnection) does.
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { normalizeEmail } from './email.js';
import { verifyEmailHtml, resetEmailHtml } from './emailTemplates.js';

export function createMailer(transporter, { fromAddress, backendPublicUrl }) {
  const from = `"App Support" <${fromAddress}>`;

  // Sends an email, except to @example.com addresses. example.com is reserved and can
  // never receive mail, so those are skipped (the tests use it for throwaway users).
  // The log line shows only the recipient and subject, never tokens or links.
  const sendMail = (options) => {
    const to = normalizeEmail(options.to) ?? '';
    if (to.endsWith('@example.com')) {
      console.log(`Email skipped (example.com): to=${options.to} subject="${options.subject}"`);
      return Promise.resolve();
    }
    // .invalid is a reserved top-level domain that can never receive mail, so fail at
    // once instead of handing it to Gmail. (The tests use it to make sending fail on purpose.)
    if (to.endsWith('.invalid')) {
      return Promise.reject(new Error(`Can't send email to a .invalid address (to=${options.to})`));
    }
    return transporter.sendMail(options);
  };

  // `token` is the plain token: it goes only into the link, never into the database.
  const sendVerificationEmail = ({ email, displayName, token }) =>
    sendMail({
      from,
      to: email,
      subject: 'Verify your email address',
      html: verifyEmailHtml({ displayName, verifyLink: `${backendPublicUrl}/auth/verify?token=${token}` }),
    });

  const sendResetEmail = ({ email, token }) =>
    sendMail({
      from,
      to: email,
      subject: 'Password reset request',
      html: resetEmailHtml({ resetLink: `${backendPublicUrl}/auth/reset-password-page?token=${token}` }),
    });

  return { sendMail, sendVerificationEmail, sendResetEmail };
}

const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: config.emailUser, pass: config.emailPass },
});

export const mailer = createMailer(gmailTransporter, {
  fromAddress: config.emailUser,
  backendPublicUrl: config.backendPublicUrl,
});

// Logs whether Gmail accepts the login. authController.js calls it once when the server
// starts. A failure doesn't stop the server: registration still works, and sending
// failures are logged where they happen.
export function checkMailConnection() {
  gmailTransporter.verify((error) => {
    if (error) console.error('SMTP Connection Error:', error);
    else console.log('SMTP Server is ready to take messages!');
  });
}
