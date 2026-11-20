import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
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


