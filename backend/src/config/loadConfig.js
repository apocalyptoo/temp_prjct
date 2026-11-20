// Checks the server's settings and turns them into one frozen config object.
// A pure function: it doesn't read .env, print anything or stop the process.
// `src/config.js` does those things; tests call loadConfig directly.
//
// Error messages name the setting and the reason, never the value, because
// several settings are secrets (JWT_SECRET, EMAIL_PASS, the password inside DATABASE_URL).

export const DEFAULT_PORT = 4000;
export const MIN_JWT_SECRET_LENGTH = 32;

export class ConfigError extends Error {
  constructor(problems) {
    const lines = problems.map((p) => `${p.name}: ${p.reason}`);
    super(`Invalid settings:\n${lines.join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems; // [{ name, reason }], one per bad setting
  }
}

// Returns the trimmed value, or null when it's missing, not text, or only spaces.
function read(env, name) {
  const value = env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function loadConfig(env) {
  const problems = [];
  const problem = (name, reason) => problems.push({ name, reason });

  // Prisma reads DATABASE_URL from the environment itself, so it's only checked here.
  const databaseUrl = read(env, 'DATABASE_URL');
  if (databaseUrl === null) problem('DATABASE_URL', 'missing');
  else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problem('DATABASE_URL', 'must start with postgresql:// or postgres://');
  }

  const jwtSecret = read(env, 'JWT_SECRET');
  if (jwtSecret === null) problem('JWT_SECRET', 'missing');
  else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problem('JWT_SECRET', `must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }

  const emailUser = read(env, 'EMAIL_USER');
  if (emailUser === null) problem('EMAIL_USER', 'missing');
  else if (!emailUser.includes('@')) problem('EMAIL_USER', 'must be an email address (contain "@")');

  const emailPass = read(env, 'EMAIL_PASS');
  if (emailPass === null) problem('EMAIL_PASS', 'missing');

  let backendPublicUrl = read(env, 'BACKEND_PUBLIC_URL');
  if (backendPublicUrl === null) problem('BACKEND_PUBLIC_URL', 'missing');
  else if (!isHttpUrl(backendPublicUrl)) {
    problem('BACKEND_PUBLIC_URL', 'must be a full web address starting with http:// or https://');
  } else {
    // Links are built as `${backendPublicUrl}/auth/...`, so a trailing slash would give "//".
    backendPublicUrl = backendPublicUrl.replace(/\/+$/, '');
  }

  let port = DEFAULT_PORT;
  const portText = read(env, 'PORT'); // optional
  if (portText !== null) {
    const n = /^\d+$/.test(portText) ? Number(portText) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 65535) port = n;
    else problem('PORT', 'must be a whole number from 1 to 65535 (or left out for 4000)');
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze({ port, jwtSecret, emailUser, emailPass, backendPublicUrl });
}

function isHttpUrl(text) {
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    const url = new URL(text);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}
