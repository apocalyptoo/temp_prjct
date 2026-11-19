// The one place that decides how an email address is compared and stored.
//
// Emails are lowercased and trimmed wherever they come in (register, login,
// forgot-password, resend-verification, createAdmin.js, the rate-limit keys), so
// "Test@Example.com " and "test@example.com" are the same account.
//
// Returns the normalised email, or null when the value isn't a string or is empty after
// trimming. Callers reply 400 on null, so objects like {"not": ""} never reach Prisma.
export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email === '' ? null : email;
}
