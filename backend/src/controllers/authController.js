import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { INVALID_LOGIN, INVALID_RESET_LINK } from '../validation/authSchemas.js';
import {
  generateToken,
  hashToken,
  isWellFormedToken,
  sentRecently,
  LOGIN_TOKEN_LIFETIME_SECONDS,
  RESET_LINK_LIFETIME_MS,
  VERIFY_LINK_LIFETIME_MS,
} from '../utils/tokens.js';
import { mailer, checkMailConnection } from '../utils/mailer.js';
import { isFormRequest, messagePage } from '../utils/pages.js';
import { toVisibleUser } from '../utils/visibility.js';

// Account emails go through src/utils/mailer.js (Gmail SMTP; @example.com skipped,
// .invalid refused). This file loads when the server starts, so this checks the Gmail
// login once at startup and logs the result.
const { sendVerificationEmail, sendResetEmail } = mailer;
checkMailConnection();

// Every request body and query is checked by its schema in src/validation/authSchemas.js
// before these handlers run (see authRoutes.js). The handlers read only req.valid.
//
// INVALID_LOGIN is the same reply for an unknown email and a wrong password (and any
// badly shaped login request), so nobody can use login to find out which emails have accounts.

// A fixed hash to compare against when the email doesn't exist, so an unknown email
// takes as long as a wrong password (bcrypt is deliberately slow). Same cost (10) as
// real password hashes. Nothing can log in with it: there's no user to log in as.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-timing-placeholder', 10);

// REGISTER
export const register = async (req, res, next) => {
  // Already checked and cleaned by registerSchema (src/validation/authSchemas.js): the
  // email is normalised, the role is PLAYER or OWNER, the password passes the strength
  // rule, and profileData has only the fields of that role, with the right types.
  const { email, password, role, name, profileData } = req.valid.body;

  try {
    // 1) Check if email exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 2) Hash password + generate verify token (the database keeps only its hash)
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = generateToken();

    // 3) Create User + Profile atomically (single Prisma create is atomic)
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
                  height: profileData.height, // a number or null
                  weight: profileData.weight, // a number or null
                  address: profileData.address, // text or null
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
                  description: profileData.description, // text or null
                  website: profileData.website, // text or null
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

    // 4) Send verification email (use a friendly display name)
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
// This link is opened from an email in a browser, so it answers with simple pages.
// Nothing from the link is put into the page. Also used by authRoutes.js when the
// token isn't shaped like the ones the server makes (missing, repeated, odd).
export const sendInvalidVerifyLinkPage = (req, res) =>
  res.status(400).send(
    messagePage({
      title: 'Invalid or expired link',
      message:
        'This verification link is invalid or has expired. If you have already verified your email, you can log in in the app. ' +
        "Otherwise, you can request a new verification email from the app's login screen.",
    })
  );

export const verifyEmail = async (req, res, next) => {
  // A well-formed token (64 lowercase hex characters), checked by emailLinkQuerySchema.
  const { token } = req.valid.query;
  const invalidLinkPage = () => sendInvalidVerifyLinkPage(req, res);
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
  // loginSchema has checked these are non-empty strings (the email normalised). Anything
  // else already got INVALID_LOGIN: an object email would be read as a query operator
  // by Prisma, and a non-string password makes bcrypt crash.
  const { email, password } = req.valid.body;
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

    // Valid for 30 days. `tv` is the account's current tokenVersion: verifyToken refuses
    // the token once that number has been increased (for example by a password reset).
    const token = jwt.sign(
      { id: user.id, userId: user.id, role: user.role, email: user.email, tv: user.tokenVersion },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: LOGIN_TOKEN_LIFETIME_SECONDS }
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

// CURRENT USER (GET /auth/me, logged-in users only)
// The app calls this at start-up with its saved token to find out who is logged in.
// Same details as the login reply, plus `verified`. verifyToken has already refused a
// token for an account that no longer exists (401, so the app logs out). The check below
// only covers an account deleted between that lookup and this one.
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        verified: true,
        playerProfile: { select: { name: true } },
        ownerProfile: { select: { indoorName: true } },
      },
    });
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const name = user.role === 'PLAYER' ? user.playerProfile?.name : user.ownerProfile?.indoorName;
    return res.json(
      toVisibleUser(
        { id: user.id, name, email: user.email, role: user.role, verified: user.verified },
        { id: req.user.id, role: req.user.role }
      )
    );
  } catch (err) {
    return next(err);
  }
};

// REQUEST PASSWORD RESET
export const requestPasswordReset = async (req, res, next) => {
  // A non-empty string, normalised (emailOnlySchema). Anything else already got
  // "Email is required": an object would be read as a query operator by Prisma.
  const { email } = req.valid.body;
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
        
      await sendResetEmail({ email, token }).catch((err) => console.error('Reset email failed:', err));

    return res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    return next(err);
  }
};

// RESET PASSWORD

// The reply when a reset fails. The reset page in a browser posts form data and gets
// HTML pages back; the app and the tests post JSON and keep getting JSON.
// A problem the user can fix on the same form (like a weak password) gets a link back
// to it. A bad or expired link can't be fixed there: they need a new reset email.
// Also used by authRoutes.js when resetSchema finds a problem, so those replies match.
export const sendResetFailure = (req, res, message) => {
  if (!isFormRequest(req)) return res.status(400).json({ error: message });
  const token = req.body?.token; // raw: only used if it's a well-formed token
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

export const resetPassword = async (req, res, next) => {
  // Checked by resetSchema: both present, the token is a string (an object like
  // {"not": ""} or token[not]= from the form would be a query operator), and the new
  // password passes the shared strength rule and the 72-byte limit.
  const { token, password } = req.valid.body;
  const fromForm = isFormRequest(req);
  const fail = (message) => sendResetFailure(req, res, message);

  try {
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
        // Logs the account out on every device, in the same update as the new password:
        // a reset often means the old password leaked (DECISIONS.md 2026-11-20).
        tokenVersion: { increment: 1 },
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
  // A non-empty string, normalised (emailOnlySchema). Anything else already got
  // "Email is required": an object would be read as a query operator by Prisma.
  const { email } = req.valid.body;
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
