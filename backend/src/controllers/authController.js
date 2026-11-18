import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password.js';
import { generateToken } from '../utils/tokens.js';
import { verifyEmailHtml, resetEmailHtml } from '../utils/emailTemplates.js';
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
  if (String(options.to).toLowerCase().endsWith('@example.com')) {
    console.log(`Email skipped (example.com): to=${options.to} subject="${options.subject}"`);
    return Promise.resolve();
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

// REGISTER
export const register = async (req, res) => {
  const { name, email, password, role, profileData } = req.body;

  try {
    // 1) Validate required fields
    // typeof check: an object email like {"not": ""} must never reach Prisma.
    if (typeof email !== 'string' || !email || !password || !role || !profileData) {
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

    // 6) Hash password + generate verify token
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = generateToken();

    // 7) Create User + Profile atomically (single Prisma create is atomic)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        verifyToken,

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

    const verifyLink = `${process.env.BACKEND_PUBLIC_URL}/auth/verify?token=${verifyToken}`;

    await sendMail({
      from: `"App Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email address',
      html: verifyEmailHtml({ displayName, verifyLink }),
    });

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
// VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  const { token } = req.query;
  // Only a non-empty string may reach Prisma. A missing token would mean "no filter"
  // (matching any user), and arrays or objects would break or change the query.
  if (typeof token !== 'string' || token === '') {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  try {
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });   //checks if token is present in table
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, verifyToken: null },
    });

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// LOGIN
export const login = async (req, res) => {
  const { email, password } = req.body;
  // Only non-empty strings may go further: an object email would be read as a query
  // operator by Prisma, and a non-string password makes bcrypt crash.
  if (typeof email !== 'string' || email === '' || typeof password !== 'string' || password === '') {
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

    // Unknown email and wrong password get the identical reply (INVALID_LOGIN, 400).
    const match = user ? await bcrypt.compare(password, user.password) : false;
    if (!match) return res.status(400).json({ error: INVALID_LOGIN });

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

    res.json({
      token,
      user: {
        id: user.id,
        name: displayName,
        email: user.email,
        role: user.role,
  },
});
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// REQUEST PASSWORD RESET
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  // Only a non-empty string may reach Prisma (an object would be read as a query operator).
  if (typeof email !== 'string' || email === '') {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link was sent.' });   //hide existance of email
    }

      const token = generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: expires },
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
    console.error('requestPasswordReset error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
    // Only a string may reach Prisma. An object like {"not": ""} (or token[not]= from
    // the HTML form) would be treated as a query operator and match someone else's token.
    if (typeof token !== 'string') return res.status(400).json({ error: 'Invalid or expired token' });
    // Same strength rule as registration (shared function; also rejects non-strings).
    if (!isStrongPassword(password)) return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpires: null, verified: true },
    });

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

