# Connect Arena: Product Requirements

What the app should do, what's in each release, the approved business rules, and the decisions that are still open. How the app works *today* is in [ARCHITECTURE.md](ARCHITECTURE.md). The task list is in [ROADMAP.md](ROADMAP.md). The reasons behind decisions are in [DECISIONS.md](DECISIONS.md).

---

## What Connect Arena is

A football community app for indoor football (futsal) players in Bangladesh. Players build profiles, form and join teams, and discover indoor venues. Android first.

## Roles

- **PLAYER:** the main user. Plays, joins and runs teams.
- **OWNER:** an indoor venue owner. Has a venue listing that players can discover.
- **ADMIN:** manages users, approves venues, and moderates.

**Two meanings of "owner":**

- `Role.OWNER` is a **venue owner** (a type of account).
- The player who creates a team is its **captain**. The code uses the same word (`Team.captainId`).

## v1.0 scope

What exists today, made secure and polished, plus:

- Player and venue owner registration with a short sign-up form (see "Registration"), email verification, login, persistent login
- Profile editing (players and venue owners)
- Change password while logged in
- Account deletion inside the app, plus a web page for deletion requests (both required by Google Play)
- Player discovery, with privacy rules for what's visible to whom
- Team creation, discovery and management, with multiple team memberships
- Captain can edit the team's name and description
- Captain invitations and player join requests, with captain approval
- Leaving a team and transferring captaincy
- In-app notifications: a Notifications screen with a badge, covering actions needed and updates (no push)
- Venue discovery (search by name, filter by area) and basic venue listing management
- Admin review of new venues before they appear in discovery
- Moderation (required by Google Play for user-generated content): reporting, blocking, Terms of Use acceptance, and admin suspension and report handling
- Security and privacy fixes
- UI and visual improvements

## v1.1 scope (planned, not built in v1.0)

- Team-to-team challenges and responses
- Match scheduling, cancellation, results and history
- Push notifications (phone alerts when the app is closed), since challenges and results are time-sensitive
- Other features to be decided later

## Later versions (planned direction, not scheduled)

Not in v1.0 or v1.1. Recorded so today's work doesn't block them.

**For venue owners**
- Real-time venue booking
- Owners publishing and running tournaments
- Owners posting announcements
- Owners creating their own team
- Venue photos
- Multiple venues per owner account

**Other**
- iOS release

_Design note:_ in v1.0 a venue is stored as part of the owner's profile (one venue per account). Booking, tournaments and multiple venues will most likely need venues to become their own table. That change is fine to make when those features arrive. Don't build for it now.

## Out of scope (no current plans)

Payments, real-time chat, advanced rankings and statistics. Any of these can move into "Later versions" if plans change (payments may come with booking).

## App structure and navigation (v1.0)

The current app puts only Profile and Settings in the bottom bar, and hides everything else behind buttons on the Profile screen. v1.0 replaces that with a proper bottom tab bar for each role.

| Role | Bottom tabs |
|---|---|
| Player | **My Teams · Explore · Notifications · Profile** |
| Venue owner | **My Venue · Explore · Notifications · Profile** |
| Admin | **Dashboard · Reports · Venues · Users · Teams** |

- **My Teams (player):** the player's teams, with a Create Team button. Opens Team detail (members; for captains, pending requests, invite, transfer captaincy, edit team; for every member, leave team, though a captain with other members is asked to transfer captaincy first). Team detail's Members card lists every accepted member (no "See all" link). Team detail doesn't show phone numbers; teammates see them on Player detail. Feature spec: [features/team-membership.md](features/team-membership.md).
- **Explore (player and owner):** three sections at the top, **Teams · Players · Venues**, each with search (venues also filter by area). Opens Team detail, Player detail and Venue detail. For owners, Explore is read-only (no invite or join buttons).
- **My Venue (owner):** the owner's listing, its status ("Pending review" or "Live"), and an Edit button.
- **Notifications:** see "Notifications" below. The tab shows the badge.
- **Profile:** the user's own profile, with a gear icon for **Settings**.
- **Settings:** Edit profile · Change password · Blocked players · Terms & Privacy · Contact support · Log out · **Delete account** (last, in red).
- **Player detail:** public profile fields (see "Profile visibility"), plus **Invite to my team** (for captains), **Report** and **Block**.
- **Admin Dashboard:** counts, plus highlighted "open reports" and "venues waiting for review". Admin screens prioritise clarity over styling.
- **v1.1:** a **Matches** tab is added for players.

**Language:** English only in v1.0.

**Interim screens (until their Step 3 feature):** the bottom tabs exist now (ROADMAP Step 2), but some tabs show stand-ins:
- Player and owner **Explore**: three rows (Teams, Players, Venues) opening the old lists. Replaced by the Explore feature (sections with search; venues also filter by area).
- Player **Notifications**: the old Invites screen. Owner **Notifications**: "No notifications yet." Both replaced by the Notifications feature.
- Owner **Profile**: the Settings screen. Replaced by a proper owner profile with profile editing.
- Admin **Reports**: "Reports arrive with moderation." Replaced by the moderation feature.

**New screens in v1.0:** Notifications, Edit profile, Change password, Delete account, Blocked players, Player detail, Venue detail, report form, suspension message, Terms checkbox at registration, admin Reports, admin Pending venues. Team detail gains pending requests, Leave team and Transfer captaincy.

**Visual design:** the "Floodlight" look (dark, with a neon-lime accent). The full design system is in `docs/DESIGN.md`. All visual values live in theme tokens, so the look can change later without touching screens.

## Business rules (approved)

### Registration (v1.0)

Sign-up asks only for what the core flows need. Everything else is filled in later.

**Player sign-up**
- Fields: **name, email, phone, position, password, confirm password**, and the **Terms checkbox**.
- **Height, weight and Area aren't asked at sign-up.** They're optional and filled in later on **Profile → Edit**.
- **Phone and position stay required.** They can be changed on Edit profile but never left blank. Teammates coordinate by phone (there's no chat in v1.0), and captains decide who to invite by position.
- The **Area** field (on Edit profile) tells players not to enter a full address (see "Profile visibility").

**Position**
- A fixed list: **Goalkeeper, Defender, Midfielder, Forward, Any**. "Any" is for players who play anywhere.
- One position per player, picked from the list at sign-up and on Edit profile. No free text.

**Venue owner sign-up**
- Fields: **venue name, email, password, confirm password**, and the **Terms checkbox**.
- The rest of the listing (address, area, phone, website, description, opening hours, pricing info) is filled in on **My Venue**. A venue can't be approved until its address, area and phone are filled in (see "Venue owners" → "Admin review").

**Terms checkbox**
- Required on both forms, with links to the Terms of Use and Privacy Policy (see "Administration and moderation" → "Terms of Use").

_Implementation notes:_
- `OwnerProfile.phone` and `OwnerProfile.address` become **optional**. Player phone and position stay required.
- Position becomes an **enum**. Existing free-text values are mapped: obvious matches (case-insensitive, for example "GK" or "goalkeeper" → Goalkeeper, "striker" → Forward) map to their value, everything else to Any. The full mapping is shown to the owner before the migration runs.
- Both are schema changes in the profiles and registration migration and need approval (DECISIONS.md 2026-11-20, "Phase 4 order").

### Login sessions (v1.0)

- A login lasts **30 days**. After that the user logs in again.
- **Log out** removes the login from that phone only. There's no "log out of all devices" button in v1.0.
- These events log the account out **on every device**:
  - **Password reset** (the "Forgot password" email link).
  - **Password change while logged in.** The phone that made the change stays logged in.
  - **Suspension** by the admin. A suspended user loses access at once.

_Implementation note:_ each login token carries the account's token version (`User.tokenVersion`). The events above increase that number, which cancels every older token.

### Team membership (v1.0)

**Who can do what**
- Only PLAYER accounts can create teams.
- Players can belong to multiple teams. There's no limit on how many teams a player can join.
- A team has exactly one **captain** (the creator, unless captaincy is transferred). Everyone else is a **player**. No other team roles in v1.0.

**Invites and join requests**
- Players can request to join a team; the captain approves or declines.
- Captains can invite players; the player accepts or declines.
- A captain's invitation counts as captain approval.
- Players cannot approve their own join requests.
- Invites and join requests **don't expire**. They stay pending until someone acts on them.
- A player can **cancel their own pending join request**. A captain can **cancel a pending invite** they sent.
- A player can have only **one pending or active membership per team**.
- If a captain has already invited a player, that player sees **"Accept invite"** instead of "Request to join".
- If a player asks to join a team that has **already invited them**, they join (the invite counts as approval). If a captain invites a player who has **already asked to join**, the request is approved. Both are subject to the team size limit.
- After a request or invite is declined, the player **can request again**.
- A member who was **removed** can ask to join again, or be invited again, straight away.
- The app says **"Decline"** for turning down an invite or a join request (never "Reject").

**Join request message**
- A join request can carry an **optional message to the captain**, up to **150 characters** (counted like team names; spaces at both ends are removed; a blank message means no message).
- Only the **captain, the requester and the admin** can see it.
- It's **deleted** when the request is approved, declined or cancelled.
- It **can't be edited**. To change it, the player cancels the request and sends a new one.
- An offensive message is handled by **reporting the player** (see "Administration and moderation").

**Editing a team**
- The captain can **edit the team's name and description**, with the same rules as creating a team.

**Leaving and captaincy**
- Any member can **leave** a team at any time.
- The captain can **transfer captaincy** to any accepted member of the team.
- The captain **can't leave without transferring captaincy first**. If the captain is the only member, leaving deletes the team (after a confirmation).
- When a captain deletes their account, see "Account deletion" below.

**Team size**
- A team can have at most **15 accepted members**, captain included.
- When a team is full, approving a join request or accepting an invite is blocked with a clear message.
- When a team is full, the captain **can't send new invites**: the invite button is disabled with "Team is full (15/15)", and the backend refuses too.
- When a team is full, players **can't send join requests** either: the Request to join button is disabled with "Team is full (15/15)", and the backend refuses too.
- Pending invites and requests don't count toward the limit.

_Implementation notes:_
- The join request message needs one new optional field on `TeamMember`. It's a schema change and needs approval (team membership backend task).
- Each membership records how it started: a captain's invite, a player's join request, or the captain's own membership created with the team (`TeamMember.origin`).
- **"Longest-standing member"** means the member with the **earliest accepted date** (`TeamMember.acceptedAt`, set when a membership becomes accepted; `createdAt` is when the invite or request was made). Existing accepted members got their old created date as the accepted date (the best value available). If two dates are equal, the lower membership id wins.
- **The captain is stored in one place only:** `Team.captainId`. There's no "captain" member role, so the captain can't be recorded in two places that might disagree. The captain is still an accepted member of the team. A captaincy transfer is a single update of `captainId`.

### Account deletion (v1.0)

**In the app**
- Path: **Settings → Delete account**. A screen explains what will be deleted. The user **re-enters their password**, confirms, and the account is **deleted immediately** (no grace period).

**What gets deleted**
- Everything tied to the account: the user, their profile, their team memberships, and every pending invite and join request they sent or received. This is a full deletion, not hiding or anonymising.
- Database backups may still contain deleted data for a limited time. The privacy policy must say so and give the retention period (decided in the deployment phase).

**Effect on teams**
- If the user is a captain, captaincy **moves automatically to the team's longest-standing accepted member**. If they're the only member, **the team is deleted**.
- The confirmation screen says exactly what will happen to each team (for example "Team Thunder will be handed to Rahim").

**Venue owners**
- Deleting a venue owner account removes the venue listing, and the venue disappears from venue discovery.

**After deletion**
- The same email can be used to register again. It creates a fresh, empty account.

**Web deletion page (Google Play requirement)**
- A simple web page served by the backend. The user enters their email, receives a confirmation link by email, and clicking the link deletes the account. The same rules apply as for deletion in the app.
- Built in the deployment phase.

**Admin deletion**
- When an admin deletes a user, the same rules apply, including the automatic captaincy transfer. All deletions go through the same shared deletion logic.

_Implementation note:_ deletion involves several steps, so they must all succeed or all fail together (a database transaction). That fixes the half-finished deletes found in the audit.

### Profile visibility (v1.0)

**General**
- Profiles can be seen **only by logged-in users**. There are no public web profiles.
- The backend must return only the fields the viewer is allowed to see. Hiding fields only in the app's screens isn't enough.

**Player profiles**

| Field | Who can see it |
|---|---|
| Name, position | Any logged-in user |
| Height, weight (optional) | Any logged-in user, only if the player filled them in |
| Teams they belong to | Any logged-in user |
| Area | Any logged-in user |
| Phone | Only **accepted teammates** (people in at least one team with them, both accepted), plus the admin |
| Email | Only the player themselves and the admin |

- The player address field becomes **"Area"** (for example "Dhanmondi" or "Mirpur"). It isn't asked at sign-up (see "Registration"). The Edit profile screen tells players not to enter a full address.

**Venue listings**
- Everything on an approved venue listing (see "Venue owners" below) is visible to **any logged-in user**. It's a business listing, so the venue phone and address are meant to be public.
- The owner's login email is visible only to the owner and the admin.

**Admin**
- The admin can see every field. It's needed for moderation.

_Implementation note:_ renaming the player address field to "Area" is a schema change (a column rename) and needs approval. Existing values should be kept. They're the owner's own test data.

### Venue owners (v1.0)

**The venue listing**
- **One venue per owner account.** Owners with several branches use a separate account for each.
- Fields the owner can edit: **venue name, address, area, phone, website, description**, plus two optional plain-text fields: **opening hours** (e.g. "Sat–Thu 8am–2am") and **pricing info** (e.g. "৳2,000 per hour").
- No photos in v1.0.
- Website links must start with `http://` or `https://`.

**Admin review**
- A new venue starts as **"Pending review"** and doesn't appear in venue discovery until an admin approves it.
- While pending, the owner can still log in and edit the listing. Their profile shows that it's waiting for review.
- The admin sees pending venues and can approve them. A bad listing is handled through the admin's normal user deletion.
- **A venue can be approved only when its listing is complete:** address, area and phone must be filled in. The backend refuses the approval otherwise, not just the app.
- While a venue is pending, **My Venue shows a checklist** of what's still missing.
- Once approved, the owner can change the address, area and phone, but **can't clear them**.

**What owners can and can't do**
- Owners can see the same public information players see: teams, venues and public player profiles. All of it is read-only.
- Owners **can't create or join teams** in v1.0.
- An owner who also wants to play makes a **separate player account** with a different email. One account has exactly one role.

**Venue discovery (for players)**
- Players can **search venues by name** and **filter by area**. Only approved venues appear.
- A venue's page shows the full listing. The phone and website can be tapped to call or open them.

_Implementation note:_ the owner profile needs new fields (area, opening hours, pricing info) and an approved/not-approved flag. These are schema changes and need approval. Existing venues should be treated as approved, so the owner's current test data stays visible.

### Notifications (v1.0)

**Events**

*Needs your action:*
- A player receives a team invite
- A captain receives a join request

*Updates:*
- Your join request was approved or declined
- Your invite was accepted or declined (shown to the captain)
- You were removed from a team
- You became captain (by a transfer or an automatic handover after account deletion)
- A team you were in was deleted
- Your venue was approved (venue owners)

**How it looks**
- One **Notifications** screen with two sections: **"Needs your action"** (invites and requests, with accept/approve and decline buttons right there) and **"Updates"** (newest first).
- A **badge with a number** on the button that opens the screen. The number counts pending actions plus unread updates.
- Opening the screen marks updates as read. Action items stay until they're handled or cancelled.
- The screen shows the **most recent 50 updates**. Automatic cleanup of old ones can come later.
- Exact placement and styling are decided in the UI/UX work.

**Freshness**
- Notifications refresh when the app opens, when the user comes back to the app, when the Notifications screen opens, and on pull-to-refresh. Not real-time.

**Not in v1.0**
- **No push notifications** (planned for v1.1).
- **No email notifications.** Email is only for account emails: verification, password reset and deletion confirmation.

_Implementation note:_ "Needs your action" items come from pending invites and join requests that already exist in the data. "Updates" need a new notifications table (with read/unread). This is a schema change and needs approval.

### Administration and moderation (v1.0)

**Why this is required:** player profiles, team names and descriptions, and venue listings are user-generated content (UGC). Google Play requires apps with UGC to have Terms of Use that users accept before creating content, in-app reporting of users and content, and in-app blocking of users.

**Admin powers**
- Existing: stats, view and delete users, view and delete teams, view venues.
- **Approve venues** (see "Venue owners").
- **Suspend and unsuspend users.** A suspended user can't log in and doesn't appear in discovery or lists, but their data is kept. At login they see: "Your account has been suspended. Contact [support email]."
- **Review and act on reports** (see below).
- The admin can't edit other users' text in v1.0. Offensive content is handled by deleting the team or suspending or deleting the user.
- **One admin account**, created with the script. There's no way to promote users to admin inside the app.

**Reporting**
- A **Report** button on player profiles, teams and venues.
- The user picks a reason (offensive name or content, fake profile or venue, harassment, spam, other) and can add a short note.
- A user can report the same item only once.
- After reporting they see "Thanks, we'll review it". They don't get further updates.

**Handling reports (admin)**
- A **Reports** screen lists open reports, grouped by the reported item, with a count.
- Actions: **dismiss**, **suspend the user**, or **delete the team or user**. Handled reports are marked resolved.

**Blocking**
- A **Block** button on player profiles.
- When A blocks B: B can't invite A or request to join A's teams, and A can't invite B. Neither sees the other in player lists or search.
- If they're already on the same team, nothing changes automatically. The captain can still remove someone.
- Blocking is silent: B isn't told. A can unblock from **Settings → Blocked players**.

**Terms of Use**
- At registration the user **must tick a box** agreeing to the Terms of Use and Privacy Policy, with links to both.
- The terms list what's not allowed: offensive names or content, fake profiles or venues, harassment, spam.
- The terms text is written in the deployment phase. The checkbox and links are built in v1.0.

**Support email**
- One dedicated support email address (not the owner's personal email). It's shown on the suspension message, in Settings, and on the Play Store listing.

_Implementation note:_ suspension (a flag on the user), reports and blocks each need schema additions, which need approval.

### Challenges and results (v1.1, approved now, built later)

- Only captains can send challenges on behalf of their team.
- A result becomes official only when both captains confirm the same result. A result confirmed by one captain stays provisional.

## Open decisions

> When a decision is made, move it into Business rules, record it in DECISIONS.md and remove it from this table.

| Area | Questions | Needed for | Status |
|---|---|---|---|
| Challenges | Who accepts/rejects, expiry, duplicates, cancellation | v1.1 | Open |
| Match scheduling | Who proposes/confirms date, time, venue; rescheduling | v1.1 | Open |
| Match cancellation | Who can cancel; does the other captain need to agree | v1.1 | Open |
| Match results | Submission, corrections, disagreements, admin intervention | v1.1 | Open |
