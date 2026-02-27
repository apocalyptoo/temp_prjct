import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take messages!");
  }
});

// REGISTER
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');

  
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: 'PLAYER', verifyToken: token },
    });


    const verifyLink = `${process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;

    transporter.sendMail({
      from: `"App Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email address',
      html: `
        <h2>Welcome, ${name}!</h2>
        <p>Please verify your email by clicking below:</p>
        <a href="${verifyLink}" target="_blank" style="padding:10px 20px;background:#007BFF;color:white;text-decoration:none;border-radius:5px;">Verify Email</a>
      `,
    }).catch(err => console.error('Email send failed:', err));
    
  

    res.status(201).json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  const { token } = req.query;
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
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid email' });

    if (!user.verified) return res.status(403).json({ error: 'Please verify your email before logging in.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect Password!' });

    const token = jwt.sign(
      { id: user.id, userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, name: user.name,email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// REQUEST PASSWORD RESET
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link was sent.' });   //hide existance of email
    }

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: expires },
      });
        
      //const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      const resetLink = `${process.env.BACKEND_PUBLIC_URL}/auth/reset-password-page?token=${token}`;
      await transporter.sendMail({
        from: `"App Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password reset request',
        html: `
          <p>Click to reset your password:</p>
          <a href="${resetLink}">Reset password</a>
          <p>This link expires in 1 hour.</p>
        `,
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
