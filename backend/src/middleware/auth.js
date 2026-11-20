import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { MAX_DB_INT } from '../utils/ids.js';

// Exactly "Bearer <token>": the word Bearer (any case), one space, then a token with
// no spaces. Anything else is refused.
const BEARER_HEADER = /^Bearer (\S+)$/i;

const invalidToken = (res) => res.status(401).json({ error: 'Invalid token' });

// Checks the login token and puts the logged-in user on req.user.
// - The token must be signed with our secret using HS256 (written explicitly, so a
//   token claiming another algorithm, or "none", is refused) and not be expired.
// - Its `tv` claim must equal the account's current tokenVersion. Increasing that number
//   (for example on a password reset) cancels every older token: logout on every device.
//   Tokens made before tv existed have no claim and are refused, so they log in again.
// - req.user ({ id, userId, role, email }) comes from the database, not from the token,
//   so a changed role or email takes effect at once.
// A database error isn't a bad token: it's thrown, and Express 5 sends it to the error
// handler (500).
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const match = BEARER_HEADER.exec(authHeader);
  if (!match) return invalidToken(res);

  let claims;
  try {
    claims = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return invalidToken(res);
  }

  const { id, tv } = claims;
  if (!Number.isInteger(id) || id <= 0 || id > MAX_DB_INT || !Number.isInteger(tv)) return invalidToken(res);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== tv) return invalidToken(res);

  req.user = { id: user.id, userId: user.id, role: user.role, email: user.email };
  next();
};

// Team actions (create, invite, accept, reject) are for PLAYER accounts only
// (docs/PRODUCT.md: venue owners and admins can view teams but not join or run them).
export const playersOnly = (req, res, next) => {
  if (req.user.role !== 'PLAYER') {
    return res.status(403).json({
      error: 'Only player accounts can create or join teams. Venue owner and admin accounts can only view teams.',
    });
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
};
