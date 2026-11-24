// Small helpers shared by the schemas in this folder.
import { z } from 'zod';

// Counts characters as people see them: by code point, so a Bangla name or an emoji
// isn't counted as several characters (JavaScript's .length counts UTF-16 units).
export const charCount = (text) => [...text].length;

// Counts bytes in UTF-8, the way bcrypt sees a password.
export const byteCount = (text) => Buffer.byteLength(text, 'utf8');

// True for anything the old `if (!value)` checks accepted: not missing, null, '', 0 or false.
export const isFilled = (value) => Boolean(value);

// Runs schemas one after another. The first stage with a problem gives the reply,
// and later stages only see input that passed the earlier ones. Used where the order
// of the checks decides which message a request with several problems gets.
export const inStages = (...schemas) => schemas.reduce((earlier, later) => earlier.pipe(later));

// Text that must be filled in: `required` when it's missing or blank, `notText` when
// it's something else (a number, an object, an array). Trimmed. Code-point limits
// are checked afterwards with .refine(...).
export const requiredText = ({ required, notText }) =>
  z
    .string({ error: (issue) => (isFilled(issue.input) ? notText : required) })
    .trim()
    .refine((text) => text !== '', { error: required });

// The code of a deletion preview (previewCodeFor in src/utils/deletion.js): 64 lowercase
// hex characters.
export const previewCode = (message) => z.string({ error: message }).regex(/^[0-9a-f]{64}$/, { error: message });
