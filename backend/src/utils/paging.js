// Offset paging, the same on every paged list (docs/features/explore.md, d.1, D1).
// `page` and `limit` come checked from the query (pageParam and limitParam in
// src/validation/listQuery.js), so they are whole numbers within their limits.

// Prisma's `skip` and `take` for a page (also the OFFSET and LIMIT of a raw query).
export const pageArgs = ({ page, limit }) => ({ skip: (page - 1) * limit, take: limit });

// The reply of every paged list. `total` is how many rows match the search and filters
// for this viewer, on all pages together; a page past the end has no items.
export const pagedReply = (items, total, { page, limit }) => ({ items, page, limit, total });
