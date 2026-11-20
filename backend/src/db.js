import { PrismaClient } from '@prisma/client';

// The one Prisma client for the whole server. Every PrismaClient opens its own
// pool of database connections, so creating one per file would multiply the
// connections the server holds (hosted Postgres plans cap how many you get).
// Import `prisma` from here instead of calling `new PrismaClient()` anywhere else in src/.
export const prisma = new PrismaClient();
