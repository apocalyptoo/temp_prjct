// The password strength rule, repeated from the backend (backend/src/utils/password.js
// and the 72-byte limit in backend/src/validation/authSchemas.js) so the app can say what's
// wrong before sending (docs/features/profiles-and-registration.md, P21). Keep the two
// in sync: the backend still decides.

// The only characters the backend counts as "special". A dash or an underscore isn't one
// of them, so the helper lists them.
export const PASSWORD_SYMBOLS = '!@#$%^&*(),.?":{}|<>';

// The backend's own messages.
export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes
export const PASSWORD_TOO_LONG = `Password must be at most ${PASSWORD_MAX_BYTES} characters (emoji and non-English letters count as more than one)`;

// Shown under a new password field.
export const PASSWORD_HELPER = `At least 8 characters, with an uppercase letter, a lowercase letter, a number and one of these symbols: ${PASSWORD_SYMBOLS.split(
  '',
).join(' ')}`;

// Exactly the backend's isStrongPassword.
export const isStrongPassword = password =>
  typeof password === 'string' &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[!@#$%^&*(),.?":{}|<>]/.test(password);

// The length in UTF-8 bytes, the way bcrypt (and the backend) count it.
export function byteCount(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// The first problem with a new password, or null.
export function newPasswordProblem(password) {
  if (!password) return 'Password is required';
  if (!isStrongPassword(password)) return PASSWORD_RULE_MESSAGE;
  if (byteCount(password) > PASSWORD_MAX_BYTES) return PASSWORD_TOO_LONG;
  return null;
}
