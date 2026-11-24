// HTML bodies of the account emails. Every inserted value is escaped, because some
// (like the user's name) come straight from what the user typed.
import { escapeHtml } from './html.js';

export const verifyEmailHtml = ({ displayName, verifyLink }) => `
        <h2>Welcome, ${escapeHtml(displayName)}!</h2>
        <p>Please verify your email by clicking below:</p>
        <a href="${escapeHtml(verifyLink)}" target="_blank"
           style="padding:10px 20px;background:#007BFF;color:white;text-decoration:none;border-radius:5px;">
           Verify Email
        </a>
      `;

export const resetEmailHtml = ({ resetLink }) => `
          <p>Click to reset your password:</p>
          <a href="${escapeHtml(resetLink)}">Reset password</a>
          <p>This link expires in 1 hour.</p>
        `;

// The notice after a password change while logged in (spec d endpoint 6). No link on
// purpose: a link in a "your account changed" email is what phishing copies.
export const passwordChangedEmailHtml = ({ displayName }) => `
          <p>Hi ${escapeHtml(displayName)},</p>
          <p>The password for your ConnectArena account was just changed.</p>
          <p>If this was you, you don't need to do anything. If it wasn't, use Forgot password on the app's login screen right away to set a new one.</p>
        `;

// The notice after an account is deleted (docs/features/account-deletion.md, d.3, P9).
// The same text whether the user or the admin deleted it, and no link, like above.
// Phase 5 adds the support address.
export const accountDeletedEmailHtml = ({ displayName }) => `
          <p>Hi ${escapeHtml(displayName)},</p>
          <p>Your ConnectArena account and the profile that belonged to it were just deleted. You can't log in to it any more.</p>
          <p>This can't be undone.</p>
        `;
