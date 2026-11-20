// Turns an id from a URL (always a string) into a database id.
// Returns the number for a positive whole number that fits the database's Int column
// (at most 2147483647), and null for anything else ("abc", "0", "-1", "1.5", "1e3",
// or a missing value), so the caller can reply 400 instead of sending it to Prisma.
export const MAX_DB_INT = 2147483647;

export function parseId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= MAX_DB_INT ? id : null;
}
