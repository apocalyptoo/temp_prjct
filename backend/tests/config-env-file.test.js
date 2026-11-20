// Checks where src/config.js finds backend/.env. Each test starts a separate node
// process, so the checks see a fresh environment. No server or database needed,
// but the first test uses your real backend/.env (it never prints its values).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const SERVER_SETTINGS = ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'BACKEND_PUBLIC_URL', 'PORT'];

// This process's environment without any server settings, so the child has to find them itself.
function envWithoutServerSettings() {
  const env = { ...process.env };
  for (const name of SERVER_SETTINGS) delete env[name];
  return env;
}

// Imports the given config.js in a new node process started in `cwd`.
function importConfig(configFile, { cwd, env }) {
  const code = `await import(${JSON.stringify(pathToFileURL(configFile).href)}); console.log('config loaded');`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env, encoding: 'utf8' });
}

describe('src/config.js finds backend/.env', () => {
  test('even when the server is started from another folder', () => {
    const realEnvFile = path.join(backendDir, '.env');
    assert.ok(fs.existsSync(realEnvFile), 'this test needs backend/.env');

    const result = importConfig(path.join(backendDir, 'src', 'config.js'), {
      cwd: os.tmpdir(), // a folder with no .env in it
      env: envWithoutServerSettings(),
    });
    const output = result.stdout + result.stderr;

    assert.equal(result.status, 0, 'config.js should find backend/.env and accept it');
    assert.match(result.stdout, /config loaded/);
    for (const value of Object.values(dotenv.parse(fs.readFileSync(realEnvFile)))) {
      if (value.trim() !== '') assert.ok(!output.includes(value), 'no setting value is printed');
    }
  });
});

describe('A missing .env file is not an error by itself', () => {
  // A copy of the config files in a throwaway folder inside backend/ (so `dotenv` still
  // resolves from backend/node_modules), where ../.env doesn't exist.
  function copyConfigWithoutEnvFile(t) {
    const dir = fs.mkdtempSync(path.join(backendDir, 'tests', '.tmp-config-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
    fs.copyFileSync(path.join(backendDir, 'src', 'config.js'), path.join(dir, 'src', 'config.js'));
    fs.copyFileSync(
      path.join(backendDir, 'src', 'config', 'loadConfig.js'),
      path.join(dir, 'src', 'config', 'loadConfig.js'),
    );
    assert.ok(!fs.existsSync(path.join(dir, '.env')));
    return path.join(dir, 'src', 'config.js');
  }

  test('settings supplied directly (as real hosting does) are enough', (t) => {
    const configFile = copyConfigWithoutEnvFile(t);
    const result = importConfig(configFile, {
      cwd: os.tmpdir(),
      env: {
        ...envWithoutServerSettings(),
        DATABASE_URL: 'postgresql://fake:fake@localhost:5432/fake',
        JWT_SECRET: 'f'.repeat(40),
        EMAIL_USER: 'fake@example.com',
        EMAIL_PASS: 'fake',
        BACKEND_PUBLIC_URL: 'https://fake.example.com',
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /config loaded/);
  });

  test('with no settings at all, the normal message lists what is missing (exit code 1)', (t) => {
    const configFile = copyConfigWithoutEnvFile(t);
    const result = importConfig(configFile, { cwd: os.tmpdir(), env: envWithoutServerSettings() });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Server can't start: these settings in backend\/\.env are missing or invalid:/);
    for (const name of ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'BACKEND_PUBLIC_URL']) {
      assert.match(result.stderr, new RegExp(`${name}: missing`));
    }
    assert.doesNotMatch(result.stderr, /\n\s+at /, 'no stack trace');
  });
});
