# Connect Arena: Roadmap and Tracker

This is the master plan and task tracker. Tick a box (`[x]`) when an item is done. Add new items to the right phase as they come up. What's in each release (scope) comes from `PRODUCT.md`. Decisions and their reasons go in `DECISIONS.md`, not here.

_Source: Claude Code read-only audit, 2026-11-17. Findings come from reading the code, not from testing it against a running server. Reproduce each one before fixing it._

---

## Parallel track: product decisions

Open product decisions live in the "Open decisions" table in `PRODUCT.md`. These v1.0 decisions can be made while the security and bug fixes are in progress. Each one must be made before the features that depend on it are built.

- [ ] Team membership details (expiry, withdrawing, duplicates, captain transfer, member limits)
- [ ] Player profile visibility
- [ ] Venue owner capabilities
- [ ] Administration (moderation powers, reporting, enforcement)
- [ ] Notifications (form of in-app notifications)
- [ ] Account deletion (flow, data kept, effect on teams)
- [ ] UI/UX (navigation, visual design system, screen changes)

v1.1 decisions (challenges, match scheduling, cancellation, results) wait until after launch.

---

## Phase 0: Today (no code needed)

- [ ] Change the admin password. The current one is committed in `createAdmin.js:12`.
- [ ] Confirm the GitHub repo is **private**.
- [ ] Plan to purge `backup/app_db.backup` and the plaintext admin password from git history (git filter-repo). Deleting the files alone leaves them in history. Do this after the Phase 1 fixes and before the repo is ever made public.

## Phase 1: Security fixes (small, high-value)

Root cause behind several findings: **values from `req.body` and `req.query` go straight into Prisma `where` clauses without type checks.** Fix these cases first, then add validation everywhere (Phase 3).

1. [ ] **Critical:** password reset token injection (`authController.js:303`). Require the token to be a string. Also check the HTML form route (`extended: true`).
2. [ ] `GET /auth/verify` with no token verifies an arbitrary user. Reject a missing or non-string token.
3. [ ] Join-team bypass (`teamController.js:32, :139`). `acceptInvite` must only accept invites the team owner created, and it must return 404 when no row exists.
4. [ ] `createAdmin.js`: read the admin password from an env variable instead of hardcoding it.
5. [ ] Reset page XSS (`authRoutes.js:23`). Escape the token or stop embedding it in the HTML.
6. [ ] Password reset must apply the same strength rule as registration.
7. [ ] Stop returning `error.message` in 500 responses. Log it on the server instead.
8. [ ] Make the login error generic ("Invalid email or password").
9. [ ] Add rate limiting (login, register, forgot) and helmet.
10. [ ] Hash verification and reset tokens before storing them. Add an expiry to verification tokens.
11. [ ] Escape user names in email HTML.
12. [ ] Hide emails in `/players`, `/teams` and `/owners` responses. Return only the fields the screen needs.
13. [ ] Add role checks on team endpoints (players only).

## Phase 2: Bugs and repo hygiene

- [ ] Admin delete route param mismatch (`:userId` vs `req.params.id`)
- [ ] Registration gets stuck when the email fails to send. Add a "resend verification" endpoint, and don't lock the email if sending fails.
- [ ] Lowercase and trim emails. Check for existing duplicates in the DB.
- [ ] `createTeam` must validate the team name.
- [ ] Persist login on app start (restore the user from the token) and handle 401 globally (log out).
- [ ] Don't count pending invites as members.
- [ ] `AddMemberScreen` hooks error. Also exclude existing members from its list.
- [ ] Owners see a "+ Create Team" button on All Teams (`TeamsListScreen.js`), but `CreateTeam` isn't a screen in `OwnerNavigator.js`, so tapping it does nothing. Hide the button for owners (or decide whether owners should create teams).
- [ ] Remove dead screens (`RegisterScreen.js`, `PlayerDashboard.js`, `ResetPasswordScreen.js`) or wire them up.
- [ ] Untrack the root `node_modules`. Remove the React Native deps from the backend `package.json`. Delete commented-out old code.
- [ ] Fix ESLint errors (19).
- [ ] Fix or replace the outdated `testFlow.js`.
- [ ] Write `README.md` (how to run locally) and `backend/.env.example`.

## Phase 3: Foundations

- [ ] Use a single shared Prisma client.
- [ ] Validate environment variables at startup (fail fast).
- [ ] Add a request validation library (e.g. zod) on every endpoint. This closes the whole injection class of bugs.
- [ ] Schema: enums for status and role, `onDelete: Cascade` where appropriate, indexes on token columns. Clean up the confusing migration history.
- [ ] Wrap multi-step deletes in transactions.
- [ ] Shorter JWT lifetime plus a way to revoke tokens (e.g. a token version on User, or refresh tokens).
- [ ] Backend tests (auth and teams first), plus CI on GitHub Actions.
- [ ] Pagination on list endpoints.
- [ ] Validate owner website URLs (http/https only) before `Linking.openURL`.

## Phase 4: v1.0 features

- [ ] Profile editing (players and venue owners)
- [ ] Change password while logged in
- [ ] Join request flow: captains see, approve and reject requests
- [ ] Account deletion inside the app (needs the Account deletion decision first)
- [ ] Basic in-app notifications for pending invites and join requests (needs the Notifications decision first)
- [ ] Venue discovery polish
- [ ] Write `docs/DESIGN.md` (colors, fonts, spacing, components, screen list) before UI work
- [ ] UI and visual improvements, following `DESIGN.md`
- [ ] Write a short spec in `docs/features/` before building each feature above

## Phase 5: Deployment readiness

- [ ] Choose hosting for the backend and a managed Postgres database (decision pending).
- [ ] Make the API URL configurable per build (dev/prod) instead of a hardcoded ngrok URL. Add request timeouts.
- [ ] Choose a transactional email provider instead of personal Gmail SMTP.
- [ ] Deep links for verify and reset (or keep the web pages, served from the real domain).
- [ ] Release keystore and ProGuard/R8 for the Android release build.
- [ ] Seed data for dev/staging. Never use real dumps.
- [ ] Purge secrets and the DB dump from git history (see Phase 0).
- [ ] Web page or link for account deletion requests (Google Play requirement)

## Phase 6: v1.1 (after launch)

- [ ] Challenges
- [ ] Match scheduling and cancellation
- [ ] Match results and history
