// Phone numbers as people type them (docs/features/profiles-and-registration.md, P8).
// The backend accepts only the 11 digits of a Bangladeshi mobile number, so the app
// tidies what was typed before checking and sending it. The field itself keeps showing
// what the person typed.

// 01, then 3–9, then 8 more digits: the same rule as the backend
// (backend/src/validation/profileFields.js, MOBILE_NUMBER).
export const MOBILE_NUMBER = /^01[3-9]\d{8}$/;

// The backend's own message for a number that doesn't fit the rule.
export const PHONE_RULE_MESSAGE =
  'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';

// Removes spaces and dashes ("01712-345 678" → "01712345678"), then the country code
// +88 or 88 when "01" follows it ("+8801712345678" → "01712345678"). Only then: any
// other number is left as it is, so the check refuses it instead of the tidy-up
// turning it into a different number.
export function cleanPhone(text) {
  const compact = String(text ?? '').replace(/[\s-]/g, '');
  return compact.replace(/^\+?88(?=01)/, '');
}

// True when the (tidied) text is a Bangladeshi mobile number.
export const isMobileNumber = text =>
  typeof text === 'string' && MOBILE_NUMBER.test(text);
