// The one password strength rule, used by registration, password reset and the
// createAdmin script, so they can't drift apart.

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

// True only for a string with at least 8 characters, including an uppercase letter,
// a lowercase letter, a number and a special character. Anything that isn't a string
// (an array, an object, a number) is rejected.
export const isStrongPassword = (password) =>
  typeof password === 'string' &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[!@#$%^&*(),.?":{}|<>]/.test(password);
