# Decisions

One entry per real decision. Newest at the bottom. If a decision changes, add a new entry that replaces the old one. Don't delete history.

---

### 2026-11-17: Improve the existing app step by step, no rewrite
**Why:** The app already works. Small, tested changes are safer and teach more than starting over.
**Alternatives considered:** Full rewrite (rejected: high risk, and the working features would be lost for weeks).

### 2026-11-17: Fix security issues before new features or deployment
**Why:** The audit found an account-takeover bug (password reset token injection) and leaked secrets. Real users can't be invited until these are fixed.

### 2026-11-17: Source code is the source of truth
**Why:** The project had little documentation, and docs can drift. When docs and code disagree, the code wins, and the doc gets fixed.

### 2026-11-17: `docs/ROADMAP.md` is the task tracker
**Why:** Solo developer. One checklist in the repo is simpler than GitHub Issues for now. Can revisit later.

### 2026-11-17: Every change gets a plain-language explanation and, for backend changes, a test
**Why:** The owner relies on Claude Code to write the code, so explanations and tests are how changes get checked.

### 2026-11-17: v1.0 scope is the current app made secure and polished, plus a short list of additions
The additions are profile editing, the join request flow, venue discovery, account deletion, basic in-app notifications and UI improvements. Full scope is in `docs/PRODUCT.md`.
**Why:** Ship sooner with fewer open questions and get real user feedback.
**Alternatives considered:** Including challenges and matches in v1.0 (rejected: too many open decisions, delays launch).

### 2026-11-17: Challenges, match scheduling and results move to v1.1

### 2026-11-17: Out of scope: tournaments, venue booking, payments, real-time chat, advanced stats, iOS
Venue booking is explicitly not a core feature.
**Why:** This is a community app, not a booking app.
_Partly replaced on 2026-11-18. See "Venue booking and owner tournaments are planned for later versions"._

### 2026-11-17: Basic in-app notifications are required in any release where a flow waits on another person
This covers invites and join requests now, and challenges and results later.
**Why:** Without them these flows feel broken.

### 2026-11-17: Account deletion is part of v1.0
**Why:** Google Play requires in-app account deletion for apps with account creation.

### 2026-11-17: Android is the first release target; iOS later

### 2026-11-17: Keep the current stack (React Native, Express, Prisma, PostgreSQL)
A change is allowed only if it's justified and approved.

### 2026-11-17: No database resets, destructive migrations or new dependencies without explicit approval

### 2026-11-17: Security fixes run in parallel with product planning, not after it
**Why:** The critical bugs don't depend on product decisions, and the backend is publicly reachable whenever ngrok is running.

### 2026-11-17: Approved business rules are recorded in `docs/PRODUCT.md`

### 2026-11-17: Team membership rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Team membership". In short:
- Invites and join requests don't expire. Either side can cancel what they sent.
- One pending or active membership per player per team. An invited player sees "Accept invite" instead of "Request to join". Rejected players can request again.
- Members can leave at any time. The captain must transfer captaincy before leaving. If the captain is the only member, leaving deletes the team.
- One captain per team; no other team roles.
- At most 15 accepted members per team (captain included). Pending items don't count. No limit on how many teams a player joins.

**Why:**
- No expiry: avoids timers and background jobs. Cancelling covers stale items, and expiry is easy to add later if needed.
- Cancelling: cheap to build and avoids stuck items.
- Single captain: matches the existing code and keeps permissions simple.
- 15 members: futsal is 5-a-side, so 15 covers three full lineups. It's a single setting if it needs to change.
- Rejected players can re-request: low abuse risk in v1.0. A cooldown can be added later.

**Alternatives considered:** auto-expiry after a set number of days (deferred), vice-captain roles (deferred), a cooldown after rejection (deferred).
**Consequence:** the data must record whether a pending membership is an invite or a join request. This needs a schema change, which needs approval first.

### 2026-11-17: Account deletion rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Account deletion". In short:
- Settings → Delete account → re-enter password → confirm → deleted immediately (no grace period).
- Full deletion of the user, their profile, memberships, and pending invites and requests they sent or received.
- A captain's teams pass automatically to the longest-standing accepted member. A team with no other members is deleted.
- A venue owner's venue disappears from discovery.
- The same email can register again.
- A web deletion page with email confirmation (built in the deployment phase).
- Admin deletion uses the same rules and the same shared deletion logic.

**Why:**
- Password re-entry: stops someone with access to an unlocked phone from deleting the account.
- Immediate deletion: a grace period needs a scheduled cleanup job. It can be added later.
- Full deletion: v1.0 has no match history to keep. Revisit in v1.1, when match results exist.
- Automatic captaincy transfer: forcing captains to transfer every team by hand adds friction, and Google Play expects deletion to be easy.
- Shared deletion logic: one tested code path instead of several, which also fixes the half-finished deletes found in the audit.

**Alternatives considered:** a grace period of about 14 days (deferred), blocking deletion until captains transfer their teams (rejected: friction), anonymising instead of deleting (not needed in v1.0).

### 2026-11-18: Profile visibility rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Profile visibility". In short:
- Only logged-in users can see profiles.
- Public to logged-in users: name, position, optional height and weight, teams, and area.
- Phone: accepted teammates and the admin only. Email: the user and the admin only.
- The player address field becomes "Area", with a hint not to enter a full address.
- Venue listings are visible to all logged-in users. The owner's email stays hidden.
- The admin sees everything.
- The backend filters the fields. Hiding them only in the app isn't enough.

**Why:**
- The public fields are enough for captains to choose who to invite.
- Teammates need the phone number to coordinate, since there's no chat in v1.0. Strangers don't.
- Email is for logging in and account emails, not for contacting people.
- A general area is useful for finding nearby players. A full home address doesn't belong in a community app.
- The backend has to filter, because anything it sends can be read even if the app doesn't show it.

**Alternatives considered:** an on/off setting for showing the phone to teammates (deferred), keeping the full address field (rejected: privacy).
**Consequence:** renaming the address field is a schema change and needs approval. Existing values are kept.

### 2026-11-18: Venue owner rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Venue owners". In short:
- One venue per owner account.
- Editable fields: the existing ones (name, address, phone, website, description), plus area and two optional text fields, opening hours and pricing info. No photos.
- New venues are "Pending review" until an admin approves them. Only approved venues appear in discovery.
- Owners see public information read-only, and can't create or join teams.
- An owner who wants to play uses a separate player account.
- Players can search venues by name and filter by area.

**Why:**
- Keep owner features basic in v1.0. A full owner system comes in later versions.
- Hours and pricing as plain text answer players' first questions without building a booking system.
- No photos: they need file storage and moderation.
- Admin review: stops fake or joke venues from showing up in a core feature.
- One role per account: supporting two roles would change login, navigation and permissions everywhere.

**Alternatives considered:** no review, with the admin deleting bad listings afterwards (rejected: users would see junk first), accounts with more than one role (rejected for v1.0), venue photos (deferred).
**Consequence:** new owner profile fields and an approval flag are schema changes and need approval. Existing venues are treated as approved.

### 2026-11-18: Venue booking and owner tournaments are planned for later versions
This replaces the earlier "venue booking is not a core feature" part of the 2026-11-17 scope decision. The planned direction for later versions (after v1.1, not scheduled) is real-time venue booking, owner-run tournaments, owner announcements, owners creating their own teams, venue photos and multiple venues per account. Payments, chat and advanced stats stay out of scope for now.
**Why:** The owner plans to build a proper system for venue owners once the community core is launched.
**Consequence:** the v1.0 design shouldn't block these features, but shouldn't build for them early either. For example, venues will probably move into their own table when booking arrives.

### 2026-11-18: Notification rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Notifications". In short:
- One Notifications screen with "Needs your action" (invites, join requests) and "Updates" (approved or rejected, accepted or declined, removed, became captain, team deleted, venue approved). A number badge counts pending actions plus unread updates.
- Refreshes when the app opens or comes back into view, when the screen opens, and on pull-to-refresh. Not real-time.
- The most recent 50 updates are shown.
- No push notifications in v1.0 (planned for v1.1). No email notifications.

**Why:**
- In-app only keeps v1.0 smaller: no Firebase, no device tokens, no new dependency.
- A delay of a few minutes is fine for invites and requests.
- Push fits v1.1, where challenges and results are time-sensitive.
- Email for every event is noisy, and personal Gmail has sending limits.

**Trade-off accepted:** a user who doesn't open the app won't see pending items until they do.
**Alternatives considered:** push in v1.0 (deferred to v1.1: delays launch), real-time updates (rejected: complexity), email notifications (rejected).
**Consequence:** a new notifications table is needed (a schema change that needs approval).

### 2026-11-18: Administration and moderation rules for v1.0
Full rules are in `docs/PRODUCT.md` under "Administration and moderation". In short:
- The admin can approve venues, suspend or unsuspend users, and handle reports, on top of the existing powers. No editing other users' text.
- A Report button on players, teams and venues, with reasons and an optional note. One report per user per item.
- A Reports screen for the admin, with dismiss, suspend or delete actions.
- A Block button on player profiles. Blocking is silent and stops invites, join requests and seeing each other in lists. Unblock from Settings.
- A required Terms of Use and Privacy Policy checkbox at registration.
- A dedicated support email address.
- One admin, created by the script.

**Why:**
- Google Play requires apps with user-generated content to have Terms of Use, in-app reporting, and in-app blocking. Profiles, team names and venue listings count as user-generated content.
- Suspending is reversible and keeps the data. A deleted user can sign up again, so deletion alone doesn't stop a troublemaker.
- No admin text editing keeps v1.0 smaller. Delete and suspend cover the cases.

**Alternatives considered:** admin editing of offensive text (deferred), multiple admins (deferred), telling blocked users they were blocked (rejected: can cause conflict).
**Consequence:** schema additions for suspension, reports and blocks (need approval). A support email address has to be created before launch.

### 2026-11-18: Add an "accepted at" date to team memberships
"Longest-standing member" (used for automatic captaincy handover) means the earliest accepted date. Existing accepted members get `joinedAt` copied in. Ties go to the lower membership id.
**Why:** `joinedAt` records when the invite or request was created, not when the player actually joined. Without a real accepted date, the handover rule can't be applied correctly.
**Alternatives considered:** using `joinedAt` (rejected: wrong whenever someone accepted long after being invited).
**Consequence:** a schema change (needs approval). It goes in the same migration as the invite/request field.

### 2026-11-18: The captain is stored in one place only (`Team.captainId`)
`Team.ownerId` becomes the single record of the captain, renamed to `captainId`. The "captain" member role is removed.
**Why:**
- A single field can only hold one captain, so a team can never end up with zero captains or two.
- A transfer is one update instead of two that must stay in sync.
- The rename removes the confusing second meaning of "owner" (venue owner vs team creator).

**Alternatives considered:** keeping both copies and always updating them together in a transaction (rejected: the risk of them disagreeing stays forever).
**Consequence:** a careful, tested change to existing team code and the schema, made during the Phase 4 membership work (needs approval). Until then, any captaincy change must update both places in one transaction.

### 2026-11-18: Navigation and language for v1.0
- Bottom tabs. Player: My Teams · Explore · Notifications · Profile. Owner: My Venue · Explore · Notifications · Profile. Admin: Dashboard · Reports · Venues · Users · Teams.
- Explore has Teams · Players · Venues sections with search. It's read-only for owners.
- Settings sits behind a gear icon on Profile, with Delete account last.
- English only in v1.0.

Details are in `docs/PRODUCT.md` under "App structure and navigation".
**Why:**
- The current design hides the main features behind buttons on the Profile screen.
- Four tabs keep the main actions one tap away, and leave room for a Matches tab in v1.1 without a redesign.
- English only: supporting Bangla means making all text translatable and testing every screen in two languages, which is a real cost for v1.0.

**Alternatives considered:** five player tabs (Teams · Players · Venues · Notifications · Profile) (rejected: no room for Matches later), Bangla support in v1.0 (deferred).

### 2026-11-18: Visual design for v1.0 is "Floodlight", built on theme tokens
Dark background (`#0E1116`), slightly lighter cards (`#171B22`), a neon-lime accent (`#C6F432`), Barlow Condensed uppercase headings and Inter for body text. Full spec: `docs/DESIGN.md`.
All colors, fonts, sizes, spacing and radii live in one theme module as tokens. Screens never use raw values, and repeated pieces are shared components.
**Why:**
- The owner chose Floodlight from five mockup directions. It suits evening indoor futsal.
- The owner wants to be able to change the look later. Tokens mean a new palette or a light theme is an edit to one module, not to every screen.

**Alternatives considered:** Clean Club (light, green), Matchday (cream, orange, navy), Cream & Ink (cream, black, burnt orange), Ice & Steel (ice blue, graphite, flame orange). These are kept on the design canvas for possible later use.
**Consequences:**
- Dark only in v1.0, with no theme switching.
- Text on lime or on the red badge is always dark, for readability.
- Fonts are added as files. An SVG icon library is a new dependency and needs approval.

### 2026-11-18: Existing code is not a constraint
The original code was written as a university project and has many flaws. Any part of it can and should be replaced wherever it conflicts with the current plans (PRODUCT.md, DESIGN.md, these decisions).
This clarifies the 2026-11-17 "no rewrite" decision. There's still no big-bang rewrite of the whole app at once: work stays task by task, tested, with small commits. But when a task touches flawed code, replace it properly rather than patching around it.
**Why:** keeping weak code just because it exists would carry its problems into the real app.

### 2026-11-18: Icons use Lucide (`lucide-react-native` + `react-native-svg`)
This replaces the existing `react-native-vector-icons` (Ionicons), which will be removed once nothing uses it.
**Why:** Lucide is the widely used, actively maintained standard for line icons. It's one consistent style with 1,000+ icons, and it matches the Floodlight line-icon spec (24px, rounded strokes). `react-native-svg` is the standard SVG renderer for React Native.
**Alternatives considered:** keeping Ionicons outline (rejected by the owner: wanted the standard best fit, not whatever was installed), Feather (fewer icons; Lucide is its maintained successor), Phosphor (good, but less common).
**Consequence:** two new dependencies, approved by the owner. Claude Code checks version compatibility before installing.

### 2026-11-18: Theme structure
`src/theme/` holds palette.js, colors.js, typography.js, spacing.js, radius.js, shadows.js, index.js and ThemeProvider.js (with `useTheme()`). Shared components live in `src/components/ui/`. Details are in DESIGN.md section 2.
**Why:**
- Two color layers (palette and meanings) let the look change by remapping colors.
- `useTheme()` from the start means a future light/dark switch needs no screen edits.
- The `Icon` wrapper means the icon set can change in one file.

**Consequence:** the status bar is always light in v1.0, whatever the phone's setting.

### 2026-11-18: Registration keeps saying "Email already registered"
**Why:** Hiding it (always replying "check your email" and emailing the real owner) confuses users who mistype or forget they signed up. Once rate limiting is in place, checking emails in bulk becomes impractical, so the remaining risk is small. Most community apps make this trade-off.
**Alternatives considered:** always replying "check your email" (rejected for v1.0, can revisit).
**Note:** login already gives the same reply for an unknown email and a wrong password.

### 2026-11-18: Security packages `helmet` and `express-rate-limit` are approved
`helmet` sets protective HTTP headers. `express-rate-limit` limits repeated requests to login, register, forgot-password and reset.
**Why:** both are the standard, widely used choices for Express. Rate limiting stops password guessing and email spamming, and makes bulk email checks impractical.
**Consequence:** two new backend dependencies, approved by the owner.

### 2026-11-19: Rate limits tuned for shared mobile IP addresses
Login counts only failed attempts, limited per IP + email (10 per 15 min) with a looser per-IP cap (50 per 15 min). Register is 20 per hour per IP. Forgot-password is per IP + email (5 per hour) with a per-IP cap (20 per hour). The reset page and verify link get 30 per 15 min per IP.
**Why:** mobile carriers in Bangladesh often put many phones behind one shared IP, so strict per-IP limits could block real groups of users. Counting only failures and keying by email keeps the protection against password guessing and email spam while letting real users through.
**Alternatives considered:** strict per-IP limits (rejected: blocks groups on shared mobile IPs).

### 2026-11-19: Tokens are stored hashed, verification links expire after 24 hours, and resend is added
The email link carries a random token; the database stores only its SHA-256 hash. Verification links expire after 24 hours, and a "resend verification email" option exists (endpoint plus a button on the login screen). Reset and resend emails have a 5-minute cooldown per account.
**Why:**
- If the database ever leaks, hashed tokens can't be used as working links.
- Links that never expire stay dangerous forever. Expiry needs a way to get a new link, hence resend.
- The cooldown caps how many emails one inbox can receive, however many addresses an attacker uses, without locking anyone out (the user still has the earlier email).
- SHA-256 rather than bcrypt: the tokens are long and random, so a fast hash is safe and allows direct lookup.
**Consequence:** one additive schema change (verifyTokenExpires, token indexes), approved by the owner. Existing tokens were converted in place, so existing links keep working.

### 2026-11-20: zod is approved for request validation
Installed in Task 3.2, after a version-compatibility check.
**Why:** one schema per endpoint checks types, required fields and lengths in one place, and closes the whole "objects in Prisma `where` clauses" class of bugs. zod is the widely used standard.
**Alternatives considered:** keeping hand-written checks (inconsistent and easy to forget), joi or express-validator (fine, but zod is the more common choice today).
**Consequence:** one new backend dependency, approved by the owner.

### 2026-11-20: Login lasts 30 days, with token revocation
Built in Task 3.3. Each login token carries the user's token version (a new `tokenVersion` number on User). Bumping that number logs the account out on every device. Exactly which events bump it is decided in Task 3.3.
**Why:** phone users shouldn't be logged out every week. Revocation makes a longer token safe, because a stolen or old token can be cancelled.
**Alternatives considered:** refresh tokens (rejected for now: two tokens, rotation and storage are more moving parts than v1.0 needs), 7 days with no revocation (the current state: a stolen token can't be cancelled).
**Consequence:** an additive schema change (needs approval in Task 3.3), and `verifyToken` does one database lookup per request.

### 2026-11-20: Phase 3 roadmap reshuffle
- Schema enums and `onDelete: Cascade` move to the start of Phase 4, in the same migration as the membership changes. **Why:** they touch the same tables, so it's one migration instead of two.
- Migration-history cleanup and CI (GitHub Actions) move to Phase 5. **Why:** the history is best cleaned up just before the first real production database exists. CI needs remote setup that the owner does, and the tests currently need a running local server and database.
- Pagination and owner website-link validation move to Phase 4. **Why:** pagination belongs with the new Explore lists, and website validation with the Edit My Venue screen.

### 2026-11-20: Shorter registration
Built in Phase 4, together with profile editing. Full rules are in `docs/PRODUCT.md` under "Registration".
- Player sign-up: name, email, phone, position, password, confirm password, Terms checkbox. Height, weight and Area are no longer asked at sign-up. They're filled in later on Profile → Edit. Phone and position can be changed there but not left blank.
- Owner sign-up: venue name, email, password, confirm password, Terms checkbox. The rest of the listing (address, area, phone, website, description, opening hours, pricing info) is filled in on My Venue.

**Why:** fewer fields means more people finish signing up. Phone and position stay because the core flows need them: teammates coordinate by phone (there's no chat in v1.0), and captains decide who to invite by position. Keeping them required means there's never a player with no phone, so no "complete your profile" prompts and no special rules for players without a phone.
**Alternatives considered:** name, email and password only for players (rejected: needs completion prompts, plus rules for joining a team without a phone), keeping the long forms (rejected).
**Consequence:** `OwnerProfile.phone` and `OwnerProfile.address` become optional. That's a schema change in the Phase 4 migration and needs approval. Player phone and position stay required.

### 2026-11-20: Position is a fixed list
Goalkeeper, Defender, Midfielder, Forward, Any. One per player, picked from a list at sign-up and in Edit profile.
**Why:** consistent data, and it makes a position filter possible later. "Any" covers players who play anywhere.
**Alternatives considered:** futsal terms (Fixo, Ala, Pivot) (rejected: less familiar to casual players), free text (rejected: messy, can't be filtered).
**Consequence:** stored as an enum (Phase 4 migration, needs approval). Existing free-text values are mapped: obvious matches (case-insensitive, e.g. "GK" or "goalkeeper" → Goalkeeper, "striker" → Forward) map to their value, everything else to Any. The full mapping is shown to the owner before the migration runs.

### 2026-11-20: A venue can be approved only when its listing is complete
The admin can approve a venue only once its address, area and phone are filled in. The backend enforces this (it refuses the approval), not just the app. While a venue is "Pending review", My Venue shows a checklist of what's still missing. Once approved, editing can change these three fields but can't clear them.
**Why:** with the shorter owner sign-up, a new venue starts as little more than a name. Approval must never put an empty listing into discovery.
**Alternatives considered:** letting the admin judge by eye (rejected: an incomplete venue could go live), also requiring opening hours and pricing (rejected: they stay optional).

### 2026-11-20: Input validation conventions and limits
Every endpoint that reads a request body or query checks it with a zod schema (in `backend/src/validation/`) before the controller runs. The conventions:
- **Unknown fields are ignored** (dropped), not rejected. The app sends a few extra fields (`profileData.name` for players, a top-level `name` for owners), and older app versions must keep working.
- **One error message per reply:** 400 with `{ "error": "<message>" }`, the first problem found. The app shows `error` in an alert, so messages are short and human. Existing messages are kept word for word.
- **Login stays generic:** any badly shaped login request gets the same "Invalid email or password" as a wrong password. Forgot-password and resend-verification keep "Email is required" and their generic replies, with no email-format check.
- **Ids in URLs** keep using `parseId`, not the schemas.
- **New limits at registration:** email must look like an email address, at most 254 characters. Password at most 72 bytes (counted in bytes, also at reset). Player name 2–50 characters, position at most 30, address at most 100, height and weight numbers only. Venue name 2–60 characters, address at most 200, description at most 500, website at most 200. Empty optional fields are stored as null. Character limits count code points, so Bangla text isn't over-counted.

**Why:** the limits protect the database and the screens from huge or malformed values (a 10,000-character name breaks every list it appears in). Checking types closes the whole class of bugs where objects or lists reach Prisma and act as query operators or cause 500s. 72 bytes is where bcrypt stops reading a password, so anything longer gives a false sense of security. Ignoring unknown fields keeps the app working as fields come and go.
**Alternatives considered:** rejecting unknown fields (rejected: breaks the current app, which sends extras), listing every problem in one reply (rejected: the app shows a single alert), detailed login errors (rejected: they reveal which emails have accounts).
**Consequence:** request checks live in one place per router, and controllers read only the checked values (`req.valid`). The register screens still repeat some checks; they need the new limits when they're rebuilt in Phase 4.

### 2026-11-20: Which events log out every device
Bumping an account's `tokenVersion` cancels every login token it has, so every phone logged in to that account is logged out. That happens on exactly three events:
- **Password reset** (built in Task 3.3).
- **Password change while logged in** (applied when that feature is built in Phase 4). The phone that made the change stays logged in, because the reply gives it a fresh token.
- **Suspension** (applied when suspension is built in Phase 4).

Normal "Log out" only removes the token from that phone, as today. There's no "log out of all devices" button in v1.0.
**Why:** a password reset or change often means the old password leaked, so any phone that was logged in with it must be logged out. A suspended user must lose access at once, not when their token expires up to 30 days later.
**Alternatives considered:** a "log out of all devices" button (deferred: not needed for v1.0), logging out every device on normal logout too (rejected: logging out one phone shouldn't affect the others).

### 2026-11-20: Phase 4 order
Phase 4 is built in four steps, in this order:
1. **Team data groundwork** (backend only):
   - 4.1: the captain is stored only in `Team.captainId`.
   - 4.2: membership data: `TeamMember` status as an enum; how each membership started (invite, join request, or the captain creating the team); a real accepted-at date; `onDelete: Cascade` as a safety net.
2. **The new look's foundation** (app only): theme module, fonts, icons, shared components (including the Button loading state), and bottom-tab navigation per role. Existing screens keep working inside the new tabs.
3. **Features, one at a time**, each with its backend and screens built together, and each with a short spec in `docs/features/` first: team membership features → profiles and registration (short sign-up, position list, Area, profile editing, change password) → venues (new fields, approval, search and filter) → account deletion → notifications → moderation → pagination.
4. **Restyle** any old screens that no feature touched.

Database changes come in several small migrations (captain, membership, profiles and venues, notifications, moderation), each needing the owner's approval, instead of one big Phase 4 migration.

**Why:**
- Groundwork first, because later features (transfer captaincy, account deletion, join requests) depend on it.
- The new look before the features, so each screen is built once, already in the new design.
- Small migrations are easier to review and to undo.

**Consequence:** the player position enum moves out of the "schema enums" item and into the profiles and registration migration. The `TeamMember` status enum and `onDelete: Cascade` stay with the membership migration (4.2). This replaces the "one migration" part of the 2026-11-20 "Phase 3 roadmap reshuffle" for the position enum.

### 2026-11-20: The local database is test data
The local development database holds only the owner's own test data. Claude Code may read it and delete or change any rows or accounts whenever a task needs it, without asking first, and always says what it looked at, deleted or changed. Schema changes, migrations and a full reset (`prisma migrate reset`) still need approval: migrations shape the real database later, and a reset also removes the admin account (re-created with `scripts/createAdmin.js`).
This applies only to the local development database. Once real users exist, a production database is never treated this way.
**Why:** the data was created only for development, so there's nothing real to protect. Schema changes, migrations and resets stay gated because they shape the real database later, or remove the admin account.
**Consequence:** the 2026-11-17 rule ("no database resets, destructive migrations or new dependencies without explicit approval") still holds. What changes is that ordinary rows in the local database no longer need approval. Tests still create their own throwaway users and never change existing ones, so they stay independent of the data that happens to be there.

### 2026-11-21: Team membership details for the screens
Decided while writing the team membership feature spec (`docs/features/team-membership.md`). The rules are in `docs/PRODUCT.md` under "Team membership".
- **A full team can't send invites.** When a team has 15 accepted members, the captain can't send new invites: the invite button is disabled with "Team is full (15/15)", and the backend refuses too. (Accepting an invite or approving a request was already blocked when the team is full.)
- **The team page lists every member.** The Members card on Team detail shows every accepted member, with no "See all" link.
- **The captain can edit the team.** The captain can change the team's name and description, with the same rules as creating a team. Added to the v1.0 scope.
- **A join request can carry a short message.** Optional, up to 150 characters (counted like team names, trimmed; blank means no message). Only the captain, the requester and the admin can see it. It's deleted when the request is approved, declined or cancelled. An offensive message is handled by reporting the player (moderation feature).

**Why:**
- A full team that keeps sending invites would only produce invites that can't be accepted.
- A team has at most 15 members, so one card can show them all, and a "See all" screen would be an extra screen for no gain.
- Typos and changed plans happen. Without editing, the only fix is deleting the team and inviting everyone again.
- A message lets the player say who they are ("I play Thursdays with Tanvir"), which helps the captain decide. Deleting it once the request is handled means old messages aren't kept around.

**Alternatives considered:** letting full teams keep inviting (rejected: invites nobody can accept), a short members preview with "See all" as in the mockup (rejected), no join request message (rejected), keeping the message after approval (rejected).
**Consequence:** the message needs one new optional field on `TeamMember`. That's a schema change and needs approval in the backend task.

### 2026-11-21: Team membership feature spec approved
The owner approved `docs/features/team-membership.md`: its three defaults (D1–D3), all of Claude Code's proposals (P1–P20, listed in the spec's section k), and these answers to its open questions:
- **Join requests are blocked when the team is full**, like invites ("Team is full (15/15)"; the backend refuses too).
- **Asking to join a team that already invited you accepts the invite; inviting a player who already asked to join approves the request.** Both are subject to the 15-member limit.
- **The app says "Decline"**, never "Reject", for turning down invites and join requests. PRODUCT.md's wording was aligned. API paths keep `reject`.
- **A removed member can ask to join again, or be invited again, straight away.**
- **The join request message can't be edited.** The player cancels and sends a new request.
- **The team page doesn't show phone numbers.** Teammates see them on Player detail (Explore feature).
- **Every member sees "Leave team"**; for a captain with other members it explains that captaincy must be transferred first. This settles the contradiction between PRODUCT.md's "for everyone, leave team" and the captain rule.
- **The Join requests header shows a plain count**, not the mockup's "2 new" (nothing records which requests were seen).
- **No greeting on My Teams** until the "Salam, Rahim" wording is decided.
- **No admin Team detail screen in this feature.** The admin's Teams tab stays a list with delete.

**Why:**
- Blocking requests to a full team matches the invite rule, so nobody waits on something that can't be approved.
- Auto-accepting or auto-approving when both sides already agreed saves a step and can't surprise anyone: the player wanted in, and the captain wanted them.
- "Decline" is softer than "Reject" for a community app.
- Rejoining after removal follows the same reasoning as "rejected players can re-request" (2026-11-17): low abuse risk in v1.0.
- Not editing messages, not showing phones yet, and no admin screen keep this feature small. Phones belong on Player detail, and an admin team screen fits the moderation feature.

**Alternatives considered:** letting requests to a full team wait for a spot (rejected), "Reject" as the button word (rejected), a cooldown after removal (rejected for v1.0), phones on the team page for accepted teammates (rejected), tracking which requests the captain has seen (rejected: needs a schema change for little gain), an admin Team detail screen now (deferred to moderation).
**Consequence:** the backend task (F1.1) builds exactly the API in the spec, including `TeamMember.message` (schema change, approval still needed when the migration is created).

### 2026-11-22: Profiles and registration details
Decided by the owner before the profiles and registration feature spec (`docs/features/profiles-and-registration.md`). The rules are in `docs/PRODUCT.md` under "Profiles" and "Registration".
- **Area is free text with suggestions.** Players type their area, and common areas are suggested as they type. It's stored as typed (spaces at both ends removed, spaces inside tidied, within a length limit set in the spec). Filtering by area (Explore, venues) ignores upper and lower case and matches part of the text, so "dhanmondi" finds "Dhanmondi 27". The same suggestion list is reused for venue areas in the venues feature. The field tells players not to enter a full address.
- **The Terms of Use and Privacy Policy checkbox moves from the moderation feature into the profiles and registration feature**, because both sign-up forms are rebuilt there.
- **The email can't be changed in v1.0.** It's shown read-only. Changing it later needs a confirmation link sent to the new address and a notice sent to the old one.
- **Phone numbers must look like a Bangladeshi mobile number:** `01`, then a digit from 3 to 9, then 8 more digits (11 digits in all). This applies at sign-up and on edit, on the backend and in the app. Existing test data that doesn't match is listed before any migration or rule change, so the owner can decide what happens to it. (Whether venue phones may also be landlines is an open question in the spec.)

**Why:**
- Free text keeps every real neighbourhood possible ("Mirpur DOHS", "Uttara Sector 10") without maintaining a complete list, while suggestions keep the common names spelled the same way. Matching part of the text, ignoring case, means small differences in how people type an area don't hide them from each other.
- Building the checkbox with the new sign-up forms means the forms are built once, complete, instead of being opened again in the moderation feature.
- Changing an email safely needs a confirmation link and a notice to the old address, otherwise a stolen login could take over the account for good. That's more than v1.0 needs.
- The old rule (any 11 digits) let numbers through that can't be a phone. Every Bangladeshi mobile number has this shape, and teammates rely on the number to reach each other.

**Alternatives considered:** a fixed list of areas to pick from (rejected: can't cover every neighbourhood), plain free text with no suggestions (rejected: the same area spelled many ways), exact-match area filtering (rejected: "Dhanmondi" wouldn't find "Dhanmondi 27"), keeping the checkbox in the moderation feature (rejected: the forms would be rebuilt twice), changing the email in v1.0 (deferred), keeping the 11-digit rule (rejected).
**Consequence:** the phone check and its message change at sign-up, and the new edit endpoints use the same check. The ROADMAP moderation item no longer includes the checkbox.

### 2026-11-22: Profiles and registration feature spec approved
The owner approved `docs/features/profiles-and-registration.md`: its five defaults (D1–D5), all of Claude Code's proposals (P1–P32, listed in the spec's section k), and these answers to its open questions:
- **Venue phones are mobile only**, like players: no landlines in v1.0.
- **The five stored phone numbers that don't match the new rule** (local test data) are changed to valid made-up mobile numbers at the start of the backend task.
- **An owner's Settings row reads "Edit venue"** and opens the venue edit screen.
- **The owner's Profile tab shows the account** (venue name, "Venue owner", email) and links to My Venue.
- **A password change emails a short notice** to the account's address, with no link in it. PRODUCT.md's list of account emails now includes it.
- **The area suggestion list** starts with the spec's list of Dhaka areas, nearby towns and other cities.
- **Messages whose rule changes are replaced** with suitable new ones (the phone message, and "Venue name is required" for owners). Every other existing message keeps its words, as decided on 2026-11-20.
- **Areas and names aren't capitalised automatically.** They're stored as typed.
- **The app's name is written "ConnectArena"**, as the app already shows it. The docs' titles were changed from "Connect Arena".

**Why:**
- Mobile only: small venues mostly answer a mobile, players call from mobiles, and one rule is simpler. Allowing landlines later is only a changed check, no migration.
- Fixing the test phones keeps those accounts usable and means every stored phone matches the rule from the start.
- "Edit venue" says what the row opens; owners have no other profile fields. Showing the account on the owner's Profile tab gives it its own job without repeating My Venue.
- The notice email is how the real owner of a stolen account finds out. It has no link because a link in a "your account changed" email is what phishing copies.
- A message that describes a rule that no longer exists confuses people. Keeping messages word for word was meant to stop accidental changes, not to keep wrong ones.
- Automatic capitals can spoil names like "DOHS".
- "ConnectArena": the owner's preference.

**Alternatives considered:** landlines for venues (deferred), deleting or keeping the non-matching test phones (rejected), "Edit profile" opening the venue editor (rejected), no password-changed email (rejected), keeping the old messages (rejected), automatic capitals (rejected), "Connect Arena" (rejected by the owner).
**Consequence:** the backend task (F2.1) builds exactly the API in the spec. The migration still needs the owner's approval when it's created.

### 2026-11-22: One website rule in the app and the backend
**Decision:** a website is valid when it's `http://` or `https://` (any capitals), then a host name, then an optional port and path, with no spaces and no `user:password@` part. The backend and the app check it with the same pattern (`isWebLink` in `backend/src/utils/links.js` and `IndoorFootballApp/src/utils/links.js`), tested with the same cases. Odd forms that a URL parser accepts, like `http:arena.com` or `https:/arena.com`, are refused. This replaces the first version of spec P18, which parsed the text with `new URL(...)`.

**Why:**
- The app checks websites before sending them and before opening them, and its answer must match the backend's. On the phone, React Native's URL doesn't really parse links (it accepts anything, keeps "HTTP:" in capitals and can't find the host of "HTTP://Arena.com"), so the same `new URL` code would answer differently on the phone than in the tests.
- The odd forms aren't what "starts with http:// or https://" (the backend's message) promises, and a link with a `user@` part can look like it goes to one site while it opens another.

**Alternatives considered:** keeping `new URL` in the app as the spec said (rejected: different answers on the phone), a stricter app check with the backend left as it was (rejected by the owner: the two could disagree).
**Consequence:** no stored website was affected (none were set in the local database on 2026-11-22). A future change to the rule must change both files and both tests.

### 2026-11-23: Venue details
The owner's decisions for the venues feature (Phase 4, Step 3, feature 3):
- **Edits after approval stay live.** An approved venue doesn't go back to review when the owner edits it (the address, area and phone still can't be cleared, decided 2026-11-20). Bad edits are handled through reports (moderation feature), by moving the venue back to review (below), or by deleting or suspending the owner.
- **The admin can leave a short note on a pending venue** (for example "Please add the road number"). The owner sees it on My Venue while the venue is pending. **There's no rejected state:** a venue stays pending until it's approved.
- **The admin can move an approved venue back to "Pending review"**, hidden from players again, with a short note saying why (for example the venue closed, or the listing became misleading). The owner sees the note on My Venue, fixes the listing, and the admin approves it again.
- **Scope split.** The venues feature covers the new venue fields (area, opening hours, pricing info), admin approval with notes and moving back to review, the missing-fields checklist, the venue list with search by name and an area filter, and a new Venue detail screen. The Teams and Players sections of Explore (with search) and Player detail become a separate **feature 3b**, built right after it.

**Why:**
- Sending every edit back to review would hide a real venue each time it fixes a typo or changes its hours; the admin already has stronger tools for the rare bad edit.
- A note tells the owner exactly what to fix, without a rejection that ends the conversation.
- Moving a venue back to review is gentler than deleting the owner's account, and reversible.
- Splitting Explore keeps each feature small: venues first, because the approval flow changes what discovery shows.

**Alternatives considered:** re-review after every edit (rejected), a rejected state with a reason (rejected: a pending venue with a note does the same job), only deleting the account for a bad live listing (kept, but no longer the only tool), building all of Explore in this feature (split instead).
**Consequence:** the feature spec is `docs/features/venues.md`. Its data changes (new venue fields, how approval and the note are stored) need the owner's approval in the backend task.

### 2026-11-23: Venues feature spec approved
The owner approved `docs/features/venues.md`: its five defaults (D1–D5), all of Claude Code's proposals (P1–P23, listed in the spec's section k), and these answers to its open questions:
- **The three existing venues get an area before the migration.** They're fake test venues, so Claude Code picks the areas itself at the start of the backend task (F3.1) and says which rows changed. Every existing venue is then complete and treated as approved.
- **No pagination in this feature.** The venue list returns every live venue; the pagination item changes all lists together, with feature 3b.
- **The admin's "Pending venues" screen is the "Waiting for review" section** at the top of the Venues tab, not a separate screen.
- **Moving a venue back to review notifies the owner** ("Your venue was moved back to review", with the note), built by the notifications feature. PRODUCT.md's events list includes it.
- **A venue can't be approved while its owner hasn't verified their email.**

**Why:**
- Filling in the test venues keeps them visible (as PRODUCT.md wants) and keeps the rule that a live venue is always complete, with no special case in the code.
- Paginating one list early would give the lists two different shapes until the pagination item.
- One place for every venue, with the queue on top, is simpler for the admin; the Dashboard links straight to it.
- A venue that disappears from discovery should be explained to its owner, as approval is.
- An owner who never verified can't log in, so a live listing couldn't be corrected.

**Alternatives considered:** existing venues staying live while incomplete, or going back to pending (rejected); paginating the venue list now (deferred); a separate Pending venues screen (rejected); no notification for moving back (rejected); letting the admin approve unverified owners (rejected).
**Consequence:** the backend task (F3.1) builds exactly the API in the spec. The `venues` migration still needs the owner's approval when it's created.

### 2026-11-23: Explore details
The owner's decisions for feature 3b (Explore: Teams and Players, and Player detail), made after the independent review of 2026-11-23 (its findings 3 and 4). The rules are in `docs/PRODUCT.md` under "App structure and navigation", "Team membership" and "Profiles".
- **Teams get an optional Area.** The captain sets it on the team form (when creating or editing the team), with the same rules, tidying and suggestion list as the player Area. Existing teams start without one. Explore → Teams filters by area.
- **Explore → Players has search by name plus filters by area and by position.** All three can be combined.
- **Full teams (15/15) stay listed in Explore → Teams, marked "Full".** Teams with free spots are listed first.
- **Paging is built into the Explore lists from the start.** The separate "Pagination on list endpoints" roadmap item is covered by this feature.

**Why:**
- "Near me" is the first thing a player asks, and "a goalkeeper in Mirpur" the first thing a captain asks. Without an area on teams and filters on players, Explore is a list of every team and player in the country (review finding 3). Venues already filter by area; teams and players now match.
- The position list was made a fixed list partly so a position filter would be possible (2026-11-20, "Position is a fixed list").
- A full team can have a free spot again tomorrow, and players still look teams up by name. Listing teams with free spots first keeps the teams a player can actually join at the top.
- Feature 3b is where the list endpoints and screens get their final shape. Building them without paging and reopening every list, screen and test a few features later would be double work (review finding 4).

**Alternatives considered:** search by name only, with no team area (the plan before the review; rejected), hiding full teams from the list (rejected), a separate pagination item after moderation (the earlier order; rejected: double work).
**Consequence:** `Team.area` is a schema change and needs the owner's approval in the backend task. The feature spec is `docs/features/explore.md`; everything in it beyond these four decisions is a proposal until the owner approves it.

### 2026-11-23: Explore feature spec approved
The owner approved `docs/features/explore.md`: its five defaults (D1–D5), all of Claude Code's proposals (P1–P31, listed in the spec's section k), and these answers to its open questions:
- **The Invites screen doesn't change.** "Position · Area" goes on Team detail's rows (Members, Join requests, Invited), Invite players and Explore → Players. The Invites screen shows a team and its captain's name, not a player row.
- **The position filter is exact.** "Goalkeeper" lists goalkeepers only; players who chose "Any" are found with the "Any" filter.
- **Players who haven't verified their email aren't listed** in Explore → Players or in a captain's invite search. Their Player detail page still opens.
- **The admin's lists don't get paging in this feature.** The "Pagination on list endpoints" item is ticked when feature 3b is done; paging and search for the admin's Users, Teams and Venues lists is a new item under Moderation, built when that feature reworks the Users tab.
- **A player who has asked to join shows as "Asked to join" on Player detail's invite card**, with no button. The captain approves the request on Team detail.

**Why:**
- The player decides about an invite by the team, which the invite card opens; the captain's own position adds little.
- An exact filter is predictable. Most accounts choose "Any", so adding them to every position filter would make the filter nearly useless. Widening it later is a small change.
- An unverified account can't log in, so it can't accept an invite, and anyone can sign up with someone else's email. It's the same idea as not approving a venue whose owner hasn't verified (2026-11-23, "Venues feature spec approved").
- One admin can live with full lists at launch size, and the moderation feature rebuilds the Users tab anyway. Step 4 (restyle without changing behaviour) is the wrong place for paging.
- The captain usually reaches a requester's page from the Join requests card, one Back away, and Invite players already leaves requesters out for the same reason.

**Alternatives considered:** the captain's position and area on the invite card (rejected), position filters that also list the "Any" players (rejected for now), listing unverified players as today (rejected), paging the admin endpoints in this feature (deferred to moderation), an Approve button on Player detail (deferred).
**Consequence:** the backend task (F3b.1) builds exactly the API in the spec. The `team_area` migration still needs the owner's approval when it's created.

### 2026-11-25: Account deletion details
The owner's decisions for the account deletion feature (Phase 4, Step 3, feature 4), made before its spec. The rules are in `docs/PRODUCT.md` under "Account deletion".
- **The web page for deletion requests (Google Play) stays in Phase 5.** This feature is deletion inside the app plus admin deletion. The shared deletion logic is built so that the web page can reuse it unchanged.
- **A short notice email goes to the address after an account is deleted** ("Your ConnectArena account was deleted"), with no link in it. It's sent after the deletion succeeds. If sending fails, the deletion stands and the error is logged.
- **A handed-over team keeps its pending invites and join requests.** They belong to the team; the new captain can cancel the invites and answer the requests.

**Why:**
- The web page needs the real domain and the new email provider, which Phase 5 brings. Writing the logic once, for every caller, means the page adds only its own email link and form.
- The notice is how the real owner of an account finds out if someone else deleted it, like the password-changed notice (2026-11-22). No link, because a link in a "your account changed" email is what phishing copies. An email problem must never undo or block a deletion.
- The captain invites for the team and receives requests for the team. Dropping them because one person left would surprise the invited players, the requesters and the new captain.

**Consequence:** this narrows the 2026-11-17 "Account deletion rules for v1.0" line "pending invites and requests they sent or received": for a team that's handed over, the invites its captain sent and the requests its captain received stay. PRODUCT.md's list of account emails now names the notice and the web page's confirmation link separately.

### 2026-11-25: Account deletion feature spec approved
The owner approved `docs/features/account-deletion.md`: its five defaults (D1–D5), all of Claude Code's proposals (P1–P21, listed in the spec's section k), and these answers to its open questions:
- **A deletion is refused when a team's outcome changed since the preview.** The user sees the new outcome and confirms again.
- **The deletion locks every team where the user has a row** (member, invite or request), not only the captained ones, then the user's own row.
- **The notice email also goes out when the admin deletes an account**, with the same text.
- **The notice goes only to a verified address.** This narrows the decision of the same day ("goes to the address").
- **Log out on Settings becomes a secondary button**, so Delete account is the only red one. This replaces "Log out (danger)" in the profiles and registration spec.
- **In the admin's Users tab only the delete confirmation changes** in this feature, plus the trash button that goes from ADMIN rows (P21). Moderation rebuilds the tab.
- **The account emails list names the deletion confirmation link (web page) and the account-deleted notice separately.**

**Why:**
- The screen promises exactly what will happen, so a team must never go to someone the user didn't see.
- A team where the user is only a member can make them captain while they're being deleted. With only the captained teams locked, the delete then fails with a server error (tried on 2026-11-25).
- The account's owner should know about a deletion, whoever did it.
- Anyone can sign up with someone else's email, so an unverified address may be a stranger's.
- Red should mean "this destroys something", and two red buttons together invite a mis-tap.
- Rebuilding the Users tab now would be done again in moderation, which adds paging, search and suspension.

**Alternatives considered:** deleting by whatever the state is at that moment (rejected), locking only the captained teams (rejected), no notice for admin deletions (rejected), the notice to every address (rejected), keeping Log out red (rejected), rebuilding the Users tab now (deferred to moderation).
**Consequence:** the backend task (F4.1) builds exactly the API in the spec. No migration is needed.

### 2026-11-26: Notification details
The owner's decisions for the notifications feature (Phase 4, Step 3, feature 5), made before its spec. The rules are in `docs/PRODUCT.md` under "Notifications".
- **Captains get an update when a member leaves their team** ("X left your team"). A player cancelling a join request creates no update: it just disappears from "Needs your action".
- **When a team is deleted** (by its captain, by the admin, or because its last member deleted their account), **the update goes to its accepted members and to everyone with a pending invite or join request for it.**
- **Each user keeps only their newest 50 updates.** When a new update is added, anything beyond that user's newest 50 is removed in the same step. There's no scheduled job.

**Consequences:**
- "A member left your team" is a new event in PRODUCT.md. It replaces the "no update for leaving" line in the team membership spec (section g).
- The deleted-team update now reaches people who were never in the team. It replaces "every other accepted member" in the team membership spec and "nobody to tell" in the account deletion spec (both section g).
- PRODUCT.md's "automatic cleanup of old ones can come later" is replaced by the 50-update rule.
- The feature spec is `docs/features/notifications.md`. The notifications table is a schema change and needs approval in the backend task.

### 2026-11-26: Notifications feature spec approved
The owner approved `docs/features/notifications.md`: its five defaults (D1–D5), all of Claude Code's proposals (P1–P34, listed in the spec's section k), and these answers to its open questions:
- **When an account is deleted, the updates other users keep that name that player are deleted too.**
- **When a member's account is deleted, the captain gets an update without a name** ("A member left your team {team}.").
- **The last member leaving counts as the captain deleting the team**, so players with a pending invite or join request are told.
- **An approved venue's update says** "{venue} was approved. Players can find it now."
- **Team detail says "This team isn't available any more."** like Player and Venue detail, wherever it's opened from. This replaces the alert in the team membership spec.
- **Venue updates are created in the same transaction as the approval or the move back to review**, with the owner's row locked first. This replaces the venues spec's "after the successful update".
- **A deleted team's name is shown in its update**, whatever the reason for the deletion. Moderation may revisit it.
- **The badge refreshes at D4's moments and at PRODUCT.md's**, together.

**Why:**
- Account deletion is a full deletion, "not hiding or anonymising" (PRODUCT.md), so a deleted player's name can't stay in other people's updates. The captain should still know that the team got smaller.
- A lone captain who leaves deletes the team, so it's the same event for the people waiting on it.
- "Approved" follows PRODUCT.md, and the second sentence says what it means. One "isn't available any more" message is simpler than two.
- In one transaction an action and its update can't come apart. Locking the owner first was tried on 2026-11-26: without it, an approval and the owner deleting their account deadlock, and one fails with a server error.
- A deleted team's members already know its name, and without it the update is useless in the normal case.

**Alternatives considered:** keeping deleted players' names, or replacing them with "A player" (rejected); no update, or a named one, for a deleted member (rejected); no update when the last member leaves (rejected); "{venue} is live" (rejected); keeping Team detail's alert (rejected); the venue update outside the transaction (rejected); hiding the name of a team the admin deletes (rejected for now).
**Consequence:** the backend tasks (F5.1, F5.2) build exactly the data and API in the spec. The `notifications` migration still needs the owner's approval when it's created.
