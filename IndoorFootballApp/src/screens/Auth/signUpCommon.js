// Shared by the player and venue owner sign-up forms (docs/features/profiles-and-
// registration.md, section e): the checks run before sending, with the backend's own
// messages where it has one, so each problem shows under its field. The backend still
// checks everything again.
import { POSITIONS } from '../../constants/positions';
import {
  cleanPhone,
  isMobileNumber,
  PHONE_RULE_MESSAGE,
} from '../../utils/phone';
import { newPasswordProblem } from '../../utils/password';

// Counts characters as people see them (code points), like the backend, so a Bangla
// name isn't over-counted.
export const charCount = text => [...text].length;

export const PLAYER_NAME = { min: 2, max: 50 };
export const VENUE_NAME = { min: 2, max: 60 };
export const MAX_EMAIL_LENGTH = 254;
export const TERMS_REQUIRED =
  'Please accept the Terms of Use and Privacy Policy';

// Something@something.something, with no spaces. The backend's check is stricter and
// still has the last word ("Please enter a valid email address").
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const between = (text, { min, max }) =>
  charCount(text) >= min && charCount(text) <= max;

// Each returns the field's first problem, or null.

export function nameProblem(name, limits, { required, label }) {
  const trimmed = name.trim();
  if (trimmed === '') return required;
  if (!between(trimmed, limits)) {
    return `${label} must be between ${limits.min} and ${limits.max} characters`;
  }
  return null;
}

export function emailProblem(email) {
  const trimmed = email.trim();
  if (trimmed === '') return 'Email is required';
  if (!EMAIL_SHAPE.test(trimmed)) return 'Please enter a valid email address';
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return `Email must be at most ${MAX_EMAIL_LENGTH} characters`;
  }
  return null;
}

export function phoneProblem(phone) {
  if (phone.trim() === '') return 'Phone number is required';
  return isMobileNumber(cleanPhone(phone)) ? null : PHONE_RULE_MESSAGE;
}

export const positionProblem = position =>
  POSITIONS.includes(position) ? null : 'Choose a position';

export function confirmProblem(password, confirm) {
  if (!confirm) return 'Confirm your password';
  return confirm === password ? null : "Passwords don't match";
}

export const termsProblem = agreed => (agreed ? null : TERMS_REQUIRED);

// Every field's problem (null when fine), and whether there's any.
const result = errors => ({
  errors,
  ok: Object.values(errors).every(problem => problem === null),
});

export function checkPlayerSignUp({
  name,
  email,
  phone,
  position,
  password,
  confirm,
  agreed,
}) {
  return result({
    name: nameProblem(name, PLAYER_NAME, {
      required: 'Name is required',
      label: 'Name',
    }),
    email: emailProblem(email),
    phone: phoneProblem(phone),
    position: positionProblem(position),
    password: newPasswordProblem(password),
    confirm: confirmProblem(password, confirm),
    terms: termsProblem(agreed),
  });
}

export function checkOwnerSignUp({
  venueName,
  email,
  password,
  confirm,
  agreed,
}) {
  return result({
    venueName: nameProblem(venueName, VENUE_NAME, {
      required: 'Venue name is required',
      label: 'Venue name',
    }),
    email: emailProblem(email),
    password: newPasswordProblem(password),
    confirm: confirmProblem(password, confirm),
    terms: termsProblem(agreed),
  });
}
