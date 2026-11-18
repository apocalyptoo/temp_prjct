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
