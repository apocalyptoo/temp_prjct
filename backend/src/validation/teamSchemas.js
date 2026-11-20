// Request schemas for the /teams routes. See src/middleware/validate.js for how they're used.
// Ids in the URL (:teamId, :userId) are checked with parseId in the controllers, not here.
import { z } from 'zod';
import { charCount } from './common.js';

export const TEAM_NAME = { min: 2, max: 40 };
export const TEAM_DESCRIPTION_MAX = 200;

const TEAM_NAME_REQUIRED = 'Team name is required';
const TEAM_NAME_LENGTH = `Team name must be between ${TEAM_NAME.min} and ${TEAM_NAME.max} characters`;

// ── POST /teams/create ──
// name: required text, trimmed, 2–40 characters. description: optional text, trimmed,
// at most 200 characters; missing, null, empty or only spaces is stored as null.
// Lengths count code points, so Bangla text isn't over-counted. Names needn't be unique.
export const createTeamSchema = z.object(
  {
    name: z
      .string({
        error: (issue) =>
          issue.input === undefined || issue.input === null ? TEAM_NAME_REQUIRED : 'Team name must be text',
      })
      .trim()
      .refine((name) => name !== '', { error: TEAM_NAME_REQUIRED })
      .refine((name) => charCount(name) >= TEAM_NAME.min && charCount(name) <= TEAM_NAME.max, {
        error: TEAM_NAME_LENGTH,
      }),
    description: z
      .string({ error: 'Description must be text' })
      .trim()
      .nullish()
      .transform((description) => description || null)
      .refine((description) => description === null || charCount(description) <= TEAM_DESCRIPTION_MAX, {
        error: `Description must be at most ${TEAM_DESCRIPTION_MAX} characters`,
      }),
  },
  { error: TEAM_NAME_REQUIRED }
);

// ── POST /teams/:teamId/invite ──
// userId must be a real positive whole number: not text (so "5" is refused), not an
// object, not a decimal.
export const inviteSchema = z.object(
  {
    userId: z
      .number({ error: 'userId must be a positive integer' })
      .refine((n) => Number.isInteger(n) && n > 0, { error: 'userId must be a positive integer' }),
  },
  { error: 'userId must be a positive integer' }
);
