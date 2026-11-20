# Connect Arena: Roadmap and Tracker

This is the master plan and task tracker. Tick a box (`[x]`) when an item is done. Add new items to the right phase as they come up. What's in each release (scope) comes from `PRODUCT.md`. Decisions and their reasons go in `DECISIONS.md`, not here.

_Source: Claude Code read-only audit, 2026-11-17. Findings come from reading the code, not from testing it against a running server. Reproduce each one before fixing it._

---

## Parallel track: product decisions

Open product decisions live in the "Open decisions" table in `PRODUCT.md`. These v1.0 decisions can be made while the security and bug fixes are in progress. Each one must be made before the features that depend on it are built.

- [x] Team membership details (expiry, withdrawing, duplicates, captain transfer, member limits)
- [x] Player profile visibility
- [x] Venue owner capabilities
- [x] Administration (moderation powers, reporting, enforcement)
- [x] Notifications (form of in-app notifications)
- [x] Account deletion (flow, data kept, effect on teams)
- [x] UI/UX (navigation, visual design system, screen changes)

v1.1 decisions (challenges, match scheduling, cancellation, results) wait until after launch.

---

## Phase 0: Today (no code needed)

- [x] Change the admin password. The old one is committed in the history of `scripts/createAdmin.js`. To change it, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, then run `node scripts/createAdmin.js`.
- [x] Confirm the GitHub repo is **private**.
- [ ] Purge `backup/app_db.backup` and the plaintext admin password from git history. Since 2026-11-20 the dump is no longer tracked (removed from git's index, and `backup/` and dump files are in `.gitignore`), but it's still in the history of earlier commits. Still to do, before the repo is ever shared or made public: rewrite the history with git filter-repo, then a force push (done by the owner).

## Phase 1: Security fixes (small, high-value)

Root cause behind several findings: **values from `req.body` and `req.query` go straight into Prisma `where` clauses without type checks.** Fix these cases first, then add validation everywhere (Phase 3).

1. [x] **Critical:** password reset token injection (`resetPassword` in `authController.js`). Require the token to be a string. Also check the HTML form route (`extended: true`).
2. [x] `GET /auth/verify` with no token verifies an arbitrary user. Reject a missing or non-string token.
3. [x] Join-team bypass (`joinTeam` and `acceptInvite` in `teamController.js`). `acceptInvite` must only accept invites the team owner created, and it must return 404 when no row exists. (interim: /join removed; the join-request flow is rebuilt in Phase 4)
4. [x] `createAdmin.js`: read the admin password from an env variable instead of hardcoding it.
5. [x] Reset page XSS (the `/reset-password-page` route in `authRoutes.js`). Escape the token or stop embedding it in the HTML.
6. [x] Password reset must apply the same strength rule as registration.
7. [x] Stop returning `error.message` in 500 responses. Log it on the server instead.
8. [x] Make the login error generic ("Invalid email or password").
9. [x] Add rate limiting (login, register, forgot) and helmet.
10. [x] Hash verification and reset tokens before storing them. Add an expiry to verification tokens.
11. [x] Escape user names in email HTML.
12. [x] Apply the profile visibility rules in PRODUCT.md on the backend: return only the fields each viewer may see (email: self and admin only; phone: accepted teammates and admin only).
13. [x] Add role checks on team endpoints (players only).
14. [x] Reject non-string email in login, forgot-password and register

## Phase 2: Bugs and repo hygiene

- [x] Admin delete route param mismatch (`:userId` vs `req.params.id`)
- [x] Admin delete safety: the admin routes can't delete the admin's own account or any ADMIN account (403); `/admin/indoors/:id` deletes only OWNER accounts; `/admin/users/:id` deletes only PLAYER and OWNER accounts.
- [x] Check every id in a URL with `parseId`, so a bad id gets 400 instead of 500.
- [x] Registration gets stuck when the email fails to send. Add a "resend verification" endpoint, and don't lock the email if sending fails.
- [x] Lowercase and trim emails. Check for existing duplicates in the DB. (shared `normalizeEmail`; DB checked 2026-11-20: no mixed-case emails, no clashes, no migration needed)
- [x] `createTeam` must validate the team name.
- [x] Persist login on app start (restore the user from the token) and handle 401 globally (log out). (`GET /auth/me`; "Can't reach the server" + Retry when offline)
- [x] Don't count pending invites as members. (captains get a separate `pendingInvites` list)
- [x] `AddMemberScreen` hooks error. Also exclude existing members from its list. (also leaves out the captain and pending invitees)
- [x] Owners see a "+ Create Team" button on All Teams (`TeamsListScreen.js`), but `CreateTeam` isn't a screen in `OwnerNavigator.js`, so tapping it does nothing. Hide the button for owners.
- [x] Rename the 'Owner' label to 'Captain' in TeamDetailScreen (and anywhere else the team creator is shown as owner) (also the backend's team error messages)
- [x] Remove dead screens (`RegisterScreen.js`, `PlayerDashboard.js`, `ResetPasswordScreen.js`) or wire them up. (deleted; `ResetPassword` also removed from `AuthStack`)
- [x] Remove the React Native deps from the backend `package.json` (also removed the unused diagram tools, `node-fetch` and the old generated Prisma client in `backend/generated/`, the leftover diagram files `prisma/ERD.svg`, `dfd1.md`, `diagram.md`, and the unused `/generated/prisma` line in `backend/.gitignore`).
- [x] Untrack the root `node_modules`. Delete commented-out old code. (root `node_modules`, `package.json` and `package-lock.json` deleted, as nothing used them; root `.gitignore` added)
- [x] Fix ESLint errors (19). (18 were in the deleted `RegisterScreen.js`, 1 was the AddMemberScreen hooks error; 0 errors now, 46 warnings remain)
- [x] Fix or replace the outdated `testFlow.js`. (deleted; the `tests/` suite replaces it)
- [x] Write `README.md` (how to run locally) and `backend/.env.example`.
- [x] Add .gitattributes to normalise line endings, then run Prettier on the app in one formatting-only commit
- [x] Fix the app's Jest test (needs an AsyncStorage mock) (`jest.setup.js` uses the package's own mock; `jest.config.js` also lets Jest translate React Navigation and `react-native-*` packages)

## Phase 3: Foundations

Enums, `onDelete: Cascade`, pagination and website validation moved to Phase 4; migration-history cleanup and CI moved to Phase 5 (DECISIONS.md 2026-11-20).

- [x] Use a single shared Prisma client. (3.1) (`src/db.js`)
- [x] Validate environment variables at startup (fail fast). (3.1) (`src/config.js`, `src/config/loadConfig.js`)
- [x] zod validation on every endpoint, and `express.urlencoded({ extended: false })`. This closes the whole injection class of bugs. (3.2) (`src/validation/`, `src/middleware/validate.js`)
- [x] Indexes on token columns. (done 2026-11-19)
- [x] Wrap multi-step deletes in transactions. (`src/utils/deletion.js`; no other multi-step deletes exist)
- [ ] 30-day login with token revocation (`tokenVersion`). (3.3)
- [ ] Upgrade nodemailer 7 → 10 (major). Version 7 gets no security fixes; several open advisories are in address parsing. Own small task after 3.3, with tests for verification, reset and resend emails.
- [x] Backend tests for auth and teams. (`tests/` covers auth and every team endpoint; removing a player, including cancelling a pending invite, is in `tests/remove-player.test.js`, added 2026-11-20)

## Phase 4: v1.0 features

Several items need schema changes. Each needs my approval before the migration is created.

- [ ] Schema enums (TeamMember status, player position) and `onDelete: Cascade` where appropriate, in the same migration as the membership changes (invite vs request, accepted at). Needs approval. (DECISIONS.md 2026-11-20)
- [ ] Store the captain only in Team.captainId: rename from ownerId and remove the captain member role, with tests. Touches about 16 places in the backend and the app. Do this before transfer captaincy and account deletion. (PRODUCT.md, "Team membership")
- [ ] Profile editing (players and venue owners)
- [ ] Change password while logged in
- [ ] Join request flow: captains see, approve and reject requests. The join endpoint was removed in Phase 1 (item 3) and needs to be rebuilt, recording that the row is a join request, not an invite.
- [ ] Venue discovery polish
- [ ] Team membership: record invite vs join request, accepted at date (same migration as invite/request), cancel requests and invites, leave a team, transfer captaincy, 15-member limit, "Accept invite" instead of "Request to join" (PRODUCT.md, "Team membership")
- [ ] Account deletion with shared deletion logic (in the app; also used by admin deletion), including automatic captaincy transfer (PRODUCT.md, "Account deletion")
- [ ] Rename the player address field to "Area" (keep existing values) (PRODUCT.md, "Profile visibility")
- [ ] Venue listing: add area, opening hours and pricing info fields; admin approval ("Pending review"), only when address, area and phone are filled in (enforced by the backend); missing-fields checklist on My Venue; venue search by name and filter by area (PRODUCT.md, "Venue owners")
- [ ] Shorter registration and position list, built together with profile editing: short player and owner sign-up forms (DECISIONS.md 2026-11-20), position picker, owner phone and address optional, position enum with mapping of existing values (PRODUCT.md, "Registration")
- [ ] Pagination on list endpoints (with the Explore lists)
- [ ] Validate owner website URLs (http/https only) on the backend and before `Linking.openURL`
- [ ] Notifications screen ("Needs your action" + "Updates"), badge, read/unread (PRODUCT.md, "Notifications")
- [ ] Moderation: Report button and admin Reports screen; Block and unblock (Settings → Blocked players); suspend and unsuspend users; Terms of Use and Privacy Policy checkbox at registration (PRODUCT.md, "Administration and moderation")
- [x] Write `docs/DESIGN.md` (colors, fonts, spacing, components, screen list) before UI work
- [ ] Theme module and shared components, following the folder structure in DESIGN.md section 2: `src/theme/` (palette, colors, typography, spacing, radius, shadows, index, ThemeProvider with `useTheme()`) and shared components in `src/components/ui/`. Status bar always light content (fix App.js following the phone's theme).
- [ ] Add Barlow Condensed and Inter font files
- [ ] Install lucide-react-native and react-native-svg (check version compatibility first, tell me the versions), build the Icon component, then remove react-native-vector-icons and its fonts and config once unused
- [ ] Rebuild navigation as bottom tabs per role, as described in PRODUCT.md
- [ ] Restyle all screens using the theme module, one screen at a time, without changing behaviour (this also clears the remaining ESLint inline-style warnings, 46 as of 2026-11-20)
- [ ] Write a short spec in `docs/features/` before building each feature above

## Phase 5: Deployment readiness

- [ ] Choose hosting for the backend and a managed Postgres database (decision pending).
- [ ] Make the API URL configurable per build (dev/prod) instead of a hardcoded ngrok URL. Add request timeouts.
- [ ] Choose a transactional email provider instead of personal Gmail SMTP.
- [ ] Deep links for verify and reset (or keep the web pages, served from the real domain).
- [ ] Release keystore and ProGuard/R8 for the Android release build.
- [ ] Seed data for dev/staging. Never use real dumps.
- [ ] Purge secrets and the DB dump from git history (see Phase 0).
- [ ] Clean up the confusing migration history (before the first production database)
- [ ] CI on GitHub Actions (I set up the remote side)
- [ ] Decide on Prisma 7 (major upgrade; fixes the remaining audit warnings in Prisma's command-line tooling, which only runs during development). Includes moving to Prisma 6.19.x first if useful.
- [ ] Web page or link for account deletion requests (Google Play requirement)
- [ ] Write the Terms of Use and Privacy Policy (including backup retention period)
- [ ] Create a dedicated support email and show it in Settings and the suspension message
- [ ] Set trust proxy correctly for the real hosting (the current value 1 assumes ngrok)
- [ ] If running more than one server, move rate-limit counters to a shared store
- [ ] After launch, watch for real users being rate-limited (shared mobile IPs)
- [ ] Error monitoring and alerts (e.g. when emails fail to send)

## Phase 6: v1.1 (after launch)

- [ ] Challenges
- [ ] Match scheduling and cancellation
- [ ] Match results and history
- [ ] Push notifications
