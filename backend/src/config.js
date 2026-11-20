// Loads backend/.env, checks every server setting once, and exports the result.
// If a setting is missing or invalid, the server stops here with a clear message
// instead of failing later (for example the first time an email is sent).
// server.js imports this file first, so the settings exist before any other code runs.
// This is the only file in src/ that reads process.env.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { loadConfig, ConfigError } from './config/loadConfig.js';

// backend/.env, found from this file's own location, so it works whichever folder
// the server is started from. A missing file isn't an error by itself: real hosting
// supplies the settings directly, and loadConfig reports anything that's missing.
// Settings already in the environment win over the file (dotenv never overwrites them).
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

function loadOrExit() {
  try {
    return loadConfig(process.env);
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    // Names and reasons only: never print a setting's value (some are secrets).
    const lines = err.problems.map((p) => `  - ${p.name}: ${p.reason}`);
    console.error(
      [
        "Server can't start: these settings in backend/.env are missing or invalid:",
        ...lines,
        'See backend/.env.example.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

export const config = loadOrExit();
