// Runs account emails through nodemailer for real, without sending anything: a
// streamTransport builds the complete message (headers and encoded body) in memory and
// never opens a network connection. Doesn't use helpers.js: no server or database needed.
//
// Uses made-up settings (sender and public URL), never the real ones from backend/.env.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { createMailer } from '../src/utils/mailer.js';

const SETTINGS = { fromAddress: 'sender@example.org', backendPublicUrl: 'https://api.example.test' };
const TOKEN = 'a'.repeat(64);

// A transporter that builds the raw message and hands it back instead of sending it.
const streamTransporter = () => nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });

// Splits a raw single-part message into its headers (lowercased names) and decoded body.
function readMessage(raw) {
  const text = raw.toString('utf8');
  const split = text.indexOf('\n\n');
  const headerText = text.slice(0, split).replace(/\n[ \t]+/g, ' '); // unfold long headers
  const headers = {};
  for (const line of headerText.split('\n')) {
    const colon = line.indexOf(':');
    headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
  }
  const encoded = text.slice(split + 2);
  const encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
  return { headers, body: decodeBody(encoded, encoding) };
}

function decodeBody(encoded, encoding) {
  if (encoding === 'base64') return Buffer.from(encoded.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (encoding === 'quoted-printable') {
    const bytes = [];
    const joined = encoded.replace(/=\n/g, ''); // soft line breaks
    for (let i = 0; i < joined.length; i++) {
      if (joined[i] === '=' && /^[0-9A-F]{2}$/i.test(joined.slice(i + 1, i + 3))) {
        bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(...Buffer.from(joined[i], 'utf8'));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }
  return encoded;
}

describe('The verification email, built by nodemailer', () => {
  test('has the right from, to and subject, and the HTML contains the verification link', async () => {
    const { sendVerificationEmail } = createMailer(streamTransporter(), SETTINGS);

    const info = await sendVerificationEmail({ email: 'new.player@example.org', displayName: 'Rahim', token: TOKEN });
    const { headers, body } = readMessage(info.message);

    assert.deepEqual(info.envelope, { from: 'sender@example.org', to: ['new.player@example.org'] });
    assert.equal(headers.from, 'App Support <sender@example.org>'); // nodemailer drops quotes it doesn't need
    assert.equal(headers.to, 'new.player@example.org');
    assert.equal(headers.subject, 'Verify your email address');
    assert.match(headers['content-type'], /^text\/html/);
    assert.ok(body.includes(`href="https://api.example.test/auth/verify?token=${TOKEN}"`), 'the link is in the HTML');
    assert.ok(body.includes('Welcome, Rahim!'));
  });

  test('the display name is escaped, so it cannot add HTML to the email', async () => {
    const { sendVerificationEmail } = createMailer(streamTransporter(), SETTINGS);

    const info = await sendVerificationEmail({
      email: 'new.player@example.org',
      displayName: '<script>alert(1)</script> & "Co"',
      token: TOKEN,
    });
    const { body } = readMessage(info.message);

    assert.ok(body.includes('Welcome, &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;!'));
    assert.ok(!body.includes('<script>'), 'no raw <script> tag');
  });

  test('a Bangla display name survives encoding', async () => {
    const { sendVerificationEmail } = createMailer(streamTransporter(), SETTINGS);

    const info = await sendVerificationEmail({ email: 'new.player@example.org', displayName: 'রহিম', token: TOKEN });

    assert.ok(readMessage(info.message).body.includes('Welcome, রহিম!'));
  });
});

describe('The password reset email, built by nodemailer', () => {
  test('has the right from, to and subject, and the HTML contains the reset link', async () => {
    const { sendResetEmail } = createMailer(streamTransporter(), SETTINGS);

    const info = await sendResetEmail({ email: 'player@example.org', token: TOKEN });
    const { headers, body } = readMessage(info.message);

    assert.equal(headers.from, 'App Support <sender@example.org>'); // nodemailer drops quotes it doesn't need
    assert.equal(headers.to, 'player@example.org');
    assert.equal(headers.subject, 'Password reset request');
    assert.ok(body.includes(`href="https://api.example.test/auth/reset-password-page?token=${TOKEN}"`));
    assert.ok(body.includes('This link expires in 1 hour.'));
  });
});

describe('The sending rules in front of nodemailer', () => {
  // A stand-in transporter that only counts how often it's asked to send.
  const countingTransporter = () => {
    const calls = [];
    return { calls, sendMail: async (options) => calls.push(options) };
  };

  test('@example.com addresses are skipped: nothing reaches the transporter', async () => {
    const transporter = countingTransporter();
    const { sendVerificationEmail } = createMailer(transporter, SETTINGS);

    await sendVerificationEmail({ email: ' Test@Example.com ', displayName: 'Test', token: TOKEN });

    assert.equal(transporter.calls.length, 0);
  });

  test('.invalid addresses fail at once without reaching the transporter', async () => {
    const transporter = countingTransporter();
    const { sendResetEmail } = createMailer(transporter, SETTINGS);

    await assert.rejects(sendResetEmail({ email: 'someone@mail.invalid', token: TOKEN }), /\.invalid address/);
    assert.equal(transporter.calls.length, 0);
  });
});

describe('nodemailer 10 still knows the Gmail shortcut', () => {
  test("service: 'gmail' resolves to Gmail's SMTP server (no connection is made)", () => {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'x@example.org', pass: 'x' } });

    assert.equal(transporter.transporter.options.host, 'smtp.gmail.com');
    assert.equal(transporter.transporter.options.port, 465);
    assert.equal(transporter.transporter.options.secure, true);
  });
});
