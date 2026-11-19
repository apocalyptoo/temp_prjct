import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password.js';
import {
  generateToken,
  hashToken,
  isWellFormedToken,
  sentRecently,
  RESET_LINK_LIFETIME_MS,
  VERIFY_LINK_LIFETIME_MS,
} from '../utils/tokens.js';
import { verifyEmailHtml, resetEmailHtml } from '../utils/emailTemplates.js';
import { isFormRequest, messagePage } from '../utils/pages.js';
import { toVisibleUser } from '../utils/visibility.js';
import { normalizeEmail } from '../utils/email.js';
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Sends an email, except to @example.com addresses. example.com is reserved and can
// never receive mail, so those are skipped (the tests use it for throwaway users).
// The log line shows only the recipient and subject, never tokens or links.
const sendMail = (options) => {
  const to = normalizeEmail(options.to) ?? '';
  if (to.endsWith('@example.com')) {
    console.log(`Email skipped (example.com): to=${options.to} subject="${options.subject}"`);
    return Promise.resolve();
  }
  // .invalid is a reserved top-level domain that can never receive mail, so fail at once
  // instead of handing it to Gmail. (The tests use it to make sending fail on purpose.)
  if (to.endsWith('.invalid')) {
    return Promise.reject(new Error(`Can't send email to a .invalid address (to=${options.to})`));
  }
  return transporter.sendMail(options);
};

transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take messages!");
  }
});

// Same reply for an unknown email and a wrong password, so nobody can use login
// to find out which emails have accounts.
const INVALID_LOGIN = 'Invalid email or password';

const INVALID_RESET_LINK = 'Invalid or expired token';

// A fixed hash to compare against when the email doesn't exist, so an unknown email
// takes as long as a wrong password (bcrypt is deliberately slow). Same cost (10) as
// real password hashes. Nothing can log in with it: there's no user to log in as.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-timing-placeholder', 10);

// The verification email. `token` is the plain token: it goes only into the link,
// never into the database.
const sendVerificationEmail = ({ email, displayName, token }) =>
  sendMail({
    from: `"App Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your email address',
    html: verifyEmailHtml({
      displayName,
      verifyLink: `${process.env.BACKEND_PUBLIC_URL}/auth/verify?token=${token}`,
    }),
  });

// REGISTER
export const register = async (req, res, next) => {
  const { name, password, role, profileData } = req.body;
  // Lowercased and trimmed (null if not a non-empty string, so an object email like
  // {"not": ""} never reaches Prisma).
  const email = normalizeEmail(req.body.email);

  try {
    // 1) Validate required fields
    if (!email || !password || !role || !profileData) {
      return res.status(400).json({
        error: 'Email, password, role, and profileData are required',
      });
    }

    // 2) Validate role
    if (!['PLAYER', 'OWNER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected' });
    }

    // 3) Validate password strength (shared rule; also rejects non-string passwords)
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }

    // 4) Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 5) Role-based profile validation
    if (role === 'PLAYER') {
      // You said PlayerProfile.name should always equal "name" passed
      if (!name) return res.status(400).json({ error: 'Name is required for PLAYER' });

      const { phone, position, height, weight, address } = profileData;

      if (!phone || !position) {
        return res.status(400).json({
          error: 'PLAYER profile requires phone and position',
        });
      }
      if (!/^\d{11}$/.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be exactly 11 digits' });
      }
      if (height !== null && height !== undefined) {
        const h = Number(height);
        if (isNaN(h) || h < 100 || h > 250) {
          return res.status(400).json({ error: 'Height must be between 100 and 250 cm' });
        }
      }
      if (weight !== null && weight !== undefined) {
        const w = Number(weight);
        if (isNaN(w) || w < 30 || w > 200) {
          return res.status(400).json({ error: 'Weight must be between 30 and 200 kg' });
        }
      }
    }

    if (role === 'OWNER') {
      const { indoorName, phone, address, description, website } = profileData;

      if (!indoorName || !phone || !address) {
        return res.status(400).json({
          error: 'OWNER profile requires indoorName, phone, and address',
        });
      }
      if (!/^\d{11}$/.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be exactly 11 digits' });
      }
    }

    // 6) Hash password + generate verify token (the database keeps only its hash)
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = generateToken();

    // 7) Create User + Profile atomically (single Prisma create is atomic)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        verifyToken: hashToken(verifyToken),
        verifyTokenExpires: new Date(Date.now() + VERIFY_LINK_LIFETIME_MS),

        ...(role === 'PLAYER'
          ? {
              playerProfile: {
                create: {
                  name, // stored in PlayerProfile.name
                  phone: profileData.phone,
                  position: profileData.position,
                  height:
                    profileData.height === null || profileData.height === undefined
                      ? null
                      : Number(profileData.height),
                  weight:
                    profileData.weight === null || profileData.weight === undefined
                      ? null
                      : Number(profileData.weight),
                  address: profileData.address || null,
                },
              },
            }
          : {}),

        ...(role === 'OWNER'
          ? {
              ownerProfile: {
                create: {
                  indoorName: profileData.indoorName, // stored in OwnerProfile.indoorName
                  phone: profileData.phone,
                  address: profileData.address,
                  description: profileData.description || null,
                  website: profileData.website || null,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // 8) Send verification email (use a friendly display name)
    const displayName =
      role === 'PLAYER' ? name : profileData.indoorName;

    // The account exists now whatever happens to the email. If sending fails, still
    // reply success, and point to "Resend verification email" (instead of a 500 that
    // makes the user think the sign-up failed, then hit "Email already registered").
    try {
      await sendVerificationEmail({ email, displayName, token: verifyToken });
    } catch (mailError) {
      console.error(`Verification email failed for new user ${user.id}:`, mailError);
      return res.status(201).json({
        message:
          "Account created, but we couldn't send the verification email. Use 'Resend verification email' on the login screen.",
        userId: user.id,
      });
    }

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    });
  } catch (err) {
    return next(err);
  }
};
// VERIFY EMAIL
export const verifyEmail = async (req, res, next) => {
  const { token } = req.query;

  // This link is opened from an email in a browser, so it answers with simple pages.
  // Nothing from the link is put into the page.
  const invalidLinkPage = () =>
    res.status(400).send(
      messagePage({
        title: 'Invalid or expired link',
        message:
          'This verification link is invalid or has expired. If you have already verified your email, you can log in in the app. ' +
          "Otherwise, you can request a new verification email from the app's login screen.",
      })
    );

  // Only a token shaped like the ones the server makes (64 lowercase hex characters)
  // goes any further. This also stops missing tokens, arrays and objects, which would
  // otherwise change the database query.
  if (!isWellFormedToken(token)) return invalidLinkPage();
  try {
    // The database holds the token's hash, and the link must be less than 24 hours old.
    const user = await prisma.user.findFirst({
      where: { verifyToken: hashToken(token), verifyTokenExpires: { gt: new Date() } },
    });
    if (!user) return invalidLinkPage();

    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, verifyToken: null, verifyTokenExpires: null },
    });

    res.send(messagePage({ title: 'Email verified', message: 'Your email is verified. You can now log in in the app.' }));
  } catch (err) {
    return next(err);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  // Only non-empty strings may go further: an object email would be read as a query
  // operator by Prisma, and a non-string password makes bcrypt crash.
  if (!email || typeof password !== 'string' || password === '') {
    return res.status(400).json({ error: INVALID_LOGIN });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
      playerProfile: true,
      ownerProfile: true,
      },
     });

    // Unknown email and wrong password get the identical reply (INVALID_LOGIN, 400), and
    // take about the same time: with no user, compare against the dummy hash anyway.
    const match = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
    if (!user || !match) return res.status(400).json({ error: INVALID_LOGIN });

    // Only someone who knows the password learns that the account isn't verified yet.
    if (!user.verified) return res.status(403).json({ error: 'Please verify your email before logging in.' });

    const token = jwt.sign(
      { id: user.id, userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const displayName =
      user.role === 'PLAYER'
        ? user.playerProfile?.name
        : user.ownerProfile?.indoorName;

    // Your own details, through the same visibility rules as every other response.
    res.json({
      token,
      user: toVisibleUser(
        { id: user.id, name: displayName, email: user.email, role: user.role },
        { id: user.id, role: user.role }
      ),
    });
  } catch (err) {
    return next(err);
  }
};

// REQUEST PASSWORD RESET
export const requestPasswordReset = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  // Only a non-empty string may reach Prisma (an object would be read as a query operator).
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link was sent.' });   //hide existance of email
    }

      // Cooldown: if a reset email went to this account less than 5 minutes ago, send
      // nothing new and keep the earlier link. The reply stays exactly the same.
      if (sentRecently(user.resetTokenExpires, RESET_LINK_LIFETIME_MS)) {
        return res.json({ message: 'If that email exists, a reset link was sent.' });
      }

      const token = generateToken();
      const expires = new Date(Date.now() + RESET_LINK_LIFETIME_MS); // 1 hour
        
      // The database keeps only the token's hash; the email link carries the token.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashToken(token), resetTokenExpires: expires },
      });
        
      //const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      const resetLink = `${process.env.BACKEND_PUBLIC_URL}/auth/reset-password-page?token=${token}`;
      await sendMail({
        from: `"App Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password reset request',
        html: resetEmailHtml({ resetLink }),
      }).catch(err => console.error('Reset email failed:', err));

    return res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    return next(err);
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  // The reset page in a browser posts form data and gets HTML pages back. The app and
  // the tests post JSON and keep getting JSON.
  const fromForm = isFormRequest(req);

  // A problem the user can fix on the same form (like a weak password) gets a link back
  // to it. A bad or expired link can't be fixed there: they need a new reset email.
  const fail = (message) => {
    if (!fromForm) return res.status(400).json({ error: message });
    const canRetry = isWellFormedToken(token) && message !== INVALID_RESET_LINK;
    return res.status(400).send(
      messagePage({
        title: 'Password not changed',
        message: canRetry ? message : `${message}. Please request a new password reset from the app.`,
        link: canRetry
          ? { href: `/auth/reset-password-page?token=${encodeURIComponent(token)}`, text: 'Try again' }
          : undefined,
      })
    );
  };

  try {
    if (!token || !password) return fail('Token and new password required');
    // Only a string may reach Prisma. An object like {"not": ""} (or token[not]= from
    // the HTML form) would be treated as a query operator and match someone else's token.
    if (typeof token !== 'string') return fail(INVALID_RESET_LINK);
    // Same strength rule as registration (shared function; also rejects non-strings).
    if (!isStrongPassword(password)) return fail(PASSWORD_RULE_MESSAGE);

    // The database holds the token's hash, so look up the hash of what the link carried.
    const user = await prisma.user.findFirst({
      where: { resetToken: hashToken(token), resetTokenExpires: { gt: new Date() } },
    });
    if (!user) return fail(INVALID_RESET_LINK);

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      // The reset proves the email works, so it also marks the account verified and
      // clears any leftover verification link.
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpires: null,
        verified: true,
        verifyToken: null,
        verifyTokenExpires: null,
      },
    });

    if (fromForm) {
      return res.send(
        messagePage({
          title: 'Password changed',
          message: 'Your password has been reset. You can now log in to the app with your new password.',
        })
      );
    }
    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    return next(err);
  }
};


// RESEND VERIFICATION EMAIL
// Always the same reply, whether the account exists, is already verified, or is in the
// cooldown, so the reply never reveals anything about an email address.
const RESEND_REPLY = { message: "If that account needs verifying, we've sent a new email." };

export const resendVerification = async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  // Only a non-empty string may reach Prisma (an object would be read as a query operator).
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { playerProfile: true, ownerProfile: true },
    });
    if (!user || user.verified) return res.json(RESEND_REPLY);

    // Cooldown: if a verification email went out less than 5 minutes ago, send nothing
    // new. The earlier link still works.
    if (sentRecently(user.verifyTokenExpires, VERIFY_LINK_LIFETIME_MS)) return res.json(RESEND_REPLY);

    // A new link replaces the old one (only the newest link works).
    const token = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: hashToken(token), verifyTokenExpires: new Date(Date.now() + VERIFY_LINK_LIFETIME_MS) },
    });

    const displayName = user.playerProfile?.name ?? user.ownerProfile?.indoorName ?? 'there';
    await sendVerificationEmail({ email: user.email, displayName, token }).catch((err) =>
      console.error('Verification email failed:', err)
    );

    return res.json(RESEND_REPLY);
  } catch (err) {
    return next(err);
  }
};
