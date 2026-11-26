// scripts/seedDevAccounts.js
//
// DEVELOPMENT ONLY, LOCAL DATABASE ONLY, TEMPORARY. Creates four test accounts with
// weak passwords for the app's dev-only "Quick login" buttons (src/screens/Dev/
// QuickLogin.js in the app). Before release they're removed with --remove (ROADMAP.md,
// Phase 5).
//
//   Player A     email "aa", password "aa"  (Forward, Mirpur)
//   Player B     email "ab", password "ab"  (Goalkeeper, Dhanmondi)
//   Venue owner  email "bb", password "bb"  ("Test Venue", live)
//   Dev admin    email "ad", password "ad"  (a second ADMIN account, for testing only)
//
// Run from backend/:
//   node scripts/seedDevAccounts.js           create the accounts, or reset them: the
//                                             password, verified, the venue live again;
//                                             their teams and other data stay
//   node scripts/seedDevAccounts.js --fresh   the same, after removing their teams,
//                                             memberships and notifications
//   node scripts/seedDevAccounts.js --remove  delete all four accounts and their data
//
// It refuses to run unless DATABASE_URL points to localhost or 127.0.0.1. It never
// touches the real admin account (scripts/createAdmin.js) or any other account, and it
// never prints the database URL or a password.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { deleteTeamAndMembers } from '../src/utils/deletion.js';
import { lockTeams } from '../src/utils/membership.js';

const ACCOUNTS = [
  {
    label: 'Player A',
    email: 'aa',
    password: 'aa',
    role: 'PLAYER',
    player: { name: 'Player A', phone: '01700000101', position: 'Forward', area: 'Mirpur' },
  },
  {
    label: 'Player B',
    email: 'ab',
    password: 'ab',
    role: 'PLAYER',
    player: { name: 'Player B', phone: '01700000102', position: 'Goalkeeper', area: 'Dhanmondi' },
  },
  {
    label: 'Venue owner',
    email: 'bb',
    password: 'bb',
    role: 'OWNER',
    venue: { indoorName: 'Test Venue', phone: '01800000103', address: 'House 1, Road 1, Dhanmondi', area: 'Dhanmondi' },
  },
  { label: 'Dev admin', email: 'ad', password: 'ad', role: 'ADMIN' },
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const USAGE = 'Usage: node scripts/seedDevAccounts.js [--fresh | --remove]';

class Refusal extends Error {}

// The host part of DATABASE_URL, or null when it isn't a URL.
function databaseHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function checkLocalDatabase() {
  const host = databaseHost(process.env.DATABASE_URL ?? '');
  if (!LOCAL_HOSTS.has(host)) {
    throw new Refusal(
      "DATABASE_URL doesn't point to localhost or 127.0.0.1. These test accounts have " +
        'weak passwords and must never exist on a real server, so this script only runs ' +
        'against a local database. Nothing was changed.'
    );
  }
}

function readMode(args) {
  const known = new Set(['--fresh', '--remove']);
  const unknown = args.filter((arg) => !known.has(arg));
  if (unknown.length > 0) throw new Refusal(`unknown option ${unknown.join(' ')}. ${USAGE}`);
  if (args.includes('--fresh') && args.includes('--remove')) {
    throw new Refusal(`--fresh and --remove can't be used together. ${USAGE}`);
  }
  if (args.includes('--remove')) return 'remove';
  return args.includes('--fresh') ? 'fresh' : 'seed';
}

// The four accounts as they are now (missing ones left out). An email taken by an account
// of another role stops everything before any change: it isn't one of ours.
async function findAccounts(prisma) {
  const users = await prisma.user.findMany({
    where: { email: { in: ACCOUNTS.map((account) => account.email) } },
    include: { playerProfile: true, ownerProfile: true },
  });
  const byEmail = new Map(users.map((user) => [user.email, user]));
  for (const account of ACCOUNTS) {
    const user = byEmail.get(account.email);
    if (user && user.role !== account.role) {
      throw new Refusal(
        `"${account.email}" belongs to a ${user.role} account, not a ${account.role} one. ` +
          'It was left alone. Nothing was changed.'
      );
    }
  }
  return ACCOUNTS.map((account) => ({ account, user: byEmail.get(account.email) ?? null }));
}

// ── Creating and resetting ──

// A venue the admin could approve and players can find: complete and live.
const liveVenue = (venue, existing = null) => ({
  indoorName: existing?.indoorName ?? venue.indoorName,
  phone: existing?.phone ?? venue.phone,
  address: existing?.address ?? venue.address,
  area: existing?.area ?? venue.area,
  approvedAt: existing?.approvedAt ?? new Date(),
  reviewNote: null,
});

async function createAccount(prisma, account) {
  const user = await prisma.user.create({
    data: {
      email: account.email,
      password: await bcrypt.hash(account.password, 10),
      role: account.role,
      verified: true,
      termsAcceptedAt: new Date(),
      ...(account.player ? { playerProfile: { create: account.player } } : {}),
      ...(account.venue ? { ownerProfile: { create: liveVenue(account.venue) } } : {}),
    },
  });
  console.log(`Created ${account.label} ("${account.email}", id=${user.id}).`);
}

// The password back to the test one, verified, no pending email links, the venue live
// again. A changed password logs the account out everywhere (tokenVersion), like any
// password reset; an unchanged one keeps existing logins.
async function resetAccount(prisma, account, user) {
  const changes = [];
  const data = {
    verified: true,
    verifyToken: null,
    verifyTokenExpires: null,
    resetToken: null,
    resetTokenExpires: null,
    termsAcceptedAt: user.termsAcceptedAt ?? new Date(),
  };
  if (!(await bcrypt.compare(account.password, user.password))) {
    data.password = await bcrypt.hash(account.password, 10);
    data.tokenVersion = { increment: 1 };
    changes.push('password reset');
  }
  if (!user.verified) changes.push('verified');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data });
    if (account.player && !user.playerProfile) {
      await tx.playerProfile.create({ data: { ...account.player, userId: user.id } });
      changes.push('profile added');
    }
    if (account.venue) {
      const venue = liveVenue(account.venue, user.ownerProfile);
      if (user.ownerProfile) {
        await tx.ownerProfile.update({ where: { userId: user.id }, data: venue });
        if (!user.ownerProfile.approvedAt) changes.push('venue live again');
      } else {
        await tx.ownerProfile.create({ data: { ...venue, userId: user.id } });
        changes.push('venue added');
      }
    }
  });
  const what = changes.length > 0 ? changes.join(', ') : 'nothing needed changing';
  console.log(`Reset ${account.label} ("${account.email}", id=${user.id}): ${what}.`);
}

async function seed(prisma) {
  for (const { account, user } of await findAccounts(prisma)) {
    if (user) await resetAccount(prisma, account, user);
    else await createAccount(prisma, account);
  }
}

// ── --fresh: their teams, memberships and notifications ──

async function clearData(prisma) {
  const ids = (await findAccounts(prisma)).filter(({ user }) => user).map(({ user }) => user.id);
  if (ids.length === 0) return;

  // Teams they captain: the shared team deletion, under the team lock. Other members
  // (anyone who isn't a test account) are told, as when a captain deletes a team.
  const teams = await prisma.team.findMany({ where: { captainId: { in: ids } }, select: { id: true, captainId: true } });
  for (const team of teams) await deleteTeamAndMembers(prisma, team.id, { actorId: team.captainId });

  // Their rows in other people's teams (members, invites, requests), under those teams'
  // locks, like every other membership change.
  const memberships = await prisma.$transaction(async (tx) => {
    const rows = await tx.teamMember.findMany({ where: { userId: { in: ids } }, select: { teamId: true } });
    await lockTeams(tx, [...new Set(rows.map((row) => row.teamId))]);
    return (await tx.teamMember.deleteMany({ where: { userId: { in: ids } } })).count;
  });

  // Their own updates (not the ones other people keep).
  const notifications = (await prisma.notification.deleteMany({ where: { userId: { in: ids } } })).count;

  console.log(
    `Fresh start: removed ${teams.length} team(s) they captained, ${memberships} other membership(s) ` +
      `and ${notifications} notification(s) of theirs.`
  );
}

// ── --remove ──

async function removeAll(prisma) {
  // Loaded only here: the shared account deletion sends emails, so it reads the server's
  // settings (src/config.js). The notice email is switched off: these addresses are fake.
  const { deleteAccountAndNotify } = await import('../src/utils/accountDeletion.js');
  const noEmail = { sendNotice: async () => {} };

  for (const { account, user } of await findAccounts(prisma)) {
    if (!user) {
      console.log(`${account.label} ("${account.email}"): not there, nothing to remove.`);
      continue;
    }
    if (account.role === 'ADMIN') {
      // The shared deletion never deletes an ADMIN account (account deletion spec P5). The
      // dev admin has no profile, teams or memberships; its updates go with it.
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { userId: user.id } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);
    } else {
      // The same deletion as "Delete account": teams handed over or deleted, people told.
      const { status } = await deleteAccountAndNotify(prisma, user.id, {}, noEmail);
      if (status !== 'deleted' && status !== 'gone') {
        throw new Error(`couldn't remove ${account.label} (${status}). Run it again.`);
      }
    }
    console.log(`Removed ${account.label} ("${account.email}", id=${user.id}) and its data.`);
  }
}

async function main(prisma) {
  const mode = readMode(process.argv.slice(2));
  checkLocalDatabase();
  if (mode === 'remove') return removeAll(prisma);
  if (mode === 'fresh') await clearData(prisma);
  return seed(prisma);
}

const prisma = new PrismaClient();
main(prisma)
  .catch((error) => {
    // Never the URL: Prisma's own errors are reduced to their first line, which names
    // the problem without the connection string.
    const message = error instanceof Refusal ? error.message : String(error.message).split('\n')[0];
    console.error(`seedDevAccounts: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
