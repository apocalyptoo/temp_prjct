# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to work with me

- I'm a beginner. After every change, explain what you changed and why in plain language, before I commit.
- Keep changes small: one task per change. Don't refactor unrelated code.
- The existing code was a university project and is not a constraint. When a task touches code that conflicts with `docs/PRODUCT.md`, `docs/DESIGN.md` or `docs/DECISIONS.md`, replace it properly rather than patching around it. Still work task by task, with tests and small commits.
- For bugs: reproduce first, then fix, then prove it's fixed.
- Write or update tests for anything you change in the backend.
- Never commit secrets, `.env` files or database dumps.
- Trust the source code over any documentation, including this file. If you find this file is wrong, tell me and fix it.
- Before starting a task, read `docs/PRODUCT.md`, `docs/ROADMAP.md` and `docs/DECISIONS.md`.
- When behaviour changes, update the relevant docs (this file, `docs/ARCHITECTURE.md`, README, `.env.example`) in the same commit.
- When a roadmap item is done, tick its box in `docs/ROADMAP.md`.
- Don't undo anything recorded in `docs/DECISIONS.md` without asking me.
- Work locally only. Never push, pull, fetch or otherwise interact with GitHub or any remote. If something needs a remote action, stop and tell me exactly what to run. I'll do it myself.
- Do not add any attribution or signature to commit messages (no Co-Authored-By, no "Generated with Claude Code", no session links).
- Don't install or upgrade dependencies, reset the database or run destructive migrations without asking me first.
- Don't invent product behaviour. If something isn't decided in `docs/PRODUCT.md`, stop and ask me, and suggest options with trade-offs.
- Only build features that are in the current release scope in `docs/PRODUCT.md`.
- For any UI work, read `docs/DESIGN.md` first. Never put raw colors, font names or loose sizes in screens; always use theme tokens.

## Docs map

- `docs/PRODUCT.md`: what the app should do, v1.0 and v1.1 scope, business rules and open decisions
- `docs/ROADMAP.md`: the plan and task tracker (phased checklist)
- `docs/DECISIONS.md`: decisions and the reasons behind them
- `docs/ARCHITECTURE.md`: how the app works, in plain English (backend, data model, mobile app)
- `docs/DESIGN.md`: the visual design system (colors, fonts, spacing, components)

## Overview

Indoor football (futsal) management app with three user roles: **PLAYER**, **OWNER** (an indoor field/venue owner), and **ADMIN**. Two independent npm projects live side by side:

- `backend/`: Express 5 REST API (ES modules, `"type": "module"`) + Prisma 6 on PostgreSQL.
- `IndoorFootballApp/`: React Native 0.82 mobile app (plain JS screens; only the template test is TS).

The root `package.json` / `node_modules` are stray leftovers. Install dependencies inside each subproject instead.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx prisma generate          # after any schema.prisma change
npx prisma migrate deploy    # apply migrations; use `npx prisma migrate dev --name <name>` to create one
npm run dev                  # nodemon on src/server.js, port 4000 by default
node scripts/createAdmin.js  # create the ADMIN user, or change its password (reads ADMIN_EMAIL, ADMIN_PASSWORD)
npm test                     # node:test suite in tests/ (needs `npm run dev` running and the local DB)
node --test tests/auth-tokens.test.js   # single test file
```

- **Install scripts (npm 11+):** npm only runs dependency install scripts that are approved in the `allowScripts` field of `backend/package.json`. Approved: `bcrypt` (builds its native code) and the Prisma packages (`prisma`, `@prisma/client`, `@prisma/engines`). `puppeteer` is denied (only the unused diagram tool needs it). Approvals are pinned to exact versions, so after upgrading one of these, or adding a package with an install script, run `npm approve-scripts --allow-scripts-pending` to list what needs a decision. Don't approve anything without asking. The mobile app currently has nothing pending.
- **createAdmin.js** refuses to run if `ADMIN_EMAIL` or `ADMIN_PASSWORD` is missing or the password is weak, and never prints the password. It updates an existing admin with that email, and refuses to promote a non-admin account or to create a second admin.
- **Tests:** backend tests use Node's built-in test runner (`node:test`) and `fetch`, with no extra dependencies. They send real HTTP requests to the running local server and use Prisma directly to set up data. Each test creates its own throwaway user (`test-<uuid>@example.com`) and deletes it in `t.after()`. Shared setup lives in `tests/helpers.js`. Test files run one at a time (`--test-concurrency=1`) because they share the server and database. `authController` never sends mail to `@example.com` addresses (it logs a line instead), so test runs send no real email. Never change existing users in tests. Tokens put straight into the database must be stored as `sha256Hex(token)` (from `tests/helpers.js`), with the plain token sent in the request, like a real email link. Because the server trusts one proxy, `postJson`/`postForm`/`getWithIp` send a random made-up `X-Forwarded-For` address per request, so the suite never trips the rate limits; `tests/rate-limits.test.js` passes a fixed address to hit them. `testFlow.js` is **out of date and fails at the first step** (roadmap Phase 2). Don't rely on it.

Required `backend/.env` variables: `DATABASE_URL`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` (Gmail SMTP via nodemailer), `BACKEND_PUBLIC_URL` (used to build the email verify and reset links), and optionally `PORT`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only needed when running `scripts/createAdmin.js`.

Mobile app (run from `IndoorFootballApp/`):
```bash
npm install
npm start                    # Metro
npm run android              # main target; iOS also needs `bundle install && bundle exec pod install` in ios/
npm run lint                 # ESLint (@react-native config) only; it doesn't check formatting
npx prettier --check src App.js   # Prettier 2.8.8 formatting check (.prettierrc.js), run separately
npm test                     # Jest (react-native preset)
npx jest __tests__/App.test.tsx   # single test file
```

The app talks to the backend through a hardcoded ngrok URL in `src/api/api.js` (React Native doesn't inject `process.env.API_URL`). Update it when the tunnel changes.

## Architecture

A beginner-friendly explanation of the same system lives in `docs/ARCHITECTURE.md`. This section is the technical reference. Keep both in sync when the architecture changes.

### Backend
`src/server.js` mounts five routers: `/auth`, `/players`, `/owners`, `/teams`, `/admin`. Each route file in `src/routes/` maps to a controller with the same name in `src/controllers/`.
- **Auth middleware** (`src/middleware/auth.js`): `verifyToken` decodes a Bearer JWT into `req.user` (`{ id, userId, role, email }`, 7-day expiry). `isAdmin` guards every `/admin` route. `playersOnly` (403 for OWNER and ADMIN) guards team create, invite, accept and reject. Other role and ownership checks happen inside the controllers (for example `team.ownerId !== req.user.id`).
- **Errors:** controllers pass failures on with `next(err)` (Express 5 also forwards errors thrown in async handlers). `src/middleware/errorHandler.js`, mounted last in `server.js`, logs the error and replies only `{ "error": "Something went wrong" }` (500) or `{ "error": "Invalid request body" }` (400 for unreadable bodies). Never put `error.message`, stacks or Prisma details in a response.
- **Security middleware** (in `server.js`): `app.set('trust proxy', 1)` because the backend sits behind exactly one proxy (ngrok), so `req.ip` is the visitor's address; don't raise it. `helmet()` with its default content security policy (server-rendered pages must not use inline scripts or styles). Rate limits in `src/middleware/rateLimits.js`, replying 429, tuned for shared mobile IPs (DECISIONS.md 2026-11-19): login counts only failed attempts (`skipSuccessfulRequests`; `requestWasSuccessful` also treats the 403 "please verify" as success, since the password was right), 10/15 min per IP + email and 50/15 min per IP; register 20/hour per IP; forgot and resend-verification each 5/hour per IP + email and 20/hour per IP; reset POST 10/15 min per IP; reset page and verify link GETs 30/15 min per IP each (HTML replies). Keys always go through express-rate-limit's `ipKeyGenerator` (IPv6 grouped by /56); emails are lowercased and trimmed. Counters are in memory and reset on restart.
- **Prisma**: each controller creates its own `new PrismaClient()`. The schema has no `onDelete: Cascade`, so deletes must first remove dependents by hand: `TeamMember` rows, then the user's owned teams and their members, then profiles, then the `User`. See `adminController.deleteUser` and `teamController.deleteTeam`.
- **Route ordering matters**: in `playerRoutes.js`, `/me` and `/invites` must stay above `/:id`.
- **Registration flow**: `POST /auth/register` creates the `User` and its role-specific profile in one nested create, then emails a verification link (valid 24 hours). Login is refused until `verified` is true. `POST /auth/resend-verification` sends a new link to an unverified account (the login screen shows a button for it after the 403). Password reset sends a link (valid 1 hour) to a server-rendered HTML form at `/auth/reset-password-page`, which POSTs to `/auth/reset`. That is why `express.urlencoded` is enabled.
- **Tokens are stored hashed**: the email link carries the random token; `User.verifyToken` and `User.resetToken` hold only `hashToken(token)` (SHA-256 hex). Always store and look up the hash, require the expiry (`verifyTokenExpires` / `resetTokenExpires`) to be in the future, and clear both token and expiry once used. Check `isWellFormedToken` before any lookup of a token from a URL. Reset and resend have a 5-minute per-account cooldown (`sentRecently`), with an unchanged reply.
- **Never pass raw `req.body` / `req.query` values into Prisma `where` clauses.** Check the type first (e.g. that a token is a non-empty string). Objects like `{"not": ""}` get treated as query operators.
- **Shared helpers in `src/utils/`:** `password.js` (the one strength rule, used by register, reset and `createAdmin.js`), `html.js` (`escapeHtml`: use it for every value inserted into HTML, in emails or server-rendered pages), `tokens.js` (generates verify/reset tokens, checks their format, `hashToken`, link lifetimes and the email cooldown), `emailTemplates.js` (email HTML), `pages.js` (`messagePage` for server-rendered pages, and `isFormRequest`: `/auth/reset` answers HTML to the browser form and JSON to JSON requests). `GET /auth/verify` always answers with HTML pages (it's opened from an email).
- **Login replies** are the same for an unknown email and a wrong password ("Invalid email or password", 400). "Please verify your email" (403) is only returned after the password is correct. An unknown email is still compared against a fixed dummy bcrypt hash, so both cases take about the same time.

### Data model (`prisma/schema.prisma`)
- `User` has an optional `PlayerProfile` (name, phone, position, height/weight) or `OwnerProfile` (indoorName, phone, address, website), chosen by `role`. The display name returned at login comes from `playerProfile.name` or `ownerProfile.indoorName`.
- **"Owner" means two different things.** `Role.OWNER` is an indoor venue owner. `Team.ownerId` is the *player* who created the team, stored as a `TeamMember` with `role: 'captain'` and `status: 'accepted'`. Team "owner-only" actions (invite, remove player, delete team) refer to the team creator, not `Role.OWNER`. `Team.ownerId` will be renamed to `captainId` (planned in `docs/PRODUCT.md`, not done yet).
- `TeamMember.status` is a free-form string. The code only uses `pending` and `accepted`; rejecting an invite deletes the row. Rows are unique on `(teamId, userId)`. Only invites create `pending` rows: `POST /teams/:teamId/join` was removed (it let players accept their own join requests) and gets rebuilt in Phase 4. Accept and reject act only on `pending` rows and return 404 otherwise.
- Validation lives in `authController.register` (the password rule itself is in `src/utils/password.js`): strong passwords, 11-digit phone numbers, height 100–250 cm and weight 30–200 kg. The register screens repeat the phone, height and weight checks but not the password-strength rule. Keep the two sides in sync.

### Mobile app
- `App.js` wraps `AuthProvider` (`src/contexts/AuthContext.js`) around `AppNavigator`. `AppNavigator` switches on `user.role` between `AuthStack`, `PlayerNavigator`, `OwnerNavigator`, and `AdminStack`.
- Player and Owner navigators share a pattern: a bottom-tab navigator (Profile / Settings) nested as the first screen of a native stack, with feature screens pushed onto the stack. Screens are reused across roles (for example `Team/TeamsListScreen` and `Owner/IndoorsListScreen`). Each navigator defines its own route names, so check the right navigator before calling `navigation.navigate`.
- `src/api/api.js` is a shared axios instance that attaches the JWT from AsyncStorage (`src/utils/storage.js`, key `jwt`).

Known bugs and security issues are tracked in `docs/ROADMAP.md`, not here.
