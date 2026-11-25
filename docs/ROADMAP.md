# ConnectArena: Roadmap and Tracker

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
- [x] 30-day login with token revocation (`tokenVersion`). (3.3) (`src/middleware/auth.js`; a password reset logs out every device)
- [x] Upgrade nodemailer 7 → 10 (major). (done 2026-11-20: 10.4.1; email sending moved to `src/utils/mailer.js`, tested in `tests/mailer.test.js`) Version 7 gets no security fixes; several open advisories are in address parsing. Own small task after 3.3, with tests for verification, reset and resend emails.
- [x] Backend tests for auth and teams. (`tests/` covers auth and every team endpoint; removing a player, including cancelling a pending invite, is in `tests/remove-player.test.js`, added 2026-11-20)

## Phase 4: v1.0 features

Built in four steps, in order (DECISIONS.md 2026-11-20, "Phase 4 order"). Several items need schema changes. Database changes come in several small migrations (captain, membership, profiles and venues, notifications, moderation), each needing my approval before it's created.

### Step 1: Team data groundwork (backend only)

- [x] 4.1 Store the captain only in Team.captainId: rename from ownerId and remove the captain member role, with tests. Touches about 16 places in the backend and the app. Do this before transfer captaincy and account deletion. (PRODUCT.md, "Team membership") (done 2026-11-20: migration `20261120161908_captain_id` renamed the column in place; `tests/captain-id.test.js`)
- [x] 4.2 Membership data, in one migration: TeamMember status as an enum; record how each membership started (invite, join request, or the captain creating the team); a real accepted-at date; `onDelete: Cascade` where appropriate, as a safety net. Needs approval. (DECISIONS.md 2026-11-20; split from the old "Schema enums" item, whose position enum moved to the registration item in Step 3) (done 2026-11-20: migration `20261120171221_membership_data`; status and joinedAt converted in place, joinedAt renamed createdAt; one pre-fix row deleted by the owner's decision; `tests/membership-data.test.js`)

### Step 2: The new look's foundation (app only)

Existing screens keep working inside the new tabs.

- [x] Write `docs/DESIGN.md` (colors, fonts, spacing, components, screen list) before UI work
- [x] 4.3 Theme module, following the folder structure in DESIGN.md section 2: `src/theme/` (palette, colors, typography, spacing, radius, shadows, index, ThemeProvider with `useTheme()`). Status bar always light content (fix App.js following the phone's theme). (done 2026-11-20: `__tests__/theme.test.js` checks the tokens and contrast; React Navigation also gets a token theme)
- [x] 4.4 Install lucide-react-native and react-native-svg (check version compatibility first, tell me the versions) and build the Icon component. (done 2026-11-21: lucide-react-native 1.70.0, react-native-svg 15.16.1; `src/components/ui/Icon.js`, `__tests__/Icon.test.js`. Existing screens keep Ionicons until their restyle; removing react-native-vector-icons is the last item of Step 4)
- [x] 4.5 Shared components in `src/components/ui/` (DESIGN.md sections 2 and 6). The shared Button has a loading state (spinner, taps blocked while a request runs). Every button that sends a request uses it. Today the register, forgot-password and resend buttons give no feedback, and a second tap on Register gets 'Email already registered'. (done 2026-11-21: 19 components, tests in `__tests__/components-*.test.js` including a guard against raw colours and font names, and a dev-only UI gallery. The register, forgot-password and resend screens use the loading Button since their rebuild in feature 2, task F2.2, 2026-11-22)
- [x] Add Barlow Condensed and Inter font files (done 2026-11-20 with 4.3: static .ttf files from Google Fonts in `IndoorFootballApp/assets/fonts/`, copied by hand into the Android assets)
- [x] The Android window theme (`AppTheme`, DayNight) follows the phone's setting, so a white window can show at launch before the first screen. Make it dark (found in 4.3; not fixed there). (done 2026-11-21: `windowBackground` and `statusBarColor` are `@color/app_background`, the same as `bg`; the parent stays DayNight, see the item at the end of Step 4; the start-up views now paint the theme background)
- [x] 4.6 Rebuild navigation as bottom tabs per role, as described in PRODUCT.md (done 2026-11-21: `TabBar` component, a stack per tab, interim Explore, Notifications, owner Profile and admin Reports screens listed in PRODUCT.md; `__tests__/navigation.test.js`)

### Step 3: Features, one at a time

Rule: write a short spec in `docs/features/` before building each feature below. Each feature is built backend and screens together, in the order listed.

**Team membership features** (spec: [features/team-membership.md](features/team-membership.md); tasks F1.1 backend, F1.2 and F1.3 screens)
- [x] Join request flow: captains see, approve and reject requests. The join endpoint was removed in Phase 1 (item 3) and needs to be rebuilt, recording that the row is a join request, not an invite. Includes the optional message to the captain (DECISIONS.md 2026-11-21). (done 2026-11-22: `POST /teams/:teamId/requests` and its cancel, approve and decline routes in F1.1; Request to join, Team detail's Join requests card and My Teams' Requests sent in F1.2 and F1.3)
- [x] Team membership: cancel requests and invites, leave a team, transfer captaincy, 15-member limit (including no invites when full), "Accept invite" instead of "Request to join" (PRODUCT.md, "Team membership"). Recording invite vs join request and the accepted-at date was done in 4.2. (done 2026-11-22: endpoints under the team-row lock with `tests/team-limit.test.js` in F1.1; the new Team detail with every viewer state and dialog, Transfer captaincy, Invite players, My Teams and the Invites screen in F1.2 and F1.3)
- [x] Captain can edit team name and description (same rules as creating a team; DECISIONS.md 2026-11-21) (done 2026-11-22: `PATCH /teams/:teamId` in F1.1; the team form's edit mode and Team detail's Edit team button in F1.3)

**Profiles and registration** (spec: [features/profiles-and-registration.md](features/profiles-and-registration.md), approved 2026-11-22; tasks F2.1 backend, F2.2 sign-up and auth screens, F2.3 player profile, Settings and Change password, F2.4 venue owner screens)
- [x] Shorter registration and position list, built together with profile editing: short player and owner sign-up forms (DECISIONS.md 2026-11-20), position picker, owner phone and address optional, position enum with mapping of existing values (PRODUCT.md, "Registration"), Bangladeshi mobile phone rule at sign-up and on edit (PRODUCT.md, "Profiles"; DECISIONS.md 2026-11-22). The position enum is part of this item's migration (DECISIONS.md 2026-11-20, "Phase 4 order"). (done 2026-11-22: the `profiles_registration` migration with the `Position` enum and mapping, short register schema and phone rule in F2.1; the short sign-up forms with the position picker and the app's phone tidy-up in F2.2)
- [x] Rename the player address field to "Area" (keep existing values), free text with suggestions (PRODUCT.md, "Profile visibility" and "Profiles") (done 2026-11-22: `address` renamed to `area` in place, public in player lists, in F2.1; `SuggestionField` with the area list on Edit profile in F2.3)
- [x] Profile editing (players and venue owners), including a proper owner Profile tab. The email is shown read-only (DECISIONS.md 2026-11-22). (done 2026-11-23: `PATCH /players/me` and `PATCH /owners/me` in F2.1; player Profile and Edit profile in F2.3; My Venue, Edit venue and the owner Profile tab, with owners on the shared Settings screen, in F2.4)
- [x] Change password while logged in. It logs the account out on every other device: increase `tokenVersion` and reply with a fresh token, so the phone that made the change stays logged in (DECISIONS.md 2026-11-20, "Which events log out every device"). (done 2026-11-23: `POST /auth/change-password` with its rate limits and notice email in F2.1; the Change password screen and the stale-401 fix in F2.3; reachable from owners' Settings in F2.4)
- [x] Terms of Use and Privacy Policy checkbox on both sign-up forms, with links to the two pages (moved here from Moderation, DECISIONS.md 2026-11-22; PRODUCT.md, "Registration") (done 2026-11-22: the backend requires `acceptedTerms` and records `termsAcceptedAt`, with the draft Terms and Privacy pages, in F2.1; the Checkbox and links on both rebuilt sign-up forms in F2.2)
- [x] Validate owner website URLs (http/https only) on the backend and before `Linking.openURL` (moved here from Venues, because the venue edit form is built in this feature; spec D3, approved 2026-11-22) (done 2026-11-23: the backend check on `PATCH /owners/me` in F2.1; in F2.4 one `isWebLink` pattern in the backend and the app (DECISIONS.md 2026-11-22, "One website rule in the app and the backend"), checked on Edit venue and before every `Linking.openURL` in My Venue and Explore → Venues)

**Venues** (spec: [features/venues.md](features/venues.md), approved 2026-11-23; scope decided in DECISIONS.md 2026-11-23, "Venue details"; tasks F3.1 backend, F3.2 owner screens, F3.3 venue discovery, F3.4 admin)
- [x] Venue listing: add area, opening hours and pricing info fields; admin approval ("Pending review"), only when address, area and phone are filled in (enforced by the backend); the admin's note on a pending venue and moving an approved venue back to review with a note; missing-fields checklist and status on My Venue (PRODUCT.md, "Venue owners") (done 2026-11-23: the `venues` migration, the owner edit with the live-venue rule and the admin review endpoints in F3.1; My Venue's status, note and checklist and Edit venue's new fields in F3.2)
- [x] Venue discovery: the venue list with search by name and an area filter (approved venues only), opened from Explore → Venues until feature 3b, and a new Venue detail screen (tap to call, website through `isWebLink`). Replaces the old "Venue discovery polish" item: the polish is this rebuilt list and detail screen, in the new design (spec sections d and e) (done 2026-11-23: `GET /owners` with search and the area filter and `GET /owners/:userId` in F3.1; the reusable `VenueList`, the interim `VenuesScreen` and Venue detail in F3.3, which deleted `IndoorsListScreen`)
- [x] Admin side: the Venues tab with pending venues first (approve, note, move back to review) and the Dashboard's "Venues waiting for review" count (done 2026-11-23: `pendingVenueCount` in F3.1; in F3.4 the rebuilt Dashboard, the Venues tab and a review screen per venue, which deleted `ManageIndoorsScreen` and the old Dashboard code)

**Explore: Teams and Players, Player detail** (feature 3b, right after Venues; split out on 2026-11-23, DECISIONS.md "Venue details"; scope decided in DECISIONS.md 2026-11-23, "Explore details"; spec: [features/explore.md](features/explore.md), approved 2026-11-23, DECISIONS.md "Explore feature spec approved"; tasks F3b.1 backend (done 2026-11-23: the `team_area` migration and every endpoint in the spec's section d, with the old screens reading the new replies' first page), F3b.2 team area and player rows (done 2026-11-23: the team form's Area field, the area on My Teams cards and Team detail with the captain's "Add area", and `personMeta` on Team detail's and Transfer captaincy's rows), F3b.3 Player detail (done 2026-11-23: the screen with the Invite to my team card, `PlayerDetail` in `teamScreens()`, and Team detail's person rows opening it), F3b.4 Explore (done 2026-11-24: `SectionTabs`, `usePagedList`, the Explore screen with its three sections, `VenueList` on the hook; the old lists, the interim screens and two images deleted), F3b.5 Invite players (done 2026-11-24: the shared `PlayerList` on the invite search))
- [x] Explore tab: one screen with Teams · Players · Venues sections, each with search and its filters (PRODUCT.md, "App structure and navigation"; spec sections d and e). Replaces the interim Explore screen with three rows and deletes the old Teams and Players lists and the interim Venues screen, so no old screen is reachable by players or owners (review finding 9). The Venues section reuses the venue list built in feature 3. (done 2026-11-24, F3b.4)
- [x] Player detail: public profile fields (PRODUCT.md, "Profile visibility"), with **Invite to my team** for captains; the phone, with tap to call, for accepted teammates (spec d endpoint 6 and section e). Report and Block arrive with moderation. (done 2026-11-24, F3b.3)
- [x] Review finding 3: an optional team area set on the team form, an area filter for teams, and area and position filters for players (decided 2026-11-23; spec sections c, d and e; the `team_area` migration needs approval) (done 2026-11-24: F3b.1, F3b.2 and the filters in F3b.4) ([review](reviews/2026-11-23-independent-review.md))
- [x] Review finding 4: paging built into the Explore lists and endpoints from the start, and a server-side search for Invite players (spec d.1, d endpoint 7 and section e) (done 2026-11-24: the endpoints in F3b.1, Explore's lists in F3b.4, Invite players in F3b.5) ([review](reviews/2026-11-23-independent-review.md))
- [x] Pagination on list endpoints: covered by this feature for the three Explore lists and the invite search (decided 2026-11-23, DECISIONS.md "Explore details"). The admin's lists get paging with Moderation (spec Q4; its own item there). (done 2026-11-24: `page`, `limit` and `total` on all four endpoints in F3b.1; the app loads pages with `usePagedList` since F3b.4 and F3b.5)
- [x] Review finding 12: "Position · Area" on Team detail's member, join request and invited rows, on Invite players and in Explore → Players (moved here from the review quick fixes, because the task brief builds it with this feature; spec section e). The Invites screen doesn't change (spec Q1). (done 2026-11-24: Team detail in F3b.2, Explore → Players in F3b.4, Invite players in F3b.5)

**Account deletion** (feature 4; scope decided in DECISIONS.md 2026-11-25, "Account deletion details"; spec: [features/account-deletion.md](features/account-deletion.md), approved 2026-11-25; tasks F4.1 backend (done 2026-11-25: the shared deletion with handover, the previews, the own-account endpoints and the notice email), F4.2 Delete account in the app (done 2026-11-25: Settings, the Delete account screen and what follows it), F4.3 admin dialogs (done 2026-11-26))
- [x] Account deletion with shared deletion logic (in the app; also used by admin deletion), including automatic captaincy transfer (PRODUCT.md, "Account deletion") (done 2026-11-26: one shared deletion under the team locks with handover and the notice email in F4.1; Settings → Delete account in F4.2; the admin's delete dialogs with the same outcomes in F4.3. The web page for deletion requests stays in Phase 5)

**Notifications** (feature 5; details decided in DECISIONS.md 2026-11-26, "Notification details"; spec: [features/notifications.md](features/notifications.md), approved 2026-11-26, DECISIONS.md "Notifications feature spec approved"; tasks F5.1 backend: the table and creating updates (done 2026-11-26), F5.2 backend: the endpoints (done 2026-11-26), F5.3 the Notifications screen, F5.4 the badge)
- [ ] Notifications screen ("Needs your action" + "Updates"), badge, read/unread (PRODUCT.md, "Notifications"). Replaces the interim Notifications tabs (the player's Invites screen, the owner's empty state) and sets the tab's `tabBarBadge`.

**Moderation**
- [ ] Moderation: Report button and admin Reports screen (replacing the interim Reports tab); Block and unblock (Settings → Blocked players); suspend and unsuspend users (suspending increases `tokenVersion`, so the user is logged out on every device at once) (PRODUCT.md, "Administration and moderation"). The Terms of Use checkbox moved to Profiles and registration (DECISIONS.md 2026-11-22).
- [ ] Paging and search for the admin's Users, Teams and Venues lists (`/admin/users`, `/admin/teams`, `/admin/indoors`), built when this feature reworks the Users tab; the venue review screen then loads its one venue instead of the whole list (explore spec Q4, DECISIONS.md 2026-11-23 "Explore feature spec approved"; review finding 4)

### Step 4: Restyle the rest

- [ ] Restyle all screens using the theme module, one screen at a time, without changing behaviour (this also clears the remaining ESLint inline-style warnings, 46 as of 2026-11-20). By this point only old screens that no Step 3 feature touched should be left.
- [ ] Switch the Android `AppTheme` parent from `Theme.AppCompat.DayNight.NoActionBar` to an always-dark one, once no screen relies on Android's default text, input or alert colours (the sign-up screens no longer do since F2.2; the remaining old screens still need checking). Alerts then turn dark on every phone. (found in 4.4)
- [ ] Remove react-native-vector-icons once no screen uses it (after the restyles): the package, its font files in `android/app/src/main/assets/fonts/` and `ios/` (`UIAppFonts` in Info.plist), its entry in `react-native.config.js`, and the `link-assets-manifest.json` entries (split from 4.4)

**Review quick fixes** (from the [independent review of 2026-11-23](reviews/2026-11-23-independent-review.md); the finding numbers are the report's)
- [ ] Finding 5: a default request timeout in the app, with the existing connection message
- [ ] Finding 6: brand the account emails (sender name, subjects with the app name, one plain template)
- [ ] Finding 7: a usable password reset page (viewport, the strength rule, a confirm field)
- [ ] Finding 10: on a pending, incomplete My Venue, a "Complete your listing" button under the checklist; a different icon for Address and Area
- [ ] Finding 11: one Create team button on the empty My Teams screen
- Finding 12 ("Position · Area" on player rows) moved to feature 3b above.
- [ ] Finding 13: two sign-ups for the same email at once get "Email already registered", not a 500
- [ ] Finding 14: "Open in Maps" on a venue's address
- [ ] Finding 15: drop the unused email claim from the login token
- [ ] Finding 17: show Approve's blockers under the status pill on the admin review screen
- [ ] Finding 18: fix the three stale doc lines (ARCHITECTURE.md, the draft Privacy page, the two code comments)
- [ ] Finding 16, to be decided: a shorter login for the admin role

## Phase 5: Deployment readiness

- [ ] Review finding 1: the final `applicationId`, app name and launcher icon, and a release keystore with Play App Signing ([review](reviews/2026-11-23-independent-review.md))
- [ ] Review finding 2: Play Console: developer account, Data safety form, content rating, app access instructions, privacy policy URL, the closed test. The closed test starts only when no old screen is reachable by players or owners (finding 9) and moderation and account deletion are built ([review](reviews/2026-11-23-independent-review.md))
- [ ] Review finding 8: a crash reporter in the app (a new package, needs my approval) and a minimum-version check ([review](reviews/2026-11-23-independent-review.md))
- [ ] Review finding 15, second part: encrypted token storage in the app, after launch ([review](reviews/2026-11-23-independent-review.md))
- [ ] Choose hosting for the backend and a managed Postgres database (decision pending).
- [ ] Make the API URL configurable per build (dev/prod) instead of a hardcoded ngrok URL. Add request timeouts.
- [ ] Choose a transactional email provider instead of personal Gmail SMTP. Register waits for Gmail to accept the verification email before replying (by design, so a failed send is reported). This takes a few seconds; a proper email provider should shorten it. Measure before and after.
- [ ] Deep links for verify and reset (or keep the web pages, served from the real domain).
- [ ] Release keystore and ProGuard/R8 for the Android release build.
- [ ] Seed data for dev/staging. Never use real dumps.
- [ ] Purge secrets and the DB dump from git history (see Phase 0).
- [ ] Clean up the confusing migration history (before the first production database)
- [ ] CI on GitHub Actions (I set up the remote side)
- [ ] Decide on Prisma 7 (major upgrade; fixes the remaining audit warnings in Prisma's command-line tooling, which only runs during development). Includes moving to Prisma 6.19.x first if useful.
- [ ] Clear the mobile app's remaining npm audit warnings (development tooling only; the 2026-11-21 review fixed axios, React Navigation and the rest). `image-size` (high) comes from Metro 0.83, which React Native 0.82 uses; it's only fixed by a React Native upgrade that brings a newer Metro. `minimatch` (moderate, through ESLint's `@typescript-eslint` packages) is fixed in `@typescript-eslint` 8.73.0, which turns two weeks old on 2026-11-30. Both only read our own project files.
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
