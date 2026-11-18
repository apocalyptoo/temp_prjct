import crypto from 'node:crypto';

// Email verification and password reset tokens: 32 random bytes written as
// 64 lowercase hex characters. The generator and the format check live together
// so they always agree.
export const generateToken = () => crypto.randomBytes(32).toString('hex');

export const isWellFormedToken = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
