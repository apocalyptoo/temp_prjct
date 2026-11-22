// Request schemas for the /admin routes. See src/middleware/validate.js for how they're used.
import { z } from 'zod';
import { charCount } from './common.js';

// The admin's note to a venue owner (docs/features/venues.md, P2): trimmed text of at
// most 200 characters.
export const REVIEW_NOTE_MAX = 200;
const NOTE_NOT_TEXT = 'Note must be text';
const NOTE_TOO_LONG = `Note must be at most ${REVIEW_NOTE_MAX} characters`;

// ── PUT /admin/indoors/:id/note ── (spec d endpoint 7). Blank, null or missing clears
// the note.
export const reviewNoteSchema = z.object({
  note: z
    .preprocess((value) => (value === undefined ? null : value), z.string({ error: NOTE_NOT_TEXT }).trim().nullable())
    .transform((text) => (text === '' ? null : text))
    .refine((text) => text === null || charCount(text) <= REVIEW_NOTE_MAX, { error: NOTE_TOO_LONG }),
});

// ── POST /admin/indoors/:id/move-to-review ── (spec d endpoint 8). The note is
// required: it tells the owner why their venue went back to review.
const NOTE_REQUIRED = 'Add a note for the owner';
export const moveToReviewSchema = z.object({
  note: z
    .string({ error: (issue) => (issue.input === undefined || issue.input === null ? NOTE_REQUIRED : NOTE_NOT_TEXT) })
    .trim()
    .refine((text) => text !== '', { error: NOTE_REQUIRED })
    .refine((text) => charCount(text) <= REVIEW_NOTE_MAX, { error: NOTE_TOO_LONG }),
});
