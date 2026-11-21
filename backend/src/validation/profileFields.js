// Profile fields shared by registration (authSchemas.js) and the profile edit
// endpoints, so sign-up and editing can't drift apart.
// Rules: docs/PRODUCT.md "Registration" and "Profiles"; details in
// docs/features/profiles-and-registration.md (section d).
import { z } from 'zod';
import { charCount, isFilled, requiredText } from './common.js';

// ── Limits ──
export const PLAYER_NAME = { min: 2, max: 50 };
export const VENUE_NAME = { min: 2, max: 60 };

// The position list, spelled exactly as the app shows it (spec P1). Same values as the
// Position enum in prisma/schema.prisma.
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Any'];

// A Bangladeshi mobile number: 01, then 3–9, then 8 more digits (DECISIONS.md 2026-11-22).
export const MOBILE_NUMBER = /^01[3-9]\d{8}$/;

// ── Messages ──
export const PHONE_RULE_MESSAGE = 'Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678';
export const POSITION_MESSAGE = 'Position must be Goalkeeper, Defender, Midfielder, Forward or Any';

const lengthBetween = ({ min, max }) => (text) => charCount(text) >= min && charCount(text) <= max;

// ── Pieces ──

// A player's name: required, trimmed, 2–50 characters.
export const playerName = (required) =>
  requiredText({ required, notText: 'Name must be text' }).refine(lengthBetween(PLAYER_NAME), {
    error: `Name must be between ${PLAYER_NAME.min} and ${PLAYER_NAME.max} characters`,
  });

// A venue's name: required, trimmed, 2–60 characters.
export const venueName = (required) =>
  requiredText({ required, notText: 'Venue name must be text' }).refine(lengthBetween(VENUE_NAME), {
    error: `Venue name must be between ${VENUE_NAME.min} and ${VENUE_NAME.max} characters`,
  });

// A required mobile number, as text. Missing or blank gets `required`; anything else
// that isn't the mobile shape (after trimming spaces at both ends) gets the rule.
export const requiredPhone = (required) =>
  z
    .string({ error: (issue) => (isFilled(issue.input) ? PHONE_RULE_MESSAGE : required) })
    .trim()
    .refine((text) => text !== '', { error: required })
    .refine((text) => MOBILE_NUMBER.test(text), { error: PHONE_RULE_MESSAGE });

// One of the five positions, exactly as spelled. Missing gets `required`.
export const position = (required) =>
  z.enum(POSITIONS, { error: (issue) => (isFilled(issue.input) ? POSITION_MESSAGE : required) });
