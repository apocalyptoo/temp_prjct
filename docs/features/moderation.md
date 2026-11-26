# Feature 6: Moderation (spec)

Phase 4, Step 3. Task F6.0, written 2026-11-26. **Status: approved 2026-11-26** (DECISIONS.md, "Moderation feature spec approved"): the defaults D1–D5, the proposals P1–P40, and the open questions Q1–Q11 answered as recommended in section h. The markers below keep the wording of the draft.

**How to read the markers:**
- **Decided**: one of the owner's four decisions of 2026-11-26 (DECISIONS.md, "Moderation details"), or a rule already in PRODUCT.md or DECISIONS.md.
- **[Dn, proposal]**: a default from the task brief. A proposal until the owner confirms it.
- **[Pn, proposed by Claude Code]**: a design choice proposed by Claude Code, with its one-line reason. All are listed in section i.
- **Qn**: a question or contradiction the docs and code don't settle, with options and a recommendation (section h). Where a section depends on an answer, it follows the recommendation and names the question.

---

## a. What it covers

The two Moderation items in ROADMAP Step 3:

1. **Reporting** a player, a team or a venue: the Report button on Player detail, Team detail and Venue detail, and the Report form.
2. **The admin's Reports screen** (replacing the interim Reports tab): open reports grouped by item, with dismiss, suspend and delete.
3. **Blocking** another player on Player detail, and **Settings → Blocked players** to unblock.
4. **Suspension**: suspend and unsuspend from the admin's Users tab and from Reports; the message at login; everything a suspended account disappears from.
5. **The support email**: a backend setting, shown in the suspension message and in **Settings → Contact support**.
6. **The admin's Users tab, rebuilt** in the new design, with search, paging, each user's role and state, suspend, unsuspend and delete (with feature 4's preview).
7. **The Dashboard's "Open reports"** count.
8. **Paging and search for the admin's lists** (ROADMAP's second Moderation item): Users, and, if Q6 and Q7 say so, Teams and Venues; the venue review screen loads its one venue.

Not covered: notifications for reports, blocks or suspension (none are sent: f.2); the web page for deletion requests (Phase 5; a suspended user may use it, f.2); the real support address and making `SUPPORT_EMAIL` required (Phase 5, D1); the admin editing other users' text (not in v1.0); an admin Team detail or Player detail screen (Q6).

**Left for Step 4:** the Android `AppTheme` switch, the review quick fixes, and, if Q6 rebuilds the Teams tab here, removing `react-native-vector-icons` and `react-native-linear-gradient` (no screen would use them any more). If Q6 keeps the old Teams tab, its restyle stays in Step 4 too.

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [Administration and moderation](../PRODUCT.md#administration-and-moderation-v10): admin powers, suspension and the login message, reporting (reasons, once per item, "Thanks, we'll review it"), handling reports, blocking (including the four decisions of 2026-11-26), the support email.
- [Login sessions](../PRODUCT.md#login-sessions-v10): suspension logs the account out on every device.
- [Team membership](../PRODUCT.md#team-membership-v10): invites, join requests, transfer, the 15-member limit.
- [Profile visibility](../PRODUCT.md#profile-visibility-v10): the admin sees every field.
- [Notifications](../PRODUCT.md#notifications-v10): what's pending, the "No update" list (cancelled by a block).
- [Account deletion](../PRODUCT.md#account-deletion-v10): full deletion, the handover.

Details PRODUCT.md doesn't settle, as used in this spec:

### b.1 Reporting

- **[D2, proposal] Who:** players and venue owners. Nobody can report themselves, their own team or their own venue. The admin can't report. Once reported, the button reads "Reported".
- **"Their own team"** is a team they captain (Q3). A member can report the team they play in (the captain chose its name).
- **What can be reported** is what the reporter can see: a player whose Player detail opens for them, any team, a live venue. A suspended player, or a suspended owner's venue, is "not found" (b.3).
- **[P2, proposed by Claude Code] The five reasons**, the same for every item, with "fake" worded for it: "Offensive name or content", "Fake profile" / "Fake team" / "Fake venue", "Harassment", "Spam", "Other". Reason: PRODUCT.md's list, in words that fit what's on the screen.
- **[P3, proposed by Claude Code] The note:** optional, at most 200 characters (code points, trimmed, blank means none), **required with "Other"**. Reason: 200 is the admin's own note limit, and "Other" alone tells the admin nothing.
- **Once per item, for good** (PRODUCT.md): a dismissed report still counts, so the same person can't report that item again.

### b.2 Blocking

- **Who:** players block players (Q1: venue owners don't). The Block button is on Player detail, never on your own profile.
- **What it stops (decided and PRODUCT.md):** between A (blocker) and B (blocked): no invites either way; B can't ask to join a team A captains; neither sees the other in player lists or searches (Explore → Players and Invite players). **[P23, proposed by Claude Code]** A can't ask to join a team B captains either (Q8). Reason: one rule in both directions is what the cancellation decision already does, and A can unblock first.
- **What it cancels (decided):** at the moment of the block, every pending invite and join request between them in a team either of them captains, silently.
- **What it doesn't change (PRODUCT.md):** shared teams. Both stay members, see each other in the Members card and (as accepted teammates) each other's phone. A team where A is only a member stays open to B.
- **[P22, proposed by Claude Code] It stays true later:** when someone becomes captain (a transfer, or a handover after an account deletion), pending invites and requests in that team between the new captain and anyone they have a block with are cancelled the same way. Reason: otherwise a transfer could bring back exactly what the block cancelled; one rule ("no pending item between a blocked pair in a team either captains") is easier to keep than a filter in every list.
- **Silent:** B is never told. No reply ever says "blocked" to B (P23's messages: explicit only to the blocker). Old updates that name the other person stay (P40).

### b.3 Suspension

- **[D4, proposal] Suspending** sets `suspendedAt` and increases `tokenVersion` in one update, so every device is logged out at once. No notification for suspension or unsuspension.
- **What a suspended account disappears from** (PRODUCT.md "doesn't appear in discovery or lists"): Explore → Players and Invite players (`discovery.js`), Player detail for everyone but the admin (404, like a deleted account), a venue owner's venue from Explore → Venues and Venue detail (D4), captains' join request lists (P18).
- **What stays (decided and Q5):** the account and all its data; its memberships; its teams, listed in Explore, with it as captain; its name in its teams' Members cards and on team cards ("Captain: …"); updates that name it.
- **A suspended captain's team (decided)** takes no new members: join requests and accepting an invite are refused with 409 **"This team isn't taking new members right now."**; invites can't be sent anyway (the captain can't log in). Pending invites and requests stay pending. **[P17, proposed by Claude Code]** Team replies carry `acceptingMembers: false`, so the app disables the buttons with that sentence. Reason: the player sees why before tapping, and the reply never says "suspended".
- **[P18, proposed by Claude Code] A suspended player's own pending join requests** are hidden from captains (Team detail, "Needs your action", the badge, My Teams' request count) and can't be approved (404 "Join request not found"); invites sent *to* them stay visible to the captain, who can cancel them. All of it comes back on unsuspend. Reason: data is kept (PRODUCT.md), but a captain approving would bring a suspended account into a team.
- **[P19, proposed by Claude Code] Captaincy (Q9):** a transfer to a suspended member is refused (409 **"This player can't be made captain right now."**); the account deletion's handover passes over suspended members, unless only suspended members are left, then the longest-standing of them gets the team (which then takes no new members). Reason: a team needs a captain who can log in, but deleting a team with members because of someone else's suspension would be harsh.
- **Unsuspending** clears `suspendedAt`. `tokenVersion` doesn't change (they were already logged out); they log in again normally. Reports stay resolved.
- **[D1, proposal] The support email** is a backend setting, `SUPPORT_EMAIL`, optional until Phase 5. The app reads it from the backend, so it can change without an app update.

### b.4 Handling reports

- **[D3, proposal]** Open reports are grouped by item, with a count, the reasons and the notes. **Dismiss** resolves every open report on that item. **Suspend** acts on the reported user, or a team's captain. **Delete** uses the shared deletion with feature 4's preview. Handled reports are marked resolved.
- **[P11, proposed by Claude Code] Suspending resolves every open report about that user** (as a player or as a venue owner), whichever screen it's done from, and, when done from a team's reports, that team's reports too. Reason: once the account is suspended those reports have been acted on; leaving them open would show them again.
- **Deleting** removes the item's reports with it (Q4: full deletion). Dismiss and suspend mark them resolved.

## c. Data changes

One migration, `moderation`. **It needs the owner's approval when it's created in the backend task (F6.1).** It only adds things; no existing row changes (every user starts not suspended).

```prisma
model User {
  // … existing fields …
  // Set while the admin has suspended the account; null otherwise (spec P12).
  suspendedAt    DateTime?
  reportsMade    Report[] @relation("ReportsMade")
  reportsAbout   Report[] @relation("ReportsAbout")
  blocksMade     Block[]  @relation("BlocksMade")
  blocksReceived Block[]  @relation("BlocksReceived")
}

model Team {
  // … existing fields …
  reports Report[]
}

model Report {
  id           Int               @id @default(autoincrement())
  reporterId   Int
  targetType   ReportTarget
  targetUserId Int?              // a player, or a venue's owner
  targetTeamId Int?              // a team
  reason       ReportReason
  note         String?
  nameAtReport String            // the item's name when it was reported (P4)
  createdAt    DateTime          @default(now())
  resolvedAt   DateTime?         // null = open
  resolution   ReportResolution? // set with resolvedAt
  reporter     User  @relation("ReportsMade", fields: [reporterId], references: [id], onDelete: Cascade)
  targetUser   User? @relation("ReportsAbout", fields: [targetUserId], references: [id], onDelete: Cascade)
  targetTeam   Team? @relation(fields: [targetTeamId], references: [id], onDelete: Cascade)

  @@unique([reporterId, targetType, targetUserId])
  @@unique([reporterId, targetTeamId])
  @@index([targetUserId])
  @@index([targetTeamId])
}

model Block {
  id        Int      @id @default(autoincrement())
  blockerId Int
  blockedId Int
  createdAt DateTime @default(now())
  blocker   User @relation("BlocksMade", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User @relation("BlocksReceived", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
  @@index([blockedId])
}

enum ReportTarget     { player team venue }
enum ReportReason     { offensive fake harassment spam other }
enum ReportResolution { dismissed suspended }
```

- **[P6, proposed by Claude Code] One `Report` table** with a type and two optional targets, each a real foreign key. "Once per item" is two unique indexes: Postgres treats nulls as different, so `(reporterId, targetType, targetUserId)` only bites on player and venue reports and `(reporterId, targetTeamId)` only on team reports. The migration adds, by hand, a `CHECK` that a team report has only `targetTeamId` and any other report only `targetUserId`, and on `Block` a `CHECK` that `blockerId <> blockedId`. Reason: the database itself refuses a duplicate or a malformed row, even under a double tap (P2002 becomes the 409).
- **[P4, proposed by Claude Code] `nameAtReport`.** Reason: someone reported for an offensive name may rename themselves before the admin looks; the admin then sees "Reported as: …".
- **[P8, proposed by Claude Code] `resolvedAt` and `resolution`, no status enum**, like `approvedAt` and `readAt`. Resolved reports stay (they're what makes "once per item" hold); the Reports screen shows open ones only. No "resolved by": there's one admin.
- **[P12, proposed by Claude Code] `suspendedAt` instead of a yes/no**, and no index on it. Reason: the same information plus when, shown to the admin; every query that filters on it already narrows by role or id.
- **No other indexes.** The unique indexes start with `reporterId` / `blockerId`, which covers "have I reported / blocked this"; the two target indexes and `blockedId` serve the deletes and the "either direction" checks. At v1.0's size the open-reports query reads the table quickly; an index on `resolvedAt` is one later migration if needed.

**[P7, proposed by Claude Code] What happens on a delete** (Q4), explicitly in the shared deletion, with the cascade as the safety net:

| What is deleted | Reports | Blocks |
|---|---|---|
| A user (any way, in `deleteUserAndData`) | The ones they made, and every one about them (as a player or as a venue owner), at the existing moderation hook | Both directions |
| A team (`removeTeamRows`: captain, admin, last member, account deletion) | The team's reports | — |
| A venue | Only happens with its owner's account (above) | — |

## d. API

### d.1 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `POST /players/:id/report`, `POST /teams/:teamId/report`, `POST /owners/:userId/report` | player, venue owner | new |
| 2 | `POST /players/:id/block`, `DELETE /players/:id/block` | player | new |
| 3 | `GET /players/blocked` | player | new |
| 4 | `GET /app/config` | anyone, no login | new **[P26]** |
| 5 | `GET /admin/reports` | admin | new |
| 6 | `POST /admin/reports/{players,teams,venues}/:id/dismiss` and `…/suspend` | admin | new |
| 7 | `POST /admin/users/:id/suspend`, `POST /admin/users/:id/unsuspend` | admin | new |
| 8 | `GET /admin/users` | admin | changed: search, filters, paging, `suspendedAt` |
| 9 | `GET /admin/teams` (Q6), `GET /admin/indoors` (Q7) | admin | changed: search, paging |
| 10 | `GET /admin/indoors/:id` | admin | new **[P29]** |
| 11 | `GET /admin/stats` | admin | changed: `openReportCount` |
| 12 | `POST /auth/login` | anyone | changed: the suspended reply |
| 13 | Everything in d.4 (discovery, team actions, detail replies, notifications) | as today | changed inside |

**[P1, proposed by Claude Code]** Reporting and blocking hang off the item they're about, in the existing routers (block and blocked-list routes above `/players/:id`, like `/me` and `/requests`), and their handlers live in one new `moderationController.js`, the one controller shared by several route files (TECHNICAL 4.1 notes the exception). Validation in a new `moderationSchemas.js`. Reason: URL ids go through `parseId` with each router's existing messages ("Invalid player id", "Team not found"…), and one file holds the moderation rules.

Every error reply is `{ "error": "<message>" }`. Existing messages keep their words.

### d.2 Reporting

**1. `POST /players/:id/report`, `/teams/:teamId/report`, `/owners/:userId/report`** (`verifyToken`, `notAdmin("The admin account can't send reports.")`, `reportLimiter`, `validate({ body: reportSchema })`).

Body `{ "reason": "offensive", "note": "…" }`. `reportSchema`, in stages:
- `reason` exactly one of the five values, else **"Choose a reason"**.
- `note` text if given, trimmed, blank or missing is null, at most 200 code points: "Note must be text", "Note must be at most 200 characters".
- With `reason: "other"`, a note is required: **"Tell us what's wrong in the note"**.

Then, in order:
- 400 "Invalid player id" / "Invalid team id" / "Invalid venue id" (`parseId`).
- 404 **"Player not found"** (not a PLAYER with a profile, or suspended), **"Team not found"**, **"Venue not found"** (not a live venue, or its owner is suspended). The same rule as the page the button is on.
- 403 **"You can't report yourself."** / **"You can't report your own team."** (the caller is its captain, Q3) / **"You can't report your own venue."**
- 409 **"You've already reported this player."** / "… this team." / "… this venue." Also when two identical requests race (P2002 on the unique index).
- 201 `{ "message": "Thanks, we'll review it" }`. `nameAtReport` is the player's name, the team's name or the venue's name, read in the same request.

**[P5, proposed by Claude Code] `reportLimiter`:** 10 reports per hour per account (`account:<user id>`, after `verifyToken`), counting only 201s, then 429 **"You've sent a lot of reports. Please try again in an hour."** Reason: one per item stops repeats, but not one account reporting everyone; 10 an hour is far above any real use.

### d.3 Blocking

**2. `POST /players/:id/block`** (`verifyToken`, `onlyRole('PLAYER', 'Only players can block other players.')`). No body.
- 400 "Invalid player id"; 400 **"You can't block yourself."**; 404 "Player not found" (not a PLAYER with a profile, suspended, or deleted mid-request: P2003).
- **[P20, proposed by Claude Code]** 200 `{ "message": "Player blocked" }`, also when already blocked. **`DELETE /players/:id/block`**: 200 `{ "message": "Player unblocked" }`, also when there was no block; 400 "Invalid player id". Reason: the end state is what the user asked for, so a second device or a retry never shows an error.

**[P21, proposed by Claude Code] The block runs in one transaction** (decided cancellation; CLAUDE.md: membership writes under the team lock):
1. Find the teams either of them captains; `lockTeams` them (lowest id first).
2. Read the list again; if a team appeared (a transfer meanwhile), start over, at most 3 times, as the account deletion does; after that 409 **"Something changed. Please try again."**
3. Delete the pending rows between them in those teams: A's rows in teams B captains and B's rows in teams A captains (`status: pending`, either origin).
4. Insert the block (or find it). A blocked account deleted meanwhile: P2003, 404 "Player not found".

No `createUpdates` (decided: silent). Teams first, then the user rows (the insert's foreign keys), the same order as the account deletion, so the two can't deadlock. Like the deletion, it's a documented exception to `withLockedTeam`.

**[P22] Transfer and handover.** `transferCaptaincy` (under its team lock), and the handover step in `deleteInTransaction` (under its team locks), after changing `captainId`, delete that team's pending rows of players who have a block with the new captain (either direction). Silent. The preview code doesn't change (it doesn't look at pending rows).

**3. `GET /players/blocked`** (`verifyToken`, `onlyRole('PLAYER', 'Only players can block other players.')`, `pageParam`/`limitParam`). **[P25, proposed by Claude Code]** Paged like every list (`{ items, page, limit, total }`), newest block first, then id. Each item: `{ id, name, playerProfile: { name, position, area }, blockedAt }` through `toVisibleUser`; no email or phone. Suspended players stay in the list (only the blocker sees it). Reason: the shared paging pieces cost nothing, and someone could block many accounts.

### d.4 Where blocks and suspension apply

| Place | Change |
|---|---|
| `discoverablePlayers(viewer)` (`discovery.js`) | Adds `suspendedAt: null` and "no block in either direction" (`blocksMade: { none: { blockedId: viewer.id } }`, `blocksReceived: { none: { blockerId: viewer.id } }`). Covers `GET /players` and `GET /teams/:teamId/invite-candidates` at once |
| `GET /players/:id` | A suspended player: 404 "Player not found" for everyone but the admin (who gets `suspendedAt`). Between a blocked pair: the page opens (Q2), `inviteOptions` is an empty list. New fields for a player or venue owner looking at someone else **[P24]**: `blockedByMe` (players only) and `reportedByMe` |
| `GET /teams/:teamId` | **[P17]** `acceptingMembers` (false when the captain is suspended); `reportedByMe` for players and venue owners. Join requests from suspended players are left out (P18). Members are unchanged (Q5) |
| `GET /teams` | Unchanged: a suspended captain's team stays listed (decided) |
| `GET /teams/me` | `joinRequestCount` leaves out suspended requesters (P18) |
| `GET /owners`, `GET /owners/:userId` | A suspended owner's venue is left out / 404 "Venue not found" (D4). `/owners/:userId` gains `reportedByMe` |
| `POST /teams/:teamId/invite` | After the existing captain, full and "Player not found" checks: a suspended invitee is 404 "Player not found"; a block either way is 403 (P23). Before the "approves a request" branch |
| `POST /teams/:teamId/requests` | After "already in" and "already asked": captain suspended, 409 "This team isn't taking new members right now."; a block with the captain, 403 (P23); then full, as today |
| `POST /teams/:teamId/accept` | Captain suspended: 409 "This team isn't taking new members right now." (the invite stays pending) |
| `POST /teams/:teamId/requests/:userId/approve` | A suspended requester: 404 "Join request not found" (P18) |
| `POST /teams/:teamId/transfer` | To a suspended member: 409 "This player can't be made captain right now." (P19); then P22's cancellation |
| `planAccountDeletion` (`deletion.js`) | The handover passes over suspended members unless only suspended ones are left (P19); then P22's cancellation in the deletion. The existing hook comment marks the place |
| `notificationFeed.js` (`pendingRequestsFor`) | Leaves out suspended requesters (P18), so "Needs your action" and the badge agree. Each invite's team gains `acceptingMembers` (P17) |
| `verifyToken` | **[P14]** Also refuses a suspended account (401 "Invalid token"), with `suspendedAt` added to its existing lookup |

- **[P16, proposed by Claude Code] One helper for "active"**: `isActive` / `ACTIVE_USER` (`suspendedAt: null`) in a new `src/utils/moderation.js`, with `blockBetween(db, a, b)` (returns `'none'`, `'byFirst'` or `'bySecond'`) and `cancelPendingBetween(tx, …)`. Every row of the table uses them. Reason: one place for each rule, like `visibility.js` and `discovery.js`.
- No block checks are needed in accept, approve or the feeds: P21 and P22 keep blocked pairs from having pending items at all.
- **[P23, proposed by Claude Code] The block refusals**, 403, explicit only to the person who blocked:
  - inviting someone you blocked: **"You've blocked this player. Unblock them to invite them."**
  - inviting someone who blocked you: **"You can't invite this player."**
  - asking to join a team whose captain you blocked: **"You've blocked this team's captain. Unblock them to ask to join."**
  - asking to join a team whose captain blocked you: **"You can't ask to join this team."**

  Reason: the blocker knows and can undo it; the blocked player gets a refusal that doesn't give the reason (Q8 and the "silent" question in Q2). In normal use the blocked player only meets the last one: lists and Player detail don't offer the others.

### d.5 Suspension and login

**7. `POST /admin/users/:id/suspend`** (no body). In order: 400 "Invalid user id"; 403 **"You can't suspend your own account."**; 404 "User not found"; 403 **"Admin accounts can't be suspended."**; then one transaction: a conditional update `where: { id, suspendedAt: null }` setting `suspendedAt` now and `tokenVersion + 1`, else 409 **"This account is already suspended"**; then P11's resolving (`resolution: suspended`). Reply 200: the user as in the Users list (d.6). No email, no update (D4). One log line: "Account 12 suspended by admin 1" (no name or email, like the deletion's).

**`POST /admin/users/:id/unsuspend`**: the same checks; `where: { id, suspendedAt: { not: null } }` setting null, else 409 **"This account isn't suspended"**. Reply 200: the user. Log line "… unsuspended …".

**[P15, proposed by Claude Code] No team locks for suspension:** it's one update of the user row (plus resolving reports). Reason: nothing it writes is a membership. The cost: a join that is already past its "captain suspended?" check in the same instant still completes (section f). The user row's lock can't deadlock with the account deletion (which takes it last) or team actions (which hold no lock suspension waits for).

**12. `POST /auth/login`** (changed). After the password is checked, before the "verify" check:
- **[P13, proposed by Claude Code]** a suspended account: **403** `{ "error": "Your account has been suspended. Contact <support>.", "suspended": true }`, where `<support>` is the `SUPPORT_EMAIL` address or the placeholder (d.7). Reason: the app treats a 403 as "please verify" today, so it needs a field to tell them apart; 403 keeps the login limiter right (a 403 means the password was correct, `loginWasSuccessful`) and puts suspended before unverified because it's the admin's decision. An unknown email or wrong password still gets "Invalid email or password", so the message is only for someone who knows the password.
- Forgot password, the reset page and resend verification work as today for a suspended account (harmless: login still refuses).

### d.6 The admin's lists and reports

**8. `GET /admin/users`** (changed; `adminUserListQuerySchema`): `search` (part of the name or the email, `containsText`, the shared `searchFilter`), **[P28, proposed by Claude Code]** `role` (`PLAYER`, `OWNER` or `ADMIN`; "Role must be PLAYER, OWNER or ADMIN") and `state` (`suspended` or `unverified`; "State must be suspended or unverified"), `page`, `limit`. Newest account first, then id. Paged. Each item: `{ id, name, email, role, createdAt, verified, suspendedAt }` (`name` as today, "Admin" for the admin), secrets stripped. Reason for the filters: the admin's first questions are "who is suspended?" (to review unsuspending) and "who never verified?".

**9. `GET /admin/teams`** (Q6): `search` (part of the team's name), `page`, `limit`; newest first, then id. Each item as today plus `area` and the captain's `suspendedAt`. **`GET /admin/indoors`** (Q7): `search` (part of the venue name or the owner's email), `page`, `limit`, keeping today's order (pending venues first, oldest sign-up first, then live venues by name): one count of the pending venues decides which part of the order a page falls in. Each item as today plus the owner's `suspendedAt`.

**10. `GET /admin/indoors/:id`** **[P29, proposed by Claude Code]**: one venue in the admin shape; 400 "Invalid venue id", 404 "Venue not found". Reason: the ROADMAP item; the review screen stops loading every venue to show one.

**11. `GET /admin/stats`** gains `openReportCount`: how many items have at least one open report (the number of cards on the Reports screen, D5).

**5. `GET /admin/reports`** (`page`, `limit`). **[P9, proposed by Claude Code]** One entry per item with open reports, most open reports first, then the oldest open report first, then type and id; each with up to its 20 newest open reports. Reason: what many people report is usually the most urgent; a cap keeps one entry small if an item is reported by hundreds.

```json
{ "items": [
  { "type": "team", "id": 7, "name": "Dhanmondi Strikers",
    "reportCount": 3, "newestReportId": 52, "oldestReportAt": "…",
    "reasons": { "offensive": 2, "spam": 1 },
    "team": { "area": "Dhanmondi", "description": "…", "memberCount": 11,
              "captain": { "id": 12, "name": "Rahim Uddin", "email": "…", "suspendedAt": null } },
    "reports": [
      { "id": 52, "reason": "offensive", "note": "…", "nameAtReport": "…", "createdAt": "…",
        "reporter": { "id": 19, "name": "Nayeem Islam", "role": "PLAYER" } } ] }
], "page": 1, "limit": 20, "total": 4 }
```

- `type: "player"` carries `player: { position, area, email, verified, suspendedAt }`; `type: "venue"` (its `id` is the owner's user id) carries `venue: { area, address, phone, website, description, openingHours, pricingInfo, live, email, suspendedAt }`. The admin sees every field (PRODUCT.md), secrets stripped. The reporter is named: the admin needs to spot someone reporting in bad faith.

**6. `POST /admin/reports/players/:id/dismiss`** (and `teams`, `venues`; three routes, one handler). **[P10, proposed by Claude Code]** Body `{ "upToId": 52 }` (`resolveReportsSchema`: a positive whole number within `MAX_DB_INT`, else 400 **"Invalid report id"**): resolves the item's open reports with an id up to that one as `dismissed`. Reason: a report that arrives while the admin reads isn't dismissed unseen (the same idea as the notifications' `upToId`). 404 when the item is gone ("Player not found"…); none left to resolve: 409 **"These reports were already handled."**; else 200 `{ "resolved": 3 }`.

**`POST /admin/reports/…/:id/suspend`** (same body): suspends the player, the venue's owner or the team's captain *now* (d.5, without its 409: an account that's already suspended stays so) and resolves as in P11. 404 as above; the same self and admin refusals as endpoint 7 (in practice never met). 200 `{ "resolved": 3, "userId": 12 }`.

**Delete** from Reports uses the existing routes, unchanged: `DELETE /admin/users/:id?previewCode=…` (a player), `DELETE /admin/indoors/:id?previewCode=…` (a venue), `DELETE /admin/teams/:id` (a team). The item's reports go with it (P7).

### d.7 The support email

- **[P27, proposed by Claude Code] `SUPPORT_EMAIL`** in `backend/.env` and `.env.example`, read by `loadConfig` as `supportEmail`: optional until Phase 5; when given, trimmed, lowercased (`normalizeEmail`), at most 254 characters, one `@` and no spaces, else the server refuses to start ("SUPPORT_EMAIL: must be an email address"). When missing, `supportEmail` is null and the server logs one line at start-up: "SUPPORT_EMAIL isn't set: the app shows a placeholder." (never a value). `supportContact()` returns the address, or the placeholder **"support (address not set up yet)"**. Reason: an obvious placeholder can't be mistaken for a real address, unlike a made-up one.
- **4. `GET /app/config`** **[P26, proposed by Claude Code]**: no login, no rate limit; 200 `{ "supportEmail": "help@…" | null }`. A new small router, `appRoutes.js` (no controller, like `legalRoutes.js`). Reason: the address is public (Play listing), Settings needs it, and review finding 8's minimum app version would join this same reply later.
- Phase 5's "Create a dedicated support email" item then only creates the address, sets `SUPPORT_EMAIL` and makes it required.

## e. Screens

Built from `src/components/ui` with theme tokens only; every button that sends a request uses `useBusyAction`. No new component, token or icon is needed (`report` Flag, `block` Ban, `email` Mail, `reports` ShieldAlert exist). No native change: a reload is enough.

### Report and Block buttons

- **[P30, proposed by Claude Code]** At the bottom of Player detail (explore spec P25), Team detail and Venue detail: `Button` `danger` with the `report` icon, "Report", and on Player detail beside it `Button` `danger` with the `block` icon, "Block" (two buttons side by side are a layout, DESIGN 6). Reason: the existing danger button is DESIGN's "danger action" on a surface; no new text-button variant.
- Shown to players and venue owners, never on your own profile, on a team you captain (Q3) or on your own venue (D2). With `reportedByMe`: a disabled secondary "Reported". Block only for players looking at another player.
- **Report** opens the Report form. **Block** asks first (below). A team that takes no new members (P17): Request to join and Accept are disabled with "This team isn't taking new members right now." (Team detail and the invite card on Notifications).

### The Report form (new, `src/screens/Shared/ReportScreen.js`)

**[P31, proposed by Claude Code]** Params `{ type: 'player' | 'team' | 'venue', id, name }`. Registered in `teamScreens()`, read-only form included, so it exists in every stack that has Player detail, Team detail or Venue detail (both Explore stacks, My Teams, the player's Notifications).
1. `BackLink` (the screen underneath), title "Report".
2. "What's wrong with {name}?"
3. `OptionGroup` "Reason" with the five reasons in their wording for this item (P2), no choice at first.
4. `TextField` "Note (optional)", multiline, `maxLength` 200, helper "Only the admin sees this." With "Other", the label reads "Note" and the helper "Tell us what's wrong."
5. **Send report** (primary, full width).

Before sending: "Choose a reason" under the reasons, "Tell us what's wrong in the note" under the note (`reportChecks.js`, the backend's rules and messages). After 201: one alert "Report sent" / **"Thanks, we'll review it."**, then back; the detail screen reloads on focus and shows "Reported". 409: the same alert (it was already reported), then back. 404: "Something changed" with the backend's message, back. 429: alert with the message. No connection: "Couldn't send the report. Please check your connection and try again." Reason: the user's job is done in every case but the last two.

### Block and unblock on Player detail

- **[P32, proposed by Claude Code]** Block opens a destructive `ConfirmDialog`: title **"Block {name}?"**, message **"They won't be able to invite you or ask to join your teams, and you can't invite them. You won't see each other in player lists or searches. Any invites or join requests between you are cancelled. They won't be told. If you're in a team together, nothing changes there."**, confirm **"Block"** (danger), "Cancel". Then `POST /players/:id/block` and a reload.
- Once blocked: a `NoticeLine` **"You've blocked {name}."** above the buttons, and **Unblock** (secondary) instead of Block, without a confirmation. The invite card is gone (`inviteOptions` empty). Reason: unblocking only gives back what was there, and it's undone in one tap.
- The person who was blocked sees the page as usual, without an invite card (Q2).

### Settings → Blocked players (new, `src/screens/Player/BlockedPlayersScreen.js`)

- Settings gains **Blocked players** (`block` icon) after Change password, for players only (Q1), → `BlockedPlayers` in the player's Profile stack.
- `BackLink` "Settings", title "Blocked players", the line "Blocked players can't invite you or ask to join your teams. They aren't told." Then a paged list (`usePagedList` on `GET /players/blocked`, no filters): `Avatar`, the name, `personMeta`, and an **Unblock** button (secondary, keyed by id). Rows aren't tappable (Player detail isn't in the Profile stack).
- **[P33, proposed by Claude Code]** After Unblock the row stays, with a disabled "Unblocked", until the screen is left (`leave()` of `usePagedList`). Reason: the list doesn't jump under the finger, and the user sees what they did.
- Empty: "You haven't blocked anyone." Failed load: `TeamLoadState` "Couldn't load your blocked players."

### Contact support

**[P34, proposed by Claude Code]** Settings gains **Contact support** (`email` icon) before Terms of Use, for players and venue owners. Settings loads `GET /app/config` on focus. The row's second line is the address; tapping opens `mailto:{address}?subject=ConnectArena%20support`. If no mail app opens: alert "Write to {address}." Address null: the line reads "Not set up yet" and the row isn't tappable. Not loaded yet or failed: the line reads "Tap to load" and a tap loads it, then opens it. Reason: the address can change on the backend (D1), and a plain `mailto:` needs no package.

### The suspension message at login

**[P35, proposed by Claude Code]** `AuthContext.login` returns `suspended: true` for a 403 with `suspended`, and `needsVerification` only for the other 403. `LoginScreen` shows one alert titled **"Account suspended"** with the backend's message, and no "Resend verification email". Other phones of the account: their next request gets 401, so "Your session has expired. Please log in again.", and logging in then shows the suspension. Reason: the backend's sentence carries the current address.

### Admin: Reports (rebuilt `AdminReportsScreen`)

**[P36, proposed by Claude Code]** `ScreenHeader` "Reports", a paged list (`usePagedList` on `GET /admin/reports`, no filters), loaded on focus and pull to refresh. One `Card` per item:
- The type icon (`profile`, `teams` or `venue`), the name (`cardTitle`), the type ("Player" / "Team · Captain: Rahim Uddin" / "Venue"), and a soft `Pill` "3 reports". "Reported as: …" when a report's `nameAtReport` differs from the name now. A "Suspended" soft pill when the user (or the team's captain) is suspended.
- What was reported, so the admin can judge without another screen: a player's position · area and email; a team's area, description and member count; a venue's area, address, description, website, opening hours and pricing info (only the filled ones), plus **Open venue** (`TextLink`) → the Venues tab's `AdminVenue`.
- The reasons in one line: "Offensive name or content (2) · Spam (1)". Then each report: the reason, the note in quotes, "{reporter} · 3 h ago" (`timeAgo`).
- Actions side by side: **Dismiss** (secondary), **Suspend** (danger; for a team "Suspend captain"; hidden when already suspended), **Delete** (danger).
  - Dismiss: `ConfirmDialog` "Dismiss these reports?" / "They're marked as handled. Nothing changes for {name}." → dismiss with `newestReportId`.
  - Suspend: the same dialog as the Users tab (below) → `…/suspend` with `newestReportId`.
  - Delete: a player or venue through `useAdminDeletion` (feature 4's preview dialog, unchanged); a team: destructive `ConfirmDialog` "Delete {team}?" / "The team and its memberships are deleted for good. Its members, and anyone invited or waiting, are told." → `DELETE /admin/teams/:id`.
  - After each, the list reloads. 404 and 409 go through `showActionError` ("Something changed", reload).
- Empty: "No open reports." The interim text "Reports arrive with moderation." goes, and PRODUCT.md's "Interim screens" loses the line.

### Admin: Users (rebuilt, `src/screens/Admin/AdminUsersScreen.js`, replacing `ManageUsersScreen`)

**[P37, proposed by Claude Code]** `ScreenHeader` "Users"; a `PagedList` on `GET /admin/users` with a "Search name or email" field and an `OptionGroup` "Show": **All**, **Players**, **Venue owners**, **Suspended**, **Unverified** (one choice, mapped to `role` or `state`, P28). One `Card` per user:
- The name (`cardTitle`), the email (`meta`), "Joined 23 Nov 2026" (`shortDate`), pills: the role ("Player", "Venue owner", "Admin"), "Suspended", "Unverified".
- Actions (none on the admin's own row): **Suspend** (danger) or **Unsuspend** (secondary), and **Delete** (danger) through `useAdminDeletion` (unchanged dialogs).
- Suspend: destructive `ConfirmDialog` **"Suspend {name}?"** / **"They're logged out on every device at once and can't log in until you unsuspend them. They disappear from player lists and searches (for a venue owner: their venue disappears from Explore). Their teams and everything else are kept."** → **Suspend**. Unsuspend: `ConfirmDialog` (not destructive) **"Unsuspend {name}?"** / "They can log in again and show up as before." → **Unsuspend**.
- The card updates from the reply. 404 and 409: `showActionError` and reload.
- `ManageUsersScreen.js` is deleted.

### Admin: Dashboard

**[P38, proposed by Claude Code]** A tappable `Card` **"Open reports"** (`reports` icon, a `Badge` with `openReportCount` above zero, else a muted "0", a chevron; read as "Open reports: n") above "Venues waiting for review", → `navigate('ReportsTab')`. Reason: PRODUCT.md highlights both; reports are about people and come first.

### Admin: Teams and Venues (Q6, Q7)

**[P39, proposed by Claude Code]** If Q6 is yes: `AdminTeamsScreen` replaces `ManageTeamsScreen`: `PagedList` with "Search teams"; a `Card` per team (name, area, "Captain: {name}" with a "Suspended" pill, member count, description); **Delete** with the team dialog above. If Q7 pages the venues: `AdminVenuesScreen` moves onto `PagedList` with "Search venues or email", the "Waiting for review" header drawn before the first pending row and "Live" before the first live one. `AdminVenueScreen` loads `GET /admin/indoors/:id` (P29) either way. Reason: one list shape for every admin list, and no old screen left.

## f. Edge cases, hook points and tests

### f.1 Edge cases

| Case | Backend | App |
|---|---|---|
| A blocks a teammate | Both stay members; pending items in teams either captains are cancelled; the phone stays visible (teammates) | Each still sees the other in the Members card |
| A blocks B, who has already blocked A | Two rows; each unblock removes only its own | Each sees "You've blocked …" on the other's page |
| A blocks the captain of a team A asked to join | The request is cancelled, silently | Gone from A's Requests sent and the captain's list |
| A blocks B while B accepts A's invite | One after the other (team lock): the accept first, then the block finds nothing pending (they're teammates); or the block first, then 404 "Invite not found" | "Something changed" |
| B's team is transferred to A's blocker | P22 cancels the pair's pending items in that team | They disappear on the next load |
| A blocks B, then B is made captain of a team A is in | Nothing to cancel (A is a member); B can't invite A elsewhere | — |
| Blocking yourself, a venue owner or the admin | 400 / 404 "Player not found" | No button |
| Reporting something that is then deleted | Its reports go with it (P7) | The admin's card disappears on reload; acting on it first: 404 "Something changed" |
| Reporting twice (double tap, two devices) | One 201, one 409 (unique index) | The button guard; "Reported" |
| Reporting again after a dismissal | 409: once per item, for good | "Reported" stays |
| A reported player renames themselves | `nameAtReport` keeps the old name | "Reported as: …" |
| The reporter deletes their account | Their reports go; the count drops | — |
| A report arrives while the admin reads the card | Not dismissed or resolved (`upToId`) | A new card with count 1 after reload |
| Suspending a captain | Team listed, members kept; requests and accepting refused (409); their pending requests elsewhere hidden (P18) | Buttons disabled with the sentence |
| A suspended captain's team, a member leaves | Allowed; `memberLeft` goes to the suspended captain (kept) | — |
| A suspended venue owner's venue | Gone from `GET /owners` and Venue detail; the admin still sees it, with "Suspended" | "This venue isn't available any more." |
| Approving a suspended owner's pending venue | Allowed: it shows in Explore once the owner is unsuspended | The review screen shows "Suspended" |
| Suspending someone with a request in flight | A request already past `verifyToken` finishes; the next one gets 401 | "Your session has expired"; login shows the suspension |
| A join landing in the same instant as the captain's suspension | It may complete (P15) | — |
| Suspending a member who is about to become captain | Transfer refused (P19); a handover passes them over | The captain sees the message |
| Every other member of a deleting captain's team is suspended | The longest-standing suspended member gets it (P19); it takes no new members | The preview names them |
| A suspended user tries Forgot password | Works; login still refused | The suspension alert |
| Suspended and unverified | The suspension message (checked first) | No Resend button |
| The admin tries to suspend or report itself | 403 "You can't suspend your own account." / "The admin account can't send reports." | No such buttons |
| Suspending twice (two devices) | One 200, one 409 "This account is already suspended" | "Something changed", reload |
| Suspending from a team's reports when the captain is already suspended | Resolves the reports; nothing else changes | The card goes |
| Deleting a suspended account | The shared deletion, as for anyone | The usual dialogs |
| `SUPPORT_EMAIL` missing | The placeholder in the login message; `GET /app/config` gives null | "Not set up yet" in Settings |
| `SUPPORT_EMAIL` malformed | The server refuses to start, naming the setting | — |
| Very long names and notes, largest font size | — | Cards and dialogs wrap; buttons stay reachable |

### f.2 Hook points

**Notifications:** none created (decided for blocks, D4 for suspension; reporters get no further updates, PRODUCT.md). **[P40, proposed by Claude Code]** Old updates that name a blocked player stay, and the notifications spec's Q7 (a team deleted for an offensive name keeps its name in the update) stays as it is (Q10). The moderation hook comment in `notificationFeed.js` becomes the suspension filter (P18); the block hiding it planned isn't needed (P21, P22).

**The code's hook comments** (`discovery.js`, `playerController.js`, `teamController.js`, `ownerController.js`, `deletion.js` ×2, `notificationFeed.js`) are replaced by the code in d.4 and section c.

**Later:**
- **Phase 5 web deletion page:** must work for a suspended account (Google Play: deletion must always be possible); it uses no login, so nothing blocks it.
- **Phase 5 emails:** the account-deleted notice can name the support address once `SUPPORT_EMAIL` is set.
- **v1.1 challenges:** a block should also stop challenges between teams the pair captains, and a team that takes no new members shouldn't take challenges either. Decide then.

### f.3 Test plan

**Backend** (`node:test`, real HTTP, throwaway users):
- `tests/moderation-data.test.js`: the columns, enums, indexes and both `CHECK`s exist; a duplicate report and a self-block are refused by the database.
- `tests/reports.test.js`: each item type; every reason; the note rules and messages; "Other" without a note; 404 for a suspended player, a pending venue, a suspended owner's venue; own profile, team and venue 403; a member may report their team (Q3); admin 403; 409 twice, also two at once; `nameAtReport`; `reportedByMe` on the three detail replies; the limiter (the 11th 429; a 409 doesn't count).
- `tests/blocks.test.js`: block, unblock, both idempotent; self 400; non-player 403 before anything; 404s; the list (paging, order, no email or phone); `blockedByMe` only for the blocker; discovery hides both directions in `GET /players` and invite candidates; Player detail opens with an empty `inviteOptions` (Q2); the four refusals and their messages; the cancellation: each direction and origin, only in teams either captains, a team where one is only a member untouched, no update created; P22 on transfer and handover.
- `tests/blocks-races.test.js` (many rounds): a block against an invite, an accept, an approve and a transfer between the pair; afterwards never a pending row between a blocked pair in a team either captains, never a 500. Checked once by hand that it fails without the team locks.
- `tests/suspension.test.js`: suspend and unsuspend replies and refusals; the old token 401 on every device; `verifyToken` refuses a suspended account even with a current `tv` (set directly in the database); login: the 403 with `suspended`, the message with the address and with the placeholder, before "verify", the limiter treats it as a success; hidden from lists, Player detail (but not for the admin) and venues; the team stays listed with `acceptingMembers: false`; request and accept 409; P18 everywhere (Team detail, `/teams/me`, `/notifications` and the count agree); P19 on transfer and handover (and the preview); unsuspend brings it all back; reports resolved (P11).
- `tests/admin-reports.test.js`: grouping, counts, reasons, order, the 20-report cap; each type's fields; dismiss and suspend with `upToId` (a later report stays open), 404, 409; delete removes the reports; `openReportCount`.
- `tests/admin-lists.test.js`: users search (name, email, `%`, `_`), `role` and `state`, paging and their messages; teams and venues per Q6 and Q7, the venue order across a page boundary; `GET /admin/indoors/:id`.
- `tests/app-config.test.js` and `tests/config.test.js`: `SUPPORT_EMAIL` missing, valid (normalised), malformed; no value printed.
- Updated: `delete-account.test.js` and `admin-delete.test.js` (reports and blocks in both directions go; rollback), `deletion-plan.test.js` (P19), `player-list`, `invite-candidates`, `player-detail`, `team-detail`, `notifications-list`, `teams-invites`, `join-requests`, the transfer and login tests, `route-ids.test.js` (the new `:id` routes), `admin-stats.test.js`, `rate-limits.test.js`.

**App** (Jest, fake API):
- Report form: the reasons per type; the checks; the body; each reply's alert and the way back; one request on a double tap.
- Player detail: Report and Block shown for a player looking at someone else, Report only for an owner, neither on your own profile; the Block dialog's text; blocked state with Unblock; "Reported"; no invite card when the list is empty.
- Team detail: Report hidden for the captain; "Reported"; `acceptingMembers: false` disables Request to join and Accept with the sentence. Venue detail: Report hidden on your own venue. Notifications: an invite to a closed team.
- Blocked players: rows, Unblock stays "Unblocked", empty and failed states; the Settings rows (Blocked players for players only, Contact support for both: address, null, not loaded, `mailto:` failure).
- Login: the suspension alert without Resend; `AuthContext.login`'s `suspended`.
- Admin: the Reports cards for each type, "Reported as", the three actions and their dialogs, 404 and 409; the Users list with search and "Show", the pills, suspend and unsuspend dialogs, no actions on the admin row, delete through the shared dialog; the Dashboard card and where it goes; Teams and Venues per Q6 and Q7; the review screen's one-venue load.
- `navigation.test.js`: `Report` in every stack with the team screens, `BlockedPlayers` in the player's Profile stack, the rebuilt admin screens.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

### f.4 On the emulator

For the owner to check by hand; run the migration first and restart the backend; a reload is enough for the app. Accounts: the Quick login players A (`aa`) and B (`ab`), the owner (`bb`) and the admin (`ad`), plus a throwaway player C; log out and in to switch.

1. Without `SUPPORT_EMAIL` in `backend/.env`: as A, Profile → gear: **Contact support** says "Not set up yet". Add `SUPPORT_EMAIL=help@example.com`, restart the backend, open Settings again: the address shows; tapping opens the mail app (or says "Write to help@example.com.").
2. As A, create "Alpha FC". As B, ask to join Alpha FC. As A, open B's page (from the join request): **Report** and **Block** at the bottom.
3. Tap **Block**: the dialog says what blocking does. Confirm. The page shows "You've blocked B." and **Unblock**. Open Alpha FC: B's request is gone. B isn't in Explore → Players or Invite players.
4. As B: no update about it. Alpha FC's Request to join gives "You can't ask to join this team." A isn't in B's Explore → Players. A's page (from a team you share, if any) opens without an invite card.
5. As A: Settings → **Blocked players** lists B. Tap **Unblock**: the row says "Unblocked". Leave and come back: the list is empty ("You haven't blocked anyone.").
6. As A, open B's page → **Report**. Tap Send with nothing chosen: "Choose a reason". Choose **Other** with no note: "Tell us what's wrong in the note". Choose **Offensive name or content**, add a note, send: "Thanks, we'll review it.", and the button now says **Reported**. As C, report B too, with **Spam**.
7. As the owner (`bb`), open Alpha FC from Explore and report it; on your own venue's page there's no Report button.
8. As the admin: the Dashboard shows **Open reports 2**; tap it: the Reports tab. B's card says "2 reports", both reasons, both notes and who sent them. Alpha FC's card says "Captain: A".
9. Tap **Dismiss** on Alpha FC's card and confirm: it goes. Tap **Suspend** on B's card and confirm: it goes.
10. B (if still logged in somewhere): the next tap shows "Your session has expired". Log in as B: **"Account suspended"** with "Your account has been suspended. Contact help@example.com.", and no Resend button.
11. As A: B isn't in Explore → Players. If B is in a team, its Members card still lists B, and B's page says "This player isn't available any more."
12. As the admin, **Users**: search part of B's email: B shows "Player" and "Suspended". "Show: Suspended" lists only suspended accounts. Tap **Unsuspend** and confirm. B can log in again.
13. Make B captain of a team with a free spot, suspend B, and as C open that team: Request to join is disabled with "This team isn't taking new members right now." The team is still in Explore → Teams.
14. Suspend the owner (`bb`): as A, the venue is gone from Explore → Venues. Unsuspend it afterwards.
15. Users tab: the admin's own row has no buttons. Delete a throwaway account: feature 4's dialog, as before.
16. Largest font size: the Report form, the Block dialog, the Reports cards and the Users cards wrap, and every button stays reachable.

Afterwards, unsuspend and unblock what you changed on `aa`, `ab` and `bb` (or run `node scripts/seedDevAccounts.js` to reset them).

## g. Task split

1. **F6.1 Backend: data and settings.** The `moderation` migration (after approval), `SUPPORT_EMAIL` and `GET /app/config`, the deletion's cleanup of reports and blocks (P7), `src/utils/moderation.js`.
2. **F6.2 Backend: blocking.** The block routes and list, the locked cancellation (P21), P22 in transfer and handover, discovery, the refusals, `blockedByMe`; with the race tests. It creates `moderationController.js`, so it also documents it in TECHNICAL.md 4.1 as the exception to "each route file maps to a controller with the same name" (P1).
3. **F6.3 Backend: suspension.** Suspend and unsuspend, the login reply, `verifyToken`, every row of d.4 for suspension (P16–P19), the admin Users list (search, filters, paging).
4. **F6.4 Backend: reporting.** The report routes and limiter, `reportedByMe`, the admin reports list, dismiss, suspend from reports (P11), `openReportCount`.
5. **F6.5 App: player and owner screens.** Report and Block buttons, the Report form, Blocked players, Contact support, the suspension alert, `acceptingMembers`.
6. **F6.6 App: admin.** The Reports screen, the rebuilt Users tab, the Dashboard card.
7. **F6.7 Admin Teams and Venues lists** (Q6, Q7), backend and app, and the one-venue review screen (P29). Also removes `getAllTeams`' unused fallback to a venue name for a team's captain (`adminController.js`; captains are always players).

Docs in the same commits: TECHNICAL (2, 4.1, 4.5, 4.7, 5.1, 5.2, 5.3, 6, 7, 8), ARCHITECTURE (the tables, login, a "Moderation" flow), CLAUDE.md (blocks and suspension go through `moderation.js`; the block's team locks), README and `.env.example` (`SUPPORT_EMAIL`), PRODUCT.md's "Interim screens", the draft Privacy page (reports and blocks under "What we store"). Then the ROADMAP items are ticked.

## h. Open questions

Questions the docs and code don't settle, and contradictions found while writing this spec. Each has a recommendation; the sections above follow it.

| | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Can venue owners block players? | (a) No: Block is for players only. (b) Yes, which only hides players from the owner's Explore and the owner from nobody (owners aren't in player lists) | **(a).** Owners have no one-to-one interaction to stop (no invites, no requests), which is what the Play policy is about; they can still report. Easy to add later |
| Q2 | What does B see on the Player detail of A, who blocked B? And how silent is "silent" when B is refused? | (a) The page as usual, without an invite card; a refusal only if B tries to join a team A captains ("You can't ask to join this team."). (b) 404 "This player isn't available any more.", as if A were gone. (c) As (a), but pretend B's request was sent | **(a).** A still appears in shared teams' Members cards, so (b) would contradict what B sees there, and PRODUCT.md hides the pair only from lists and search. (c) misleads. The refusal gives no reason, so the 2026-11-18 "don't tell blocked users" still holds |
| Q3 | Which team is "your own team" for reporting (D2)? | (a) A team you captain. (b) Any team you're a member of | **(a).** A member didn't choose the team's name or description and may be the one who objects to it |
| Q4 | Contradiction: "Handled reports are marked resolved" (PRODUCT.md), but deleting the user or team is a full deletion (account deletion rules), so its reports can't stay to be marked | (a) Reports go with the deleted item; dismiss and suspend mark them resolved. (b) Keep them with the target emptied, marked "deleted" | **(a).** A report's note usually names the person; keeping it after a full deletion would break "not hiding or anonymising" |
| Q5 | Contradiction: a suspended user "doesn't appear in discovery or lists" (PRODUCT.md), but a suspended captain's team stays listed with its members (decided). Do suspended members still show in their teams? | (a) Yes: in Members, as captain, on team cards; their Player detail is 404 for others. (b) Hide them from member lists and team cards | **(a).** "Lists" means discovery (Explore, invite search); a team shown without its captain, or with a member count that doesn't match its list, would be confusing |
| Q6 | Is the admin Teams tab in scope? DECISIONS 2026-11-21 left an admin team screen for moderation, and the ROADMAP item names `/admin/teams` | (a) Yes: rebuilt list with search, paging and delete, no team detail screen (P39). (b) Only the endpoint's paging; the old screen stays for Step 4 | **(a).** It's the last old screen with Ionicons, it's where a reported team's context lives besides Reports, and the endpoint changes anyway. Its own task (F6.7) |
| Q7 | Paging the admin's Venues list (the ROADMAP item) | (a) Page it and keep the approved order (venues spec P13) with one extra count. (b) Page it with a simpler order (pending first, then all by name), which changes P13. (c) No paging in v1.0 | **(a)**, in F6.7. Venues are few, but the item asks for it and the order the admin approved stays |
| Q8 | "B can't request to join A's teams" (decided). Can A, the blocker, still ask to join a team B captains? | (a) No: no invites or requests either way between a blocked pair. (b) Yes: only the blocked side is limited | **(a)**, with a message that tells A why (P23). The cancellation decision already treats both directions the same |
| Q9 | Can a suspended member become captain (account deletion spec, section g)? | (a) Transfer refused; a handover passes over suspended members unless only they are left (P19). (b) No special rule: the team then just takes no new members. (c) Delete the team when only suspended members are left | **(a).** A team needs a captain who can log in; deleting other members' team is harsher than keeping it closed |
| Q10 | The notifications spec's Q7: a team deleted for an offensive name keeps that name in its members' update ("moderation may revisit it") | (a) Keep it. (b) For an admin deletion, say "A team you were in was deleted." without the name | **(a).** The members know the name anyway, and the update without it means nothing to someone in several teams |
| Q11 | P18: a suspended player's pending join requests | (a) Hidden from captains and not approvable, back on unsuspend. (b) Left as they are. (c) Deleted at suspension | **(a).** PRODUCT.md keeps their data; (b) lets a captain bring a suspended account into a team |

## i. Proposals

Defaults from the brief, waiting for the owner's confirmation:
- **D1** `SUPPORT_EMAIL` backend setting, optional until Phase 5, with a placeholder; the app reads it from the backend (b.3, d.7, e).
- **D2** Report buttons at the bottom of the three detail screens; players and owners report, never themselves, their team or their venue; "Reported" afterwards (b.1, e; Q3).
- **D3** Reports grouped by item; dismiss resolves all; suspend the user or captain; delete with feature 4's preview; resolved marked (b.4, d.6, e).
- **D4** Suspension sets a timestamp and increases `tokenVersion`; the login message after the password check; a suspended owner's venue leaves discovery; no notification (b.3, d.5).
- **D5** The Users tab rebuilt with search, paging, role and state, suspend, unsuspend and delete; the Dashboard's open-reports count (d.6, e).

Proposed by Claude Code:
- **P1** Report and block routes on the item's own router; one `moderationController.js` (d.1).
- **P2** Five reasons, "fake" worded per item (b.1).
- **P3** Note up to 200 characters, required with "Other" (b.1).
- **P4** `nameAtReport`, so a renamed item still shows what was reported (c).
- **P5** At most 10 reports an hour per account (d.2).
- **P6** One `Report` table, two unique indexes, `CHECK`s added by hand (c).
- **P7** Reports and blocks go with a deleted user or team (c; Q4).
- **P8** `resolvedAt` and `resolution`; resolved reports kept, only open ones shown (c).
- **P9** Reports list order and the 20-report cap per item (d.6).
- **P10** Dismiss and suspend with `upToId` (d.6).
- **P11** Suspending resolves every open report about that user (b.4, d.5, d.6).
- **P12** `suspendedAt` instead of a yes/no, no index (c).
- **P13** Login: 403 with `suspended: true`, checked before "verify" (d.5).
- **P14** `verifyToken` also refuses a suspended account (d.4).
- **P15** Suspension takes no team locks (d.5).
- **P16** One `moderation.js` for "active", blocks and the cancellation (d.4).
- **P17** `acceptingMembers` on team replies, and the "isn't taking new members" message (b.3, d.4, e).
- **P18** A suspended player's pending join requests are hidden and not approvable (b.3, d.4; Q11).
- **P19** No transfer to a suspended member; the handover passes over them (b.3, d.4; Q9).
- **P20** Block and unblock always reply 200 (d.3).
- **P21** The block's transaction: team locks first, retry, then cancel and insert (d.3).
- **P22** Transfers and handovers cancel pending items between the new captain and their blocked pairs (b.2, d.3).
- **P23** Blocks apply both ways (Q8); refusals explicit only to the blocker (b.2, d.4).
- **P24** `blockedByMe` and `reportedByMe`, never "blocked you" (d.4).
- **P25** The blocked list is paged, newest first (d.3).
- **P26** `GET /app/config`, no login (d.7).
- **P27** `SUPPORT_EMAIL` checks, the placeholder text and the start-up line (d.7).
- **P28** `role` and `state` filters on the admin's Users list; one "Show" choice in the app (d.6, e).
- **P29** `GET /admin/indoors/:id` for the review screen (d.6, e).
- **P30** Report and Block as danger buttons side by side; the Report form in `teamScreens()` (e).
- **P31** The Report form and what each reply shows (e).
- **P32** The Block dialog's words; the blocked state; unblock without a dialog (e).
- **P33** Unblocked rows stay until the screen is left (e).
- **P34** Contact support with `mailto:` and its states (e).
- **P35** The "Account suspended" alert, without Resend (e).
- **P36** The Reports cards, with what was reported shown inline (e).
- **P37** The Users cards and the suspend and unsuspend dialogs (e).
- **P38** "Open reports" first on the Dashboard (e).
- **P39** Rebuilt Teams list and paged Venues list, if Q6 and Q7 say so (e).
- **P40** No updates for moderation; old updates naming a blocked player stay (f.2).
