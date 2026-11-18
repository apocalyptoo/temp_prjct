// scripts/createAdmin.js
//
// Creates the admin account, or changes its password if it already exists.
// Run from backend/:  node scripts/createAdmin.js
//
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from backend/.env (or the environment).
// The password must pass the same strength rule as registration.
// The password is never printed.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../src/utils/password.js';

function refuse(message) {
  console.error(`createAdmin: ${message}`);
  process.exitCode = 1;
}

async function main(prisma) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  const missing = [!email && 'ADMIN_EMAIL', !password && 'ADMIN_PASSWORD'].filter(Boolean);
  if (missing.length > 0) {
    return refuse(`missing ${missing.join(' and ')} in backend/.env. Nothing was changed.`);
  }
  if (!isStrongPassword(password)) {
    return refuse(`ADMIN_PASSWORD is too weak. ${PASSWORD_RULE_MESSAGE} Nothing was changed.`);
  }

  const hashed = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      return refuse(`${email} belongs to a ${existing.role} account. This script won't turn it into an admin. Nothing was changed.`);
    }
    await prisma.user.update({
      where: { id: existing.id },
      // Changing the password also cancels any pending reset link.
      data: { password: hashed, verified: true, resetToken: null, resetTokenExpires: null },
    });
    console.log(`Updated the password of admin ${email} (id=${existing.id}).`);
    return;
  }

  // The app has one admin account (docs/PRODUCT.md). Refuse to quietly create a second
  // one, for example because of a typo in ADMIN_EMAIL.
  const otherAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (otherAdmin) {
    return refuse(
      `an admin account already exists (id=${otherAdmin.id}) with a different email. ` +
        'Set ADMIN_EMAIL to that account\'s email to change its password. Nothing was changed.'
    );
  }

  const user = await prisma.user.create({
    data: { email, password: hashed, role: 'ADMIN', verified: true },
  });
  console.log(`Created admin ${user.email} (id=${user.id}).`);
}

const prisma = new PrismaClient();
main(prisma)
  .catch((error) => {
    console.error('createAdmin failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
