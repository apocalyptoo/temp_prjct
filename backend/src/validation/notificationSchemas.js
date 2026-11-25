// Request schemas for the /notifications routes. See src/middleware/validate.js for how
// they're used.
import { z } from 'zod';
import { MAX_DB_INT } from '../utils/ids.js';

const INVALID_ID = 'Invalid notification id';

// ── POST /notifications/read ──
// upToId: a real positive whole number within the database's Int (not text, so "88" is
// refused), like inviteSchema's userId.
export const readNotificationsSchema = z.object(
  {
    upToId: z
      .number({ error: INVALID_ID })
      .refine((n) => Number.isInteger(n) && n > 0 && n <= MAX_DB_INT, { error: INVALID_ID }),
  },
  { error: INVALID_ID }
);
