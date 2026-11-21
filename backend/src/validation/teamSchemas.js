// Request schemas for the /teams routes. See src/middleware/validate.js for how they're used.
// Ids in the URL (:teamId, :userId) are checked with parseId in the controllers, not here.
import { z } from 'zod';
import { charCount } from './common.js';
import { MAX_DB_INT } from '../utils/ids.js';

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
// object, not a decimal, and no bigger than the database's Int column holds (the same
// limit as parseId), so Prisma never gets a number it can't store.
export const inviteSchema = z.object(
  {
    userId: z
      .number({ error: 'userId must be a positive integer' })
      .refine((n) => Number.isInteger(n) && n > 0 && n <= MAX_DB_INT, { error: 'userId must be a positive integer' }),
  },
  { error: 'userId must be a positive integer' }
);

export const JOIN_REQUEST_MESSAGE_MAX = 150;
const MESSAGE_NOT_TEXT = 'Message must be text';

// ── POST /teams/:teamId/requests ──
// message: optional text to the captain, trimmed, at most 150 characters (code points,
// like team names); missing, null, empty or only spaces is stored as null
// (docs/PRODUCT.md, "Join request message"). A request with no body has no message.
export const joinRequestSchema = z.object(
  {
    message: z
      .string({ error: MESSAGE_NOT_TEXT })
      .trim()
      .nullish()
      .transform((message) => message || null)
      .refine((message) => message === null || charCount(message) <= JOIN_REQUEST_MESSAGE_MAX, {
        error: `Message must be at most ${JOIN_REQUEST_MESSAGE_MAX} characters`,
      }),
  },
  { error: MESSAGE_NOT_TEXT }
);

// ── POST /teams/:teamId/transfer ──
// The new captain's userId: the same rule (and message) as inviting.
export const transferSchema = inviteSchema;

// ── PATCH /teams/:teamId ──
// The same rules as creating a team. The app always sends both fields; a missing
// description is stored as null, exactly as at create (docs/features/team-membership.md, P7).
export const updateTeamSchema = createTeamSchema;
