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
node scripts/createAdmin.js  # seed an ADMIN user (verified: true). See the warning below.
```

- **Warning:** `createAdmin.js` currently has a hardcoded admin password. It must read the password from an environment variable instead (roadmap Phase 0/1).
- **Tests:** the backend has no test framework yet (`npm test` is a stub). `testFlow.js` is **out of date and fails at the first step** (roadmap Phase 2). Don't rely on it.

Required `backend/.env` variables: `DATABASE_URL`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` (Gmail SMTP via nodemailer), `BACKEND_PUBLIC_URL` (used to build the email verify and reset links), and optionally `PORT`.

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
- **Auth middleware** (`src/middleware/auth.js`): `verifyToken` decodes a Bearer JWT into `req.user` (`{ id, userId, role, email }`, 7-day expiry). `isAdmin` guards every `/admin` route. Other role and ownership checks happen inside the controllers (for example `team.ownerId !== req.user.id`).
- **Prisma**: each controller creates its own `new PrismaClient()`. The schema has no `onDelete: Cascade`, so deletes must first remove dependents by hand: `TeamMember` rows, then the user's owned teams and their members, then profiles, then the `User`. See `adminController.deleteUser` and `teamController.deleteTeam`.
- **Route ordering matters**: in `playerRoutes.js`, `/me` and `/invites` must stay above `/:id`.
- **Registration flow**: `POST /auth/register` creates the `User` and its role-specific profile in one nested create, then emails a verification link. Login is refused until `verified` is true. Password reset sends a link to a server-rendered HTML form at `/auth/reset-password-page`, which POSTs to `/auth/reset`. That is why `express.urlencoded` is enabled.
- **Never pass raw `req.body` / `req.query` values into Prisma `where` clauses.** Check the type first (e.g. that a token is a non-empty string). Objects like `{"not": ""}` get treated as query operators.

### Data model (`prisma/schema.prisma`)
- `User` has an optional `PlayerProfile` (name, phone, position, height/weight) or `OwnerProfile` (indoorName, phone, address, website), chosen by `role`. The display name returned at login comes from `playerProfile.name` or `ownerProfile.indoorName`.
- **"Owner" means two different things.** `Role.OWNER` is an indoor venue owner. `Team.ownerId` is the *player* who created the team, stored as a `TeamMember` with `role: 'captain'` and `status: 'accepted'`. Team "owner-only" actions (invite, remove player, delete team) refer to the team creator, not `Role.OWNER`. `Team.ownerId` will be renamed to `captainId` (planned in `docs/PRODUCT.md`, not done yet).
- `TeamMember.status` is a free-form string. The code only uses `pending` and `accepted`; rejecting an invite deletes the row. Rows are unique on `(teamId, userId)`. Invites and join requests both create `pending` rows.
- Validation lives in `authController.register`: strong passwords, 11-digit phone numbers, height 100–250 cm and weight 30–200 kg. The register screens repeat the phone, height and weight checks but not the password-strength rule. Keep the two sides in sync.

### Mobile app
- `App.js` wraps `AuthProvider` (`src/contexts/AuthContext.js`) around `AppNavigator`. `AppNavigator` switches on `user.role` between `AuthStack`, `PlayerNavigator`, `OwnerNavigator`, and `AdminStack`.
- Player and Owner navigators share a pattern: a bottom-tab navigator (Profile / Settings) nested as the first screen of a native stack, with feature screens pushed onto the stack. Screens are reused across roles (for example `Team/TeamsListScreen` and `Owner/IndoorsListScreen`). Each navigator defines its own route names, so check the right navigator before calling `navigation.navigate`.
- `src/api/api.js` is a shared axios instance that attaches the JWT from AsyncStorage (`src/utils/storage.js`, key `jwt`).

Known bugs and security issues are tracked in `docs/ROADMAP.md`, not here.
