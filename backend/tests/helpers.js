// Shared helpers for the backend tests.
//
// Tests talk to the real local server (start it first with `npm run dev`) and the
// real local database. Safety rules:
// - Every test creates its own throwaway user (test-<random>@example.com)
//   and deletes it afterwards, even if the test fails.
// - Existing users are never changed.

import 'dotenv/config';
import { before, after } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

export const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
export const OLD_PASSWORD = 'Old-pass-123!';
export const NEW_PASSWORD = 'New-pass-456!';

export const prisma = new PrismaClient();

before(async () => {
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`Server not reachable at ${BASE_URL}. Start it with "npm run dev" first.`);
  }
});

after(() => prisma.$disconnect());

export const testEmail = () => `test-${crypto.randomUUID()}@example.com`;
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);

// Deletes a user (with their profile, team memberships and the teams they created)
// by email when the test ends, pass or fail.
// Only call it with an email the test made up itself.
export function deleteUserAfter(t, email) {
  t.after(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const ownedTeams = await prisma.team.findMany({ where: { ownerId: user.id }, select: { id: true } });
    const ownedTeamIds = ownedTeams.map((team) => team.id);
    await prisma.teamMember.deleteMany({ where: { OR: [{ userId: user.id }, { teamId: { in: ownedTeamIds } }] } });
    await prisma.team.deleteMany({ where: { id: { in: ownedTeamIds } } });
    await prisma.playerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.ownerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });
}

// Creates a throwaway user directly in the database and registers its deletion.
export async function createTestUser(t, data = {}) {
  const email = testEmail();
  deleteUserAfter(t, email);
  return prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(OLD_PASSWORD, 10),
      role: 'PLAYER',
      ...data,
    },
  });
}

export function postJson(path, body, jwt) {
  return fetch(BASE_URL + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Creates a verified throwaway player and logs them in. Returns { user, jwt }.
export async function createLoggedInPlayer(t) {
  const user = await createTestUser(t, { verified: true });
  const res = await postJson('/auth/login', { email: user.email, password: OLD_PASSWORD });
  if (res.status !== 200) throw new Error(`Login for test user failed with ${res.status}`);
  const { token } = await res.json();
  return { user, jwt: token };
}

// Sends the body exactly as an HTML form would (application/x-www-form-urlencoded).
export function postForm(path, rawBody) {
  return fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: rawBody,
  });
}

export async function passwordIs(userId, password) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return bcrypt.compare(password, user.password);
}
