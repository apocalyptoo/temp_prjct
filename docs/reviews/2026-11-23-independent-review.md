# Independent review of ConnectArena, 2026-11-23

A read-only review of the docs, the backend, the app and the running emulator, done with fresh eyes against the state of `main` at commit `730d989` ("Rebuild the admin Dashboard with the venues waiting for review"). Nothing in the code or the other docs was changed.

**What was checked**

- Every file in `docs/` (PRODUCT, ROADMAP, DECISIONS, DESIGN, ARCHITECTURE, TECHNICAL, the three feature specs) and the two Floodlight mockups.
- All of `backend/src/`, `prisma/schema.prisma`, `scripts/createAdmin.js`, the Android project files, and all of `IndoorFootballApp/src/` plus `App.js`.
- The test suites and lint, against the running backend and local database:

  | Check | Result |
  |---|---|
  | Backend `npm test` (node:test, real HTTP) | 494 tests, 494 passed, 0 failed (145 s) |
  | App `npm test` (Jest) | 27 suites, 432 tests, all passed |
  | App `npm run lint` | 0 errors, 12 warnings (inline styles in the four old screens) |
  | App `npx prettier --check src App.js` | clean |

- A walk through the app on the emulator as a player, a venue owner and a temporary admin: sign-up form errors, log in, My Teams (empty and with a team), Create team, Team detail as captain (with a join request), Invite players, Explore and its Teams, Players and Venues lists, Venue detail, Profile, Settings, log out; owner My Venue (pending), Explore read-only, owner Profile; admin Dashboard, Venues tab, the review screen, Users, Reports. 17 screenshots were taken (limit 20).

**Overall impression.** The backend is in very good shape for a project at this stage: the validation layer, the visibility helper, the team lock, the conditional updates for the venue races, hashed tokens and the shared-IP rate limits are all well thought out and well tested. The rebuilt screens are faithful to the mockups and to DESIGN.md. I found no security hole that needs fixing before launch. Most of the findings below are about the gap between "works on the emulator" and "real people in Dhaka install it from the Play Store": Play Store readiness, discovery by location, network behaviour on mobile data, and the plan's ordering.

**Severity scale:** *must fix before launch* · *should fix* (before or soon after launch) · *nice to have*. **Size:** small (an hour or two) · medium (a task) · large (a feature).

---

## Findings (most important first)

### 1. The Android app still has the template's identity and is signed with the debug key

- **Category:** technical / plan · **Severity:** must fix before launch · **Size:** medium
- **What I saw:** `IndoorFootballApp/android/app/build.gradle:82` sets `applicationId "com.indoorfootballapp"`, lines 85–86 `versionCode 1` / `versionName "1.0"`, and line 103 signs the **release** build with `signingConfigs.debug`. `android/app/src/main/res/values/strings.xml` names the app "IndoorFootballApp", which is what the emulator's home screen shows under the icon. The launcher icon is still React Native's default. ROADMAP Phase 5 covers the keystore and ProGuard, but not the id, the name or the icon.
- **Why it matters:** the `applicationId` is the app's permanent identity on Google Play. It can never be changed after the first upload, so "com.indoorfootballapp" would be ConnectArena's id forever. The signing key is equally permanent for updates (use Play App Signing so Google holds the final key). The name and icon are the first thing a player sees.
- **Suggestion:** decide the final id now (for example `com.connectarena.app`), rename the app to ConnectArena in `strings.xml`, replace the launcher icon, create the release keystore (kept out of git, with the passwords in a `gradle.properties` outside the repo or in environment variables), and enable Play App Signing when the Play Console listing is created. Add these to Phase 5 as one item at the top.
- **Contradicts a decision?** No.

### 2. Google Play's own requirements are a longer path than the roadmap shows

- **Category:** plan · **Severity:** must fix before launch · **Size:** medium (mostly process, little code)
- **What I saw:** Phase 5 lists the deletion web page, the Terms and Privacy text and the support email. It doesn't list: the **Data safety** form (what the app collects: email, phone, name, approximate location as "area"; how it's used and shared), the **content rating** questionnaire, the **app access** instructions for Google's reviewers (a verified player account, a verified owner account, and how to reach the admin flow), the **privacy policy URL** on a real domain, and, for a **personal developer account created after November 2023, the mandatory closed test**: a number of testers (Google has said 20, later 12; check the current rule) opted in for 14 continuous days before you can apply for production access, followed by a review that can take days.
- **Why it matters:** the closed test alone adds at least two to three weeks of calendar time after the build is ready, and it needs real testers with Gmail accounts. Moderation and account deletion must be in the build those testers use, because the UGC policy applies to the test too. If this isn't planned, launch slips by a month after "everything is done".
- **Suggestion:** add a "Play Console" item to Phase 5 with those sub-items, create the developer account and the listing early (identity verification also takes days), and schedule the closed test to start as soon as moderation and account deletion are built, in parallel with the restyle (Step 4). Recruit the testers now from the futsal groups you know.
- **Contradicts a decision?** No.

### 3. Discovery has no location: teams have no area, and nothing is filtered by area or position

- **Category:** product · **Severity:** should fix (before the Explore feature is built) · **Size:** medium
- **What I saw:** PRODUCT.md gives Explore "Teams · Players · Venues, each with search (venues also filter by area)". `Team` has no area column (`schema.prisma`), so a player in Uttara looking for a team can only scroll a newest-first list of every team in the country and read descriptions. Players have an area and a position, but PRODUCT.md plans only a name search for them. `GET /teams` and `GET /players` return everything (`teamController.js:515–527`, `playerController.js:12–51`).
- **Why it matters:** for a city of twenty million, "near me" is the first question a player asks, and "we need a goalkeeper in Mirpur" is the first thing a captain asks. Without it, Explore Teams is a phone book. Venues already got this right (area filter); teams and players should match.
- **Suggestion:** add an optional `Team.area` (same rules and suggestions as the player Area; one small, approval-gated migration) edited on the team form and shown on team cards; in feature 3b give Explore Teams an area filter and Explore Players area and position filters, all done on the backend with `containsText`. Record it in PRODUCT.md "Team membership" and "App structure".
- **Contradicts a decision?** No. It extends "each with search"; the position list was chosen partly "to make a position filter possible later" (DECISIONS 2026-11-20).

### 4. Build the Explore lists paginated from the start, not in a later "pagination" item

- **Category:** plan / technical · **Severity:** should fix · **Size:** medium (cheaper now than later)
- **What I saw:** ROADMAP puts "Pagination on list endpoints" after Moderation (`docs/ROADMAP.md:141–142`), while the venues spec says the pagination item "changes all lists together, with feature 3b" (`docs/features/venues.md:290`). Today `GET /teams` loads every team with every membership row and every member's profile (`teamController.js:518`), `GET /players` every player, and Invite players downloads the whole player list to filter it on the phone (`InvitePlayersScreen.js:51`). The admin review screen loads the whole venue list to show one venue.
- **Why it matters:** feature 3b is where the list endpoints and screens get their final shape. Writing them without paging and then reopening every list, every screen and every test a few features later is double work, and until then one popular launch (a few thousand sign-ups) makes Explore Players a multi-megabyte request on mobile data.
- **Suggestion:** decide one paging shape now (offset `page`/`limit` is enough for v1.0, with `total` in the reply; cursor paging can come later) and build it into the 3b endpoints (`/teams`, `/players`, `/owners`) and the `FlatList`s (`onEndReached`) as they're built. Move the ROADMAP item into 3b. Also give Invite players a server-side search instead of downloading all players.
- **Contradicts a decision?** No (DECISIONS 2026-11-20 already says "pagination belongs with the new Explore lists").

### 5. On mobile data, a stalled request leaves a button spinning forever

- **Category:** technical · **Severity:** should fix · **Size:** small
- **What I saw:** the shared axios instance has no `timeout` (`src/api/api.js:10–13`); only the start-up `GET /auth/me` has one (`AuthContext.js:53`, 15 s). Every button runs through `useBusyAction`, which keeps the button in its loading state and blocks the screen until the request settles. The failure messages ("Couldn't reach the server. Please check your connection…") are good, but they never appear if nothing ever comes back.
- **Why it matters:** Bangladeshi mobile networks drop and stall often. A player who taps "Create account" or "Approve" on a stalling connection sees a spinner with no way out but killing the app, and then wonders whether it went through. ROADMAP Phase 5 has "Add request timeouts" as a sub-clause of the API URL item; it deserves to be done now, while every screen is being built.
- **Suggestion:** set a default `timeout` (about 20 s) on the axios instance, map `ECONNABORTED`/network errors to the existing connection message in one place, and keep a longer timeout for the two slow calls (register and forgot-password wait for Gmail). Consider showing "Still trying…" after a few seconds on long actions.
- **Contradicts a decision?** No.

### 6. The account emails look like phishing: no app name in the sender or subject, one blue template button

- **Category:** product / security · **Severity:** should fix · **Size:** small
- **What I saw:** `backend/src/utils/mailer.js:14` sends from `"App Support" <gmail address>`; the subjects are "Verify your email address" (line 38) and "Password reset request" (line 46), with no app name; only the password-changed email says ConnectArena (line 56). `emailTemplates.js:9` styles the verify button with a hard-coded blue `#007BFF`, unrelated to the brand. The reset email is two lines and a link.
- **Why it matters:** these are the first messages a real user gets from you, and "Password reset request" from "App Support" at a personal Gmail address is exactly what spam filters and cautious users reject. A user who doesn't trust the verification email never logs in at all.
- **Suggestion:** one small template with the ConnectArena name and a line saying why they got it ("You signed up for ConnectArena with this address"), sender name "ConnectArena", subjects "Verify your ConnectArena email" / "Reset your ConnectArena password", and the plain link under the button for clients that strip buttons. Do it now; the Phase 5 email-provider change is about delivery, not content.
- **Contradicts a decision?** No.

### 7. The password reset web page is bare and hard to use on a phone

- **Category:** design / flow · **Severity:** should fix · **Size:** small
- **What I saw:** `backend/src/routes/authRoutes.js:82–88` renders the reset form as a raw fragment: no `<!doctype>`, no viewport meta, no page title, a single "New Password" box with no confirm field and no hint about the strength rule. It's the only page in the backend not built with `messagePage`/`legalPage` (which do set the viewport). A weak password gets a "Password not changed" page with a "Try again" link; a typo can't be caught because there's no confirmation field. After success the page says "You can now log in to the app" with nothing to tap (deep links are Phase 5).
- **Why it matters:** this page opens in the phone browser for everyone who forgets a password. Without a viewport it renders at desktop width (tiny text and box). Guessing the rule after each failed attempt is frustrating, and a mistyped new password locks the user out again.
- **Suggestion:** build the form with the same page helper (viewport, title), show the rule as helper text, add a "Confirm new password" field checked by the backend, and keep the page visually simple and in the brand's words. Later, the Phase 5 deep links can open the app instead.
- **Contradicts a decision?** No.

### 8. No crash reporting in the app, and no way to force or prompt an update

- **Category:** technical · **Severity:** should fix (before the closed test) · **Size:** small each
- **What I saw:** Phase 5 lists backend error monitoring, but nothing for the app: no crash reporter (Sentry, Crashlytics or similar), so a crash on a tester's phone is invisible to you. There's also no minimum-version check: the app never asks the backend which versions it still supports, and the Android `versionCode` is fixed at 1.
- **Why it matters:** during the closed test, crash reports are how you learn what breaks on real phones you don't own. And every API change in v1.1 (challenges, matches) will hit old installs; without a version check they fail with "Something went wrong" instead of "Please update".
- **Suggestion:** (a) add a crash reporter (a new dependency, so it needs your approval; Sentry's React Native SDK is the common choice) with user emails turned off; (b) add `GET /app/config` returning `{ minAndroidVersionCode }`, read it at start-up and show an "Update required" screen with a Play Store link when the installed `versionCode` is lower; bump `versionCode` on every release.
- **Contradicts a decision?** No.

### 9. Old light-themed screens sit on the new player's main path until feature 3b

- **Category:** design · **Severity:** should fix (confirm the order) · **Size:** none extra, it's planned
- **What I saw:** Explore → Teams and Explore → Players are the old blue-gradient light screens (`TeamsListScreen`, `PlayersListScreen`), with their own "+ Create Team" button, Roboto text, a second visual language and a Players list that shows only names (plus your own email). Admin Users and Teams are the same. ARCHITECTURE.md and the ROADMAP say so, and 3b and Step 4 replace them.
- **Why it matters:** the "Find a team" link on an empty My Teams, the most likely first tap of a new player, lands on the old screen. It looks like a different app. This is fine for you, but no outside tester should see it: the closed test (finding 2) must start after 3b.
- **Suggestion:** keep 3b next (as planned) and make "no old screen reachable by players or owners" a gate for the closed test; the admin's two old screens can wait for Step 4.
- **Contradicts a decision?** No.

### 10. A new venue owner's first screen buries the only thing they need to do

- **Category:** flow · **Severity:** should fix · **Size:** small
- **What I saw:** on My Venue for a brand-new owner, the screen shows "Pending review", the checklist with three "Missing" rows, then a Listing card with seven "Not added" rows; the primary **Edit venue** button is at the very bottom (`MyVenueScreen.js:201`), below the fold on a 1080×2400 emulator. The checklist rows for Address and Area both use the same map-pin icon (`MyVenueScreen.js:69`), so the icons don't help tell them apart.
- **Why it matters:** the owner has just verified their email and logged in with nothing but a venue name. The one action that matters is to fill in the listing, and they have to scroll past two cards of "Missing" and "Not added" to find it.
- **Suggestion:** while the venue is pending and incomplete, put a primary "Complete your listing" button directly under the checklist (same destination as Edit venue), and collapse the Listing card to the rows that have a value (keep "Not added" rows once the venue is complete, as spec P26 intends). Give Address a different icon from Area (a building or map icon).
- **Contradicts a decision?** No (P26 "Not added" keeps its purpose once there's something to show).

### 11. Two primary "Create team" buttons on the empty My Teams screen

- **Category:** design · **Severity:** nice to have · **Size:** small
- **What I saw:** with no teams, My Teams shows the header's lime **Create team** (`MyTeamsScreen.js:83`) and the empty state's lime **Create team** (`MyTeamsScreen.js:127`) one above the other. DESIGN.md's "rule of one accent" asks for one main action per screen.
- **Why it matters:** two identical lime buttons make the screen look unfinished and dilute the accent that should mark the main action.
- **Suggestion:** hide the header action while the empty state is shown (or show the empty state without its button). Keep "Find a team" as the secondary link.
- **Contradicts a decision?** No.

### 12. Join-request and member rows show the position only; the mockup shows "Position · Area"

- **Category:** design / product · **Severity:** nice to have · **Size:** small
- **What I saw:** the Floodlight Team detail mockup shows "Winger · Mohammadpur" under each requester; the app shows only the position (`TeamDetailScreen.js:330` and `:440`, `personPosition`). The area is public and already in the reply (`toPublicPlayer` adds `area` when set).
- **Why it matters:** captains decide who to approve by position and by whether the player can actually get to the pitch. The area is the one public field that answers the second question, and it's already on the phone.
- **Suggestion:** a `personMeta(row)` that joins position and area with " · " when the area is set, used on Team detail, Invite players and the interim Invites screen.
- **Contradicts a decision?** No.

### 13. Two sign-ups for the same email at the same moment return a 500

- **Category:** technical · **Severity:** nice to have · **Size:** small
- **What I saw:** `register` checks for an existing email and then creates the user (`authController.js:44–54`). Two requests in the same instant both pass the check; the second `create` hits the unique index and Prisma throws `P2002`, which the error handler turns into 500 "Something went wrong". (Change password already handles the equivalent `P2025` case properly.)
- **Why it matters:** rare, but a double tap that slips past the button guard on a slow connection, or a retry after a timeout, shows the user a generic failure instead of "Email already registered". It also shows up as a server error in your logs for a normal situation.
- **Suggestion:** catch `err.code === 'P2002'` around the create and reply with the existing 400 message. Add one test.
- **Contradicts a decision?** No.

### 14. Players can't open a venue's location in a map

- **Category:** product · **Severity:** nice to have · **Size:** small
- **What I saw:** Venue detail shows the address as text, with tap-to-call and a website link (`VenueDetailScreen.js`). There's no way to open the address in a maps app.
- **Why it matters:** "how do I get there" is the main reason to look at a venue. A maps link costs nothing (no new dependency, no new data) and saves the player retyping the address.
- **Suggestion:** make the Address row tappable with `Linking.openURL('geo:0,0?q=' + encodeURIComponent(address + ', ' + area))`, labelled "Open in Maps", with the same failure alert as the dialler. Record the rule in PRODUCT.md "Venue discovery".
- **Contradicts a decision?** No (PRODUCT.md says the phone and website can be tapped; it doesn't exclude the address).

### 15. The login token carries the email and lives in plain AsyncStorage for 30 days

- **Category:** security · **Severity:** nice to have · **Size:** small
- **What I saw:** `signLoginToken` puts `email` into the JWT (`tokens.js:40`), although `verifyToken` reads the email from the database and never uses the claim. The token is stored with AsyncStorage (`src/utils/storage.js`), which is unencrypted app-private storage.
- **Why it matters:** anything in a JWT is readable by whoever sees the token (logs, proxies, a backup of the phone). Dropping the unused email claim removes personal data from the token for free. AsyncStorage is acceptable for v1.0 (Android's app sandbox protects it, and `allowBackup` is already false), but a keychain-backed store is the usual next step.
- **Suggestion:** drop `email` from the claims now (nothing reads it). Consider `react-native-keychain` or similar encrypted storage after launch; it's a new dependency, so it needs approval.
- **Contradicts a decision?** No.

### 16. The admin's 30-day session has the same strength as a player's

- **Category:** security · **Severity:** nice to have · **Size:** small
- **What I saw:** one admin account can delete any user or team and will soon suspend users and handle reports, with the same 30-day token as everyone else (`LOGIN_TOKEN_LIFETIME_SECONDS`) and only a password behind it.
- **Why it matters:** the admin token is the most valuable thing a lost or borrowed phone could hold. A shorter life for admin tokens limits that window at almost no cost; the admin logs in more often, but that's one person.
- **Suggestion:** sign ADMIN tokens with a shorter `expiresIn` (one to seven days) in `signLoginToken`, and keep a note in TECHNICAL 5.1. Two-factor login can wait.
- **Contradicts a decision?** It refines "Login lasts 30 days" (DECISIONS 2026-11-20) for the admin role only; the reason given there (phone users shouldn't be logged out weekly) is about players.

### 17. The Approve button's blockers sit below the fold on the admin review screen

- **Category:** design · **Severity:** nice to have · **Size:** small
- **What I saw:** on the admin review screen the greyed-out Approve button is at the bottom of a long Listing card; the reasons ("Missing: address, area, phone", "The owner hasn't verified their email yet") render under it, off screen on first view. The list card already summarises completeness, so the admin sees it there, but on the review screen itself the status pill alone says "Pending review".
- **Why it matters:** the admin opens the screen to decide one thing. The decision's blockers should be visible without scrolling.
- **Suggestion:** show the missing-fields line (or "Complete") and the unverified warning right under the status pill at the top, in addition to (or instead of) under the button.
- **Contradicts a decision?** No.

### 18. Small documentation drift

- **Category:** technical (docs) · **Severity:** nice to have · **Size:** small
- **What I saw:** `docs/ARCHITECTURE.md:34` still says "Still missing: … venue review and search", which were built on 2026-11-23. The draft Privacy page lists the venue listing fields without area, opening hours and pricing info (`legalRoutes.js`, "What we store"). The comment at `deletion.js:44` and the `teamScreens.js` header comment are already noted as out of date in TECHNICAL.md.
- **Why it matters:** the docs are unusually good and the project leans on them; small drift is cheap to fix now and expensive to trust later.
- **Suggestion:** fix the three lines with the next doc-touching commit; the Privacy page will be rewritten in Phase 5 anyway.
- **Contradicts a decision?** No.

---

## Things done well (keep doing these)

- **One place per rule.** Validation (`src/validation/`, `req.valid` only), visibility (`visibility.js`), deletion (`deletion.js`), the team lock (`withLockedTeam`), the website rule shared by app and backend, the phone and password rules repeated in the app with the backend's messages. This is the single biggest reason the codebase is safe to grow.
- **Races handled properly:** the `FOR UPDATE` team lock, the conditional `updateMany` for venue approval versus an emptying edit, change password's "hash must still match" update. Each is tested, including the concurrent cases.
- **Security basics are right:** bcrypt with a dummy compare for unknown emails, hashed email-link tokens with expiry, `tokenVersion` revocation, generic error replies, helmet, rate limits designed for shared mobile IPs, `parseId` on every URL id, 401 versus 400 for a wrong current password.
- **Tests that mean something:** 494 backend tests over real HTTP and 432 app tests, run in under three minutes, all green; the guard test that fails on a raw colour in `src/components/ui`.
- **The design system is real, not aspirational:** tokens only, `useTheme()` everywhere, `Icon` as the single Lucide import, 44-point targets, accessibility labels and states on every control, text that grows with font size, empty and error states on every list, `useBusyAction` on every request button. The built screens match the mockups closely.
- **Specs with explicit defaults, proposals and answered questions**, and decisions with reasons and alternatives. A new developer could pick this up.
- **Consistent, human copy:** "Decline" not "Reject", "Not added", "Something changed", dialogs that say exactly what will happen, privacy hints under phone and email.

## If you only do three things

1. **Lock in the app's Play Store identity and start the Play Console clock** (findings 1 and 2): final `applicationId`, name, icon and release keystore with Play App Signing; create the developer account and listing; plan the closed test with real testers right after moderation and account deletion land.
2. **Make discovery work for a city** (findings 3 and 4): give teams an area, filter teams and players by area and position in feature 3b, and build those lists paginated from the start.
3. **Harden the real-world edges before anyone outside sees the app** (findings 5–8): a request timeout with the existing connection message, branded emails, a usable reset page, a crash reporter and a minimum-version check.

---

## What I created and deleted during the review

All test data lived only in the local development database and has been removed; a final query confirmed nothing was left.

| Created | Where | Deleted |
|---|---|---|
| `review-player-a@example.com` (PLAYER, user id 29477) | local DB, directly | yes |
| `review-player-b@example.com` (PLAYER, user id 29478) | local DB, directly | yes |
| `review-owner@example.com` (OWNER "Review Arena", user id 29479) | local DB, directly | yes |
| `review-admin@example.com` (temporary second ADMIN, user id 29481) | local DB, directly | yes |
| Team "Review FC" (id 5918, captain 29477) with the captain's membership row and one pending join request from 29478 | created in the app / local DB | yes (rows first, then the team, then the users) |
| `/sdcard/ui.xml` on the emulator (UI dumps) | emulator | yes |

After cleanup: one ADMIN account (yours, id 1), 27 users, 7 teams, 4 venues, no user whose email starts with `review-`. Your admin account and `scripts/createAdmin.js` were not touched. The emulator was on the Login screen when I started and is on the Login screen now. No migrations were run; no code or docs other than this file were changed. Screenshots and helper scripts live only in my temporary scratch folder, outside the repository.
