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
