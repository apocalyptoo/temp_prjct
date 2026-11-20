// Tests loadConfig directly. It doesn't import helpers.js, so it needs no server or database.
// All values are fake. Each one contains a marker ("zq") so the tests can check that
// error messages never repeat a value.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { loadConfig, ConfigError, EXAMPLE_JWT_SECRET } from '../src/config/loadConfig.js';

const validEnv = () => ({
  DATABASE_URL: 'postgresql://fakeuser:FAKEDBPASS-zq1@localhost:5432/fakedb',
  JWT_SECRET: 'FAKEJWT-zq2-' + 'a'.repeat(40),
  EMAIL_USER: 'fake-zq3@example.com',
  EMAIL_PASS: 'FAKEPASS-zq4',
  BACKEND_PUBLIC_URL: 'https://fake-zq5.example.com',
});

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'BACKEND_PUBLIC_URL'];

// Runs loadConfig and returns the ConfigError it throws (fails the test if it doesn't throw).
function configError(env) {
  try {
    loadConfig(env);
  } catch (err) {
    assert.ok(err instanceof ConfigError, 'expected a ConfigError');
    return err;
  }
  assert.fail('expected loadConfig to throw');
}

const problemNames = (err) => err.problems.map((p) => p.name);

describe('A valid env', () => {
  test('passes, PORT defaults to 4000, and the result is frozen', () => {
    const config = loadConfig(validEnv());
    assert.deepEqual(config, {
      port: 4000,
      jwtSecret: 'FAKEJWT-zq2-' + 'a'.repeat(40),
      emailUser: 'fake-zq3@example.com',
      emailPass: 'FAKEPASS-zq4',
      backendPublicUrl: 'https://fake-zq5.example.com',
    });
    assert.ok(Object.isFrozen(config));
  });

  test('accepts postgres:// as well as postgresql://, and http:// as well as https://', () => {
    const config = loadConfig({
      ...validEnv(),
      DATABASE_URL: 'postgres://u:p@localhost/db',
      BACKEND_PUBLIC_URL: 'http://localhost:4000',
    });
    assert.equal(config.backendPublicUrl, 'http://localhost:4000');
  });

  test('a blank PORT means the default; a valid PORT is used as a number', () => {
    assert.equal(loadConfig({ ...validEnv(), PORT: '   ' }).port, 4000);
    assert.equal(loadConfig({ ...validEnv(), PORT: '1' }).port, 1);
    assert.equal(loadConfig({ ...validEnv(), PORT: '65535' }).port, 65535);
    assert.equal(loadConfig({ ...validEnv(), PORT: '5000' }).port, 5000);
  });

  test('ignores settings that are not server settings', () => {
    const config = loadConfig({ ...validEnv(), ADMIN_EMAIL: '', ADMIN_PASSWORD: 'x', TEST_BASE_URL: 'nope' });
    assert.equal(config.port, 4000);
  });
});

describe('Missing settings', () => {
  for (const name of REQUIRED) {
    test(`${name} missing gives an error naming it`, () => {
      const env = validEnv();
      delete env[name];
      const err = configError(env);
      assert.deepEqual(err.problems, [{ name, reason: 'missing' }]);
      assert.match(err.message, new RegExp(`${name}: missing`));
    });

    test(`${name} blank or only spaces counts as missing`, () => {
      for (const blank of ['', '   ', '\t\n']) {
        const err = configError({ ...validEnv(), [name]: blank });
        assert.deepEqual(err.problems, [{ name, reason: 'missing' }]);
      }
    });
  }

  test('several problems are all listed in one error', () => {
    const err = configError({
      DATABASE_URL: 'mysql://localhost/db',
      JWT_SECRET: 'short',
      BACKEND_PUBLIC_URL: 'https://ok.example.com/',
      PORT: 'abc',
    });
    assert.deepEqual(problemNames(err), ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'PORT']);
    for (const name of problemNames(err)) assert.ok(err.message.includes(name), `message names ${name}`);
  });
});

describe('Invalid values', () => {
  test('DATABASE_URL must be a postgres address', () => {
    for (const bad of ['mysql://u:p@localhost/db', 'localhost:5432', 'postgresql:/oops']) {
      const err = configError({ ...validEnv(), DATABASE_URL: bad });
      assert.deepEqual(problemNames(err), ['DATABASE_URL']);
    }
  });

  test('JWT_SECRET shorter than 32 characters is refused; exactly 32 is fine', () => {
    const err = configError({ ...validEnv(), JWT_SECRET: 'a'.repeat(31) });
    assert.deepEqual(err.problems, [{ name: 'JWT_SECRET', reason: 'must be at least 32 characters' }]);
    assert.equal(loadConfig({ ...validEnv(), JWT_SECRET: 'a'.repeat(32) }).jwtSecret, 'a'.repeat(32));
  });

  test('JWT_SECRET equal to the .env.example placeholder is refused, without printing it', () => {
    for (const value of [EXAMPLE_JWT_SECRET, `  ${EXAMPLE_JWT_SECRET} `]) {
      const err = configError({ ...validEnv(), JWT_SECRET: value });
      assert.deepEqual(err.problems, [
        { name: 'JWT_SECRET', reason: 'still the example placeholder from .env.example, generate a real secret' },
      ]);
      assert.ok(!err.message.includes(EXAMPLE_JWT_SECRET), 'the placeholder itself is not printed');
    }
  });

  test('the placeholder loadConfig refuses is the one actually in backend/.env.example', () => {
    const example = dotenv.parse(fs.readFileSync(new URL('../.env.example', import.meta.url)));
    assert.equal(example.JWT_SECRET, EXAMPLE_JWT_SECRET);
  });

  test('EMAIL_USER must contain "@"', () => {
    const err = configError({ ...validEnv(), EMAIL_USER: 'not-an-email' });
    assert.deepEqual(problemNames(err), ['EMAIL_USER']);
  });

  test('BACKEND_PUBLIC_URL must be a valid http:// or https:// address', () => {
    for (const bad of ['ftp://example.com', 'example.com', 'https://', 'http//example.com', 'javascript:alert(1)', 'https://exa mple.com']) {
      const err = configError({ ...validEnv(), BACKEND_PUBLIC_URL: bad });
      assert.deepEqual(problemNames(err), ['BACKEND_PUBLIC_URL'], `refuses ${bad}`);
    }
  });

  test('BACKEND_PUBLIC_URL trailing slashes are removed', () => {
    assert.equal(loadConfig({ ...validEnv(), BACKEND_PUBLIC_URL: 'https://a.example.com/' }).backendPublicUrl, 'https://a.example.com');
    assert.equal(loadConfig({ ...validEnv(), BACKEND_PUBLIC_URL: 'https://a.example.com//' }).backendPublicUrl, 'https://a.example.com');
    assert.equal(loadConfig({ ...validEnv(), BACKEND_PUBLIC_URL: ' https://a.example.com/api/ ' }).backendPublicUrl, 'https://a.example.com/api');
  });

  test('PORT must be a whole number from 1 to 65535', () => {
    for (const bad of ['0', '70000', '65536', 'abc', '-1', '40.5', '4000abc']) {
      const err = configError({ ...validEnv(), PORT: bad });
      assert.deepEqual(problemNames(err), ['PORT'], `refuses ${bad}`);
    }
  });
});

describe('Errors never contain the values', () => {
  test('neither the bad values nor the good ones appear in the error', () => {
    const env = {
      DATABASE_URL: 'mysql://SECRETDB-zq11@localhost/db',
      JWT_SECRET: 'SHORTJWT-zq12',
      EMAIL_USER: 'NOATSIGN-zq13',
      EMAIL_PASS: 'GOODPASS-zq14', // valid, still must not appear
      BACKEND_PUBLIC_URL: 'ftp://SECRETURL-zq15',
      PORT: 'BADPORT-zq16',
    };
    const err = configError(env);
    assert.equal(err.problems.length, 5);
    const everything = [err.message, String(err.stack), JSON.stringify(err.problems)].join('\n');
    for (const value of Object.values(env)) {
      assert.ok(!everything.includes(value), 'the error must not contain a setting value');
    }
    assert.ok(!everything.includes('zq1'), 'no marker from any value appears');
  });
});
