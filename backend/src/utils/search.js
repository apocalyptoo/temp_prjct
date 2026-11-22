// Text search in Prisma queries: "matches part of the text, ignoring upper and lower
// case" (PRODUCT.md, "Profiles" → filtering by area; docs/features/venues.md, d endpoint 3).
//
// Prisma's `contains` becomes a Postgres ILIKE '%…%' and does NOT escape the text, so
// a % or _ typed by someone would act as a wildcard ("%" would match every row, "C_mp"
// would match "Camp"). escapeLike puts a backslash (ILIKE's escape character) before
// %, _ and \, so they only match themselves. Checked against the database on
// 2026-11-23.
export const escapeLike = (text) => text.replace(/[\\%_]/g, (character) => `\\${character}`);

// A Prisma condition: the column contains `text`, ignoring case, with % and _ literal.
export const containsText = (text) => ({ contains: escapeLike(text), mode: 'insensitive' });
