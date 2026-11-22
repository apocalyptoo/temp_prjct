# CLAUDE.md

Guidance for Claude Code in this repository. Kept short on purpose: it's loaded in every session. The technical detail lives in `docs/ARCHITECTURE.md` section 10.

## How to work with me

- I'm a beginner. After every change, explain what you changed and why in plain language, before I commit.
- Keep changes small: one task per change. Don't refactor unrelated code.
- The old code (a university project) is not a constraint: where a task touches code that conflicts with `docs/PRODUCT.md`, `docs/DESIGN.md` or `docs/DECISIONS.md`, replace it properly. Still task by task, with tests and small commits.
- Bugs: reproduce first, then fix, then prove it's fixed.
- Write or update tests for anything you change in the backend.
- Don't use adb or the emulator yourself; I check the app by hand. For app changes, give me a short numbered checklist instead (what to tap, what to type, what I should see) before asking to commit, and say when I need to reload or rebuild.
- Never commit secrets, `.env` files or database dumps.
- Trust the source code over any documentation, this file included. If this file is wrong, tell me and fix it.
- Read the task's feature spec (if there is one). Look up other docs by section, using the spec's links or by searching headings; read whole docs when the task needs them.
- When behaviour changes, update the relevant docs (this file, `docs/ARCHITECTURE.md`, README, `.env.example`) in the same commit.
- When a roadmap item is done, tick its box in `docs/ROADMAP.md`.
- Don't undo anything in `docs/DECISIONS.md` without asking me.
- Work locally only: never push, pull, fetch or touch GitHub or any remote. If something needs a remote action, stop and tell me exactly what to run.
- No attribution or signature in commit messages (no Co-Authored-By, no "Generated with Claude Code", no session links).
- Ask me before installing or upgrading dependencies, and before schema changes, migrations or a full reset (`prisma migrate reset`, which also removes the admin; re-create it with `scripts/createAdmin.js`).
- The local database is my own test data: you may read it and change or delete any rows or accounts a task needs, without asking. Always say what you looked at, changed or deleted. Only the local development database; never a production one once real users exist.
- Don't invent product behaviour: if `docs/PRODUCT.md` doesn't decide it, stop and ask, with options and trade-offs. Only build what's in the current release scope.
- For UI work, read `docs/DESIGN.md` first. Never raw colours, font names or loose sizes in screens: theme tokens only.

## Docs map

- `docs/PRODUCT.md`: what the app should do, v1.0 and v1.1 scope, business rules, open decisions
- `docs/ROADMAP.md`: the plan and task tracker (phased checklist); known bugs and security issues
- `docs/DECISIONS.md`: decisions and the reasons behind them
- `docs/ARCHITECTURE.md`: how the app works in plain English (sections 1–9) and the technical reference (section 10)
- `docs/DESIGN.md`: the visual design system (colours, fonts, spacing, components, icons)
- `docs/features/*.md`: one spec per Phase 4 feature (team membership, profiles and registration)

## Project at a glance

Indoor football (futsal) app with three roles: **PLAYER**, **OWNER** (a venue owner; a team's leader is its **captain**) and **ADMIN**. Two independent npm projects, no root `package.json`:

- `backend/`: Express 5 REST API (ES modules) + Prisma 6 on PostgreSQL.
- `IndoorFootballApp/`: React Native 0.82 (plain JS screens).

`README.md` is the setup guide for a new PC and `backend/.env.example` lists every backend variable; keep both in sync with the code.

## Commands

Backend (run from `backend/`):
```bash
npm install
npx prisma generate          # after any schema.prisma change
npx prisma migrate deploy    # apply migrations; `npx prisma migrate dev --name <name>` creates one (ask first)
npm run dev                  # nodemon on src/server.js, port 4000; ignores tests/
node scripts/createAdmin.js  # create the admin or change its password (ADMIN_EMAIL, ADMIN_PASSWORD)
npm test                     # node:test suite in tests/ (needs `npm run dev` running and the local DB)
node --test tests/auth-tokens.test.js   # one test file
```

Mobile app (run from `IndoorFootballApp/`):
```bash
npm install
npm start                    # Metro
npm run android              # main target
npm run lint                 # ESLint only, no formatting check
npx prettier --check src App.js   # Prettier 2.8.8 check, run separately
npm test                     # Jest
npx jest __tests__/App.test.tsx   # one test file
```

The app's backend address is a hardcoded ngrok URL in `IndoorFootballApp/src/api/api.js`; update it when the tunnel changes. Settings, install-script approvals and tooling details: `docs/ARCHITECTURE.md` 10.1–10.3.

## Conventions that are easy to break

Each points to where the detail lives (`ARCH` = `docs/ARCHITECTURE.md`).

Backend
- Every body or query has a zod schema in `src/validation/`; controllers read only `req.valid`, never raw `req.body`/`req.query` values in Prisma. URL ids go through `parseId`; body ids stay within `MAX_DB_INT`. (ARCH 10.4)
- Don't reword existing API messages unless their rule changes; the app and tests rely on them. (DECISIONS 2026-11-20, 2026-11-22)
- Any user or profile data in a reply goes through `src/utils/visibility.js`; never hand-filter fields. (ARCH 10.4, PRODUCT "Profile visibility")
- Membership and captain writes run in `withLockedTeam` (first step `lockTeam`); any multi-step write uses a transaction; deletes go through `src/utils/deletion.js`. (ARCH 10.4)
- One Prisma client, from `src/db.js`. `src/config.js` is the only reader of `process.env`; never print a setting's value. (ARCH 10.2, 10.4)
- Errors go to `next(err)`; replies never contain `error.message`, stacks or Prisma details. (ARCH 10.4)
- Emails through `normalizeEmail`; values in HTML through `escapeHtml`; email-link tokens stored only as `hashToken(...)`; login tokens only from `signLoginToken`. (ARCH 10.4)
- Password reset, password change and (later) suspension increase `tokenVersion`. A wrong current password is 400, never 401: the app logs out on a 401. (ARCH 10.4)
- Route order: `/me`, `/invites`, `/requests` above `/:id`. (ARCH 10.4)

App
- Theme only through `useTheme()`, colour meanings never `palette`; no raw colours, fonts or loose sizes (a test scans `src/components/ui`). A missing value becomes a token, recorded in DESIGN.md. (ARCH 10.6, DESIGN 2–5)
- Icons only through `<Icon name>` with our names; Lucide is imported per icon, only in `Icon.js`. (ARCH 10.6, DESIGN 7)
- Screens are built from `src/components/ui`; every button that sends a request uses `loading` plus a `busy` ref against double taps. (ARCH 10.6)
- Android fonts: set `fontFamily` per weight, never `fontWeight`. `\p{…}` patterns need `new RegExp('…', 'u')`, not a regex literal. (ARCH 10.6)
- A screen can only navigate inside its own stack; the team screens are added to each stack with `teamScreens()`. (ARCH 10.6)
- Checks repeated in the app must match the backend's: `src/utils/phone.js`, `src/utils/password.js`, `checkTeamForm`, `profileChecks.js`. `acceptedTerms` is only ever the Terms box's own value. (ARCH 10.6)

Tests and repo
- Backend tests send real HTTP to the running server, each with its own throwaway `test-<uuid>@example.com` user deleted afterwards; never change existing users; tokens put in the database as `sha256Hex(token)`; mail to `@example.com` is skipped. (ARCH 10.2)
- Text files use LF (`.gitattributes`); `.env` and database dumps are git-ignored and never committed. (ARCH 10.1)
