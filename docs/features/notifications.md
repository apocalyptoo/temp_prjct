# Feature 5: Notifications (spec)

Phase 4, Step 3. Task F5.0, written 2026-11-26. **Status: approved 2026-11-26** (DECISIONS.md, "Notifications feature spec approved"). **F5.1 and F5.2 built 2026-11-26.** Where the text below differs from this list, this list is what was built:

- **F5.1:** `createUpdates` refuses to run without `actorId`, so a caller can't forget D3. The sentences (`updateText`, P14) were built here, because the create tests check them; `opens` comes with the endpoints. The race of an account deletion against `read` (section h) came with F5.2, when `read` existed. Two orderings have no test that fails without them (the `ORDER BY` of the user lock, and the row order when an account's updates are removed): Postgres happens to visit the few test rows in id order.
- **F5.2:** `GET /players/invites` and its tests stay until F5.3 (P11), so the move of those test cases (section h) happens there too. The badge counts the unread among the newest 50, the same updates the screen shows.

**How to read the markers:**
- **Decided**: one of the owner's three decisions of 2026-11-26 (DECISIONS.md, "Notification details"), or a rule already in PRODUCT.md or DECISIONS.md.
- **[Dn, approved]**: a default from the task brief, confirmed by the owner on 2026-11-26.
- **[Pn, approved]**: proposed by Claude Code, with its one-line reason, approved by the owner on 2026-11-26. All are listed in section k.
- **Qn**: a question or contradiction found while writing the spec. The owner answered them on 2026-11-26; the answers are in section j and built into the sections above.

---

## a. What it covers

The Notifications item in ROADMAP Step 3:

1. **Updates:** a new table, and one shared helper that every action calls to create them.
2. **The Notifications screen** for players and venue owners: "Needs your action" (players) and "Updates".
3. **Read and unread**, and marking updates as read.
4. **The badge** on the Notifications tab.
5. **The end of the interim screens:** the player's Invites screen and the owner's empty screen.

Not covered: push and email notifications (PRODUCT.md, "Not in v1.0"); reports, blocks and suspension (moderation; section g); an admin Notifications tab (PRODUCT.md has none, D5); the account emails (unchanged).

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [Notifications](../PRODUCT.md#notifications-v10): the events, the two sections, the badge, the newest 50, freshness, what's not in v1.0.
- [Team membership](../PRODUCT.md#team-membership-v10): invites, join requests, the private request message, "Decline", the 15-member limit, leaving and captaincy.
- [Venue owners](../PRODUCT.md#venue-owners-v10): approval, moving back to review, the admin's note.
- [Account deletion](../PRODUCT.md#account-deletion-v10): full deletion, the automatic handover.
- [Profile visibility](../PRODUCT.md#profile-visibility-v10): a name, position and area are public to logged-in users.

### b.1 The updates

**[P1, approved] The wording:** every sentence names the team or venue. Reason: a player can be in several teams.

| Type | When | Who receives it | Exact text | Tapping opens [P22, approved] |
|---|---|---|---|---|
| `requestApproved` | The captain approves a join request, or invites a player who had already asked | The requester | "Your request to join {team} was approved." | Team detail |
| `requestDeclined` | The captain declines a join request | The requester | "Your request to join {team} was declined." | Team detail |
| `inviteAccepted` | An invited player accepts, or asks to join a team that had invited them | The captain | "{player} accepted the invite to {team}." | Team detail |
| `inviteDeclined` | An invited player declines | The captain | "{player} declined the invite to {team}." | Player detail |
| `memberRemoved` | The captain removes a member | The removed player | "You were removed from {team}." | Team detail |
| `memberLeft` | A member leaves the team | The captain | "{player} left your team {team}." | Player detail |
| `memberLeft`, without a name (Q2) | A member's account is deleted | The captain | "A member left your team {team}." | Team detail |
| `becameCaptain` | A transfer, or a handover after an account deletion | The new captain | "You're now the captain of {team}." | Team detail |
| `teamDeleted` | The team is deleted | Its accepted members | "{team}, a team you were in, was deleted." | Team detail (gone) |
| `teamDeletedInvite` | The same | Everyone with a pending invite | "{team}, which had invited you, was deleted." | Team detail (gone) |
| `teamDeletedRequest` | The same | Everyone with a pending join request | "{team}, which you asked to join, was deleted." | Team detail (gone) |
| `venueApproved` | The admin approves the venue | The venue owner | "{venue} was approved. Players can find it now." (Q4) | My Venue |
| `venueMovedToReview` | The admin moves the venue back to review | The venue owner | "{venue} was moved back to review." and on a second line "Note from the admin: {note}" | My Venue |

- **[P2, approved] Three types for a deleted team.** Reason: "a team you were in" is wrong for someone who was only invited, and the sentence reminds them why they're told.
- **[P3, approved] "The invite", not "your invite".** Reason: a handed-over team keeps its pending invites, so the captain who hears the answer may not be the one who sent it (nothing stores who did).
- **[P4, approved] No text names a captain or the admin.** Reason: the player needs to know what happened to them, not whom to be angry at, and a transfer and a handover then read the same.
- **"The captain" is whoever is captain at that moment**, read under the team lock.

### b.2 No update

- A player cancels their join request (decided).
- A captain cancels a pending invite (as in the team membership spec; the invite just disappears).
- A new invite or join request: it's a "Needs your action" item instead.
- Creating or editing a team; the admin saving a note on a pending venue (venues spec, section g).
- A deleted account's own pending invites and requests (account deletion spec, section g).
- A deleted account's other teams hear nothing beyond `becameCaptain` (the new captain) and Q2.
- **[D3, approved]** The person who did the action never gets an update about it. So a captain who deletes a team isn't told, but a captain whose team the admin deletes is.

### b.3 Other details

- **[D2, approved]** An update stores the names it mentions as they were at that moment, plus ids that may later point to nothing. A renamed team keeps its old name in old updates; tapping opens the team as it is now.
- **"Newest" means the highest id [P5, approved].** Reason: updates for one user are added one after the other (d.3), so the id order is exact, while two `createdAt` times can be equal or cross over.
- **[P6, approved] No backfill.** Updates start from the day the feature is built. Reason: nothing records what happened before. "Needs your action" shows existing invites and requests at once.

## c. Data changes

One migration, `notifications`. **It needs the owner's approval when it's created in the backend task (F5.1).** It only adds things.

```prisma
model Notification {
  id         Int              @id @default(autoincrement())
  userId     Int              // who it's for
  type       NotificationType
  teamId     Int?             // what it's about; may point to nothing (D2)
  teamName   String?
  playerId   Int?
  playerName String?
  venueName  String?
  note       String?          // the admin's note (venueMovedToReview)
  readAt     DateTime?        // null = unread
  createdAt  DateTime         @default(now())
  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, id])
  @@index([playerId])
}

enum NotificationType {
  requestApproved
  requestDeclined
  inviteAccepted
  inviteDeclined
  memberRemoved
  memberLeft
  becameCaptain
  teamDeleted
  teamDeletedInvite
  teamDeletedRequest
  venueApproved
  venueMovedToReview
}
```

- **[P7, approved] One table with a type enum and one column per name.** Reason: plain columns are easy to read and check, and the enum stops a misspelt type at the database, like `MembershipStatus`. v1.1's events add values in their own migration.
- **[P8, approved] `teamId` and `playerId` are plain numbers with no foreign key; only `userId` has one.** Reason: this is D2's "ids that may later point to nothing". Deleting a team then never has to change other people's updates, and ids are never reused.
- **No venue id.** A venue update always goes to the venue's own owner.
- **[P9, approved] `readAt` instead of a yes/no.** Reason: the same information, plus when, like `approvedAt`.
- **[P10, approved] The two indexes:** by user and id (the list, the count, the removal beyond 50), and by player (Q1). Reason: every query uses one of them.

| What is deleted | What happens to updates |
|---|---|
| The user an update is for | All their updates are deleted with the account, explicitly in the shared deletion; the cascade is the safety net |
| The team it mentions | It stays, with the name; tapping says the team isn't available any more |
| The player it mentions | It's deleted too (Q1) |
| The venue it mentions | Only happens with its owner's account, so it goes too |

## d. API

### d.1 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `GET /notifications` | player, venue owner | new |
| 2 | `GET /notifications/count` | player, venue owner | new **[D4, approved]** |
| 3 | `POST /notifications/read` | player, venue owner | new |
| 4 | `GET /players/invites` | player | removed **[P11, approved]**, once the app no longer uses it (F5.3) |
| 5 | The actions in d.4 | as today | changed inside; replies, codes and messages stay word for word |

**[P12, approved]** A new router, `/notifications` (`notificationRoutes.js`, `notificationController.js`, `notificationSchemas.js`). Every route has `verifyToken`, then `notAdmin("The admin account has no notifications.")`: 403 for the admin. Reason: it serves two roles, so it belongs to neither `/players` nor `/owners`.

**[P11, approved]** `GET /players/invites` goes. Reason: only the Invites screen uses it, and endpoint 1 returns the same invites; two copies could drift apart. Its tests move to endpoint 1. Accepting, approving and declining use the existing team endpoints, unchanged.

### d.2 Endpoint details

**1. `GET /notifications`.** No body, no query. A read: no locks. Reply 200:

```json
{
  "count": 3,
  "needsAction": {
    "invites": [
      { "id": 41, "teamId": 7, "createdAt": "…",
        "team": { "id": 7, "name": "Dhanmondi Strikers", "area": "Dhanmondi", "memberCount": 11, "maxMembers": 15,
                  "captain": { "id": 12, "name": "Rahim Uddin" } } }
    ],
    "joinRequests": [
      { "teamId": 9, "teamName": "Mirpur Mavericks", "memberCount": 15, "maxMembers": 15,
        "requests": [
          { "id": 40, "userId": 19, "createdAt": "…", "message": "I play Thursdays with Tanvir",
            "user": { "id": 19, "name": "Nayeem Islam", "playerProfile": { "name": "Nayeem Islam", "position": "Forward", "area": "Mirpur 10" } } }
        ] }
    ]
  },
  "updates": [
    { "id": 88, "type": "inviteDeclined", "text": "Tanvir declined the invite to Mirpur Mavericks.", "note": null,
      "createdAt": "…", "read": false, "opens": { "kind": "player", "id": 31, "name": "Tanvir" } }
  ]
}
```

- **Invites:** the viewer's pending `origin: invite` rows, newest first. **Join requests:** pending `origin: request` rows of teams the viewer captains *now* (`Team.captainId`), one group per team (by name, then id), oldest request first (team membership spec P2). For a venue owner both lists are empty.
- **Visibility:** people go through `toVisibleUser`, and the email is never selected. `origin` and `acceptedAt` stay out. `message` is added back with `toMembershipReply(row, { withMessage: true })`, only in join requests, whose only reader here is the team's captain.
- **[P13, approved] No paging.** Reason: at most 50 updates, and pending items are few; the captain already gets them all on Team detail.
- **Updates:** the viewer's newest 50, newest first. The query also says `take: 50`.
- **[P14, approved] The backend builds `text` and `opens`**, in one function next to the helper. `opens` is `{ kind: 'team' | 'player' | 'venue', id?, name }` or null. Reason: the wording lives in one place, and an app version that doesn't know a newer type still shows a proper sentence. v1.1's push can reuse it.
- **`count`** is what endpoint 2 gives, so the screen sets the badge without a second request.

**2. `GET /notifications/count`.** Reply 200 `{ "count": 3 }`: pending invites + pending join requests of teams the viewer captains + unread updates (decided). **[P15, approved]** The conditions for "pending for this viewer" are written once and used by endpoints 1 and 2. Reason: the badge and the list can't disagree.

**3. `POST /notifications/read`.** Body `{ "upToId": 88 }`, `readNotificationsSchema`: a positive whole number within `MAX_DB_INT`, else 400 "Invalid notification id" (text such as "88" is refused, like `inviteSchema`). It marks the viewer's own unread updates with an id up to that one. Reply 200 `{ "count": 2 }`. An id that isn't theirs, or is gone, isn't an error: only their own rows can change. Calling it twice changes nothing more.
- **[P16, approved]** `upToId` instead of "all". Reason: an update that arrives while the list is loading isn't marked as read before anyone saw it.
- It runs in one transaction that locks the viewer's user row first (d.3).

### d.3 The shared helper (`backend/src/utils/notifications.js`)

`createUpdates(tx, updates, { actorId })` is **the only code that adds rows to the table.**

1. Drop updates for `actorId` (D3). Nothing left: stop.
2. Lock the recipients' user rows in one query, lowest id first (`SELECT id FROM "User" WHERE id = ANY(…) ORDER BY id FOR NO KEY UPDATE`, a tagged `$queryRaw`). A recipient who is gone is skipped.
3. Insert them all.
4. Remove each recipient's updates beyond their newest 50 (decided), in one statement.

**[D1, approved]** It runs inside the action's own transaction.

- **[P17, approved] Called at most once per transaction, as its last step** (in the account deletion: after the teams are handled, before the user's own rows go). Reason: one sorted lock can't make two actions wait for each other; two calls could.
- **[P18, approved] The recipients' user rows are locked.** Reason: two actions in two teams can notify the same person at once. Without it neither sees the other's new row, and 51 can stay. `FOR NO KEY UPDATE` doesn't block other people's inserts that only refer to the user.
- **[P19, approved] The removal skips rows another transaction has locked** (`FOR UPDATE SKIP LOCKED`), and the other multi-row changes lock rows in id order. Reason: tidying up must never make a real action wait or deadlock. The only rows it can meet are ones an account deletion (Q1) is already removing.

**Why this is safe with account deletion.** A deletion locks all its teams, then its user. A team action holds its team's lock first, and everyone it notifies has a row in that team or is its captain, so it and that person's deletion run one after the other. Venues have no team lock:

- **Tried on 2026-11-26** (throwaway owners in the local database, deleted afterwards): an approval that updates the venue and then touches the owner's user row, against the deletion's lock order. The two deadlocked (Postgres 40P01) in both orders, and one of them failed with a server error. With the owner's user row locked **first**, all four runs were clean: the approval, then the deletion; or the deletion, and the approval finds nobody.
- **[P20, approved] So approve and move-to-review become transactions that lock the owner's user row first**, then do today's conditional update, then call `createUpdates`. No such user: today's 404 "Venue not found". Reason: the test above. (Q6: the venues spec says the hook comes after the update.)

The 51-row race and the deadlock get their own tests (section h).

### d.4 Every place an update is created

Hook comments exist today in only two files: `adminController.js` (2) and `deletion.js` (2). **The team actions have none**; their list was only in the team membership spec, so it's written out here. `membership.js` and the player invites need no hook.

| Where | Function | Updates | `actorId` |
|---|---|---|---|
| `teamController.js` | `approveRequest` | `requestApproved` → requester | captain |
| | `invitePlayer`, when it approves a request | `requestApproved` → that player | captain |
| | `rejectRequest` | `requestDeclined` → requester | captain |
| | `acceptInvite` | `inviteAccepted` → captain | player |
| | `requestToJoin`, when it accepts an invite | `inviteAccepted` → captain | player |
| | `rejectInvite` | `inviteDeclined` → captain | player |
| | `removePlayer` | `memberRemoved` → removed player | captain |
| | `leaveTeam`, a member | `memberLeft` → captain | player |
| | `leaveTeam`, the last member (Q3) | `teamDeletedInvite`, `teamDeletedRequest` | captain |
| | `transferCaptaincy` | `becameCaptain` → new captain | captain |
| | `deleteTeam` | the three deleted-team types | captain |
| `adminController.js` | `deleteTeam` (through `deleteTeamAndMembers`) | the three deleted-team types, captain included | admin |
| | `approveIndoor` | `venueApproved` → owner | admin |
| | `moveIndoorToReview` | `venueMovedToReview` with the note → owner | admin |
| `deletion.js` | `deleteInTransaction`, a handover | `becameCaptain` → new captain | the deleted user |
| | `deleteInTransaction`, a deleted team | `teamDeletedInvite`, `teamDeletedRequest` | the deleted user |
| | `deleteInTransaction`, their other teams (Q2) | `memberLeft` without a name → captain | the deleted user |

Nothing else writes memberships, captains or approvals (checked in `backend/src`, 2026-11-26). `createTeam`, `updateTeam`, `cancelInvite`, `cancelMyRequest` and `setIndoorNote` create none.

- **[P21, approved] `removeTeamRows` reads who must be told before it deletes the rows, and returns the updates** for its caller to pass to `createUpdates`. Reason: after the delete nobody knows who was in the team. It can't call the helper itself, because an account deletion can delete several teams (P17).
- `lockTeam` and `lockTeams` also select the team's `name` (read under the lock, so the snapshot is right). The actor's name is read where a text needs it.
- `rejectInvite` deletes first and checks the count, as today; the update is created only when a row was deleted. Refused actions (403, 404, 409) create nothing.
- The deletion also deletes the user's own updates, and those that name them (Q1), at the comment that marks the place.

## e. Screens

Built from `src/components/ui` with theme tokens only; every button that sends a request uses `useBusyAction`. No new component, icon or token is needed.

### The Notifications screen (new, `src/screens/Shared/NotificationsScreen.js`) **[D5, approved]**

One screen for players and venue owners, registered as `Notifications` in both Notifications stacks. It loads `GET /notifications` whenever it comes into view, on pull to refresh, and when the app comes back to the foreground on it (PRODUCT.md, "Freshness"). A spinner first; a failed first load: "Couldn't load your notifications." with **Try again** (`TeamLoadState`); a failed reload keeps what's shown.

`ScreenHeader` "Notifications", then:

**1. Needs your action** (`SectionHeader`; players only **[P23, approved]**, reason: an owner never has any, so the heading would be noise).
- **Invites** first: the card from today's Invites screen, unchanged: team name, "{captain} invited you · 11 / 15 members", **Accept** (disabled with "Team is full (15/15)" when full) and **Decline** side by side. Tapping the card opens Team detail.
- **Join requests** next: **[P24, approved]** one card per team, headed "Join requests · {team}" with the count `Pill`, and the same rows as on Team detail (the row moves out of `TeamDetailScreen` into a shared file): avatar, name, "Position · Area", the quoted message, and the decline and approve icon buttons beside the row. Tapping the row opens Player detail. Reason: the captain knows these rows, and requests to one team belong together.
- **[P25, approved] The same confirmations as today:** declining a join request asks first ("Decline {name}'s request?"); accepting, approving and declining an invite don't. Approving in a full team shows the backend's "Team is full (15/15)." Reason: one action behaves the same wherever it is.
- After an action the list reloads; no success alerts (team membership spec P16).

**2. Updates** (`SectionHeader`), one `Card` with a `ListRow` per update, newest first: an icon, the text, the time, and the admin's note as the row's third line.
- Icons: `approve` (approved, accepted, venue approved), `reject` (declined), `remove` (removed), `leave` (left), `captain` (became captain), `delete` (team deleted), `venue` (moved back to review).
- **[P26, approved] Unread = a soft `Pill` "New"** at the end of the row, and "New." first in what screen readers hear. Reason: a word, never only a colour (DESIGN 3), and an existing component.
- **[P27, approved] Times:** "Just now" (under a minute, or the phone's clock is behind), "5 min ago", "3 h ago", "Yesterday", then "12 Nov", with the year when it isn't this one. Built by a small `timeAgo` function. Reason: no new package.

**Marking as read [D4, approved].** When a load brings unread updates, the screen sends `POST /notifications/read` with the newest id shown. Rows that were unread in this visit keep "New" until the user leaves the screen (another screen or tab), also after a pull to refresh or an action. **[P28, approved]** Putting the app in the background isn't leaving. Reason: glancing at another app shouldn't lose the highlight. If the request fails, nothing is shown, and the next visit tries again.

**Tapping an update [P22, approved]** opens what b.1 says. Reason for Player detail on declined and left: that's where the captain can invite the person again.
- **Gone:** Player detail already says "This player isn't available any more."; Team detail says "This team isn't available any more." (Q5). An update whose `opens` is null isn't tappable.
- **Venue updates** open the owner's My Venue (`navigate('MyVenueTab', { screen: 'MyVenue' })`, as on the owner's Profile). Reason: Venue detail shows only live venues, so after "moved back to review" it would wrongly say the owner's own venue isn't available.
- **Back links:** "Invites" becomes "Notifications" on Team detail and Player detail **[P29, approved]** (reason: the link names the screen underneath).

**Empty states [P30, approved]:** "Nothing needs your action." and "No updates yet." under their headings; with both empty, or for an owner with no updates, one line: "No notifications yet." No button. Reason: every list has one (DESIGN 6), and there's nothing to do here.

### The badge **[D4, approved]**

A red count on the Notifications tab through the standard `tabBarBadge` option (`TabBar` and `Badge` already support it: hidden at 0, "99+" above 99, read out as "Notifications, 3").

- **[P31, approved] A `NotificationsProvider`** (`src/contexts/NotificationsContext.js`) inside the player's and owner's navigators holds the count. Reason: it starts at login and ends at logout, so one account's number can never show for the next, and the admin has none.
- **It refreshes** (`GET /notifications/count`): when the app opens or someone logs in; when the app comes back into view (`AppState`); when the user switches tabs (switching to Notifications loads the whole screen instead, which brings the count); after any action that changes it.
- **[P32, approved] "After any action" is one listener in `api.js`:** every request other than a GET to `/teams…` that ends with 2xx, 404 or 409. Reason: buttons on several screens change the count, and a new one can't forget it. Creating or editing a team also triggers it, which is harmless.
- **[P33, approved] A reply that arrives after a newer one is ignored, and a failed refresh keeps the last number.** Reason: the badge must not jump back or disappear because of a bad connection.

### Navigation and what's deleted

- Player's Notifications stack: `Notifications` (was `Invites`) plus the team screens. Owner's: `Notifications` (was `OwnerNotifications`). Admin: unchanged.
- **Deleted:** `src/screens/Player/InvitesScreen.js`, `src/screens/Owner/OwnerNotificationsScreen.js`, `__tests__/team-invites-screen.test.js` (its cases move to the new screen's tests), and `getPendingInvites` with its route (P11).
- PRODUCT.md's "Interim screens" loses the Notifications line when it's built.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| An invite is cancelled while the screen is open | Accept: 404 "Invite not found" | "Something changed" alert, the list reloads without it |
| A join request is cancelled while the captain looks at it | Approve: 404 "Join request not found"; no update was created | Alert, reload |
| The captain hands over the team while the list is open on another phone | Approve: 403 "Only the team captain can approve or reject join requests." | **[P34, approved]** The alert, and this screen reloads on a 403 too (reason: the request is no longer theirs to answer) |
| The team fills up meanwhile | 409 "Team is full (15/15)."; the item stays pending and still counts | Alert, reload; Accept is disabled |
| The same action from two devices | The team lock: one 200, one 404. One update | The second shows "Something changed" |
| A team is deleted while an update about it is shown | The update stays; a `teamDeleted…` one is added | Tapping the old one: not available any more |
| A team is deleted while its invite is shown | Accept: 404 "Team not found" | Alert, reload: the invite is gone and the update is there |
| The admin deletes a team | Captain, members, invited and requesting players get their update | — |
| A lone captain leaves, or deletes their account | Invited and requesting players get their update | — |
| A deleted team where someone could count twice | A person has at most one row per team (unique `teamId` + `userId`), so one update each | — |
| An action fails half-way | Everything is undone, the update too (D1) | The usual error |
| 50 updates and a new one | The oldest goes, read or unread; the count follows | — |
| Two actions notify one person at once | The second waits for the first; exactly 50 stay | — |
| An update arrives while the screen loads | Not marked as read (P16) | Counted in the badge; shown as "New" on the next load |
| The screen is open on two phones | Read on both; `read` twice is harmless | The other phone's "New" stays until it leaves the screen |
| The team or player is renamed | Old updates keep the old name (D2) | Tapping opens it with the new name |
| A player mentioned in an update deletes their account | Those updates are deleted (Q1) | Gone on the next load |
| The recipient deletes their account | Their updates go with it | — |
| A recipient's account is deleted in the middle of an action | They're skipped; the action succeeds | — |
| The owner deletes their account while the admin approves | One after the other, no deadlock (P20): approved then deleted, or 404 "Venue not found" | The admin's existing handling |
| The admin approves twice at once | One 200 and one update; the other 409 "This venue is already live" | — |
| The venue is approved after "moved back to review" | Both updates stay, the older one with its note | — |
| The captain of several teams | One group per team | One card per team |
| The admin calls `/notifications` | 403 "The admin account has no notifications." | No such tab |
| A bad `upToId` (missing, text, 0, 2147483648) | 400 "Invalid notification id" | The app sends a real id |
| Someone else's `upToId` | Only the caller's own rows can change | — |
| No connection | — | The list and badge keep what they had; a first load says so |
| Log out, log in as someone else | — | The badge starts from nothing (P31) |
| Very long names, largest font size | — | Rows wrap |

## g. Hook points for later features

- **Moderation:** a suspended person's updates (they can't log in, so they're simply kept); whether a blocked player's name still appears in old updates; hiding a blocked player's pending invite or request, at the one place that says what's pending (P15). A team deleted for an offensive name still shows that name in the update (Q7).
- **v1.1:** challenges and results add types. Push can send the same `text` from `createUpdates`' callers.

## h. Test plan

**Backend** (`node:test`, real HTTP, throwaway users):
- `tests/notifications-data.test.js`: the columns, the enum and the indexes exist; deleting a user removes their updates.
- `tests/notifications-create.test.js`: one test per row of d.4, with type, names, recipient and exact text; nobody else gets one; the actor gets none (D3), but a captain whose team the admin deletes does; every refused action and everything in b.2 creates none.
- `tests/notifications-helper.test.js`: a transaction that fails after `createUpdates` leaves no update, and one whose `createUpdates` fails leaves the action undone (D1); the 51st removes exactly the oldest, only for that user; a recipient who is gone is skipped.
- `tests/notifications-races.test.js`, many rounds: two teams notify a player who has 50 already (exactly 50 stay); approve and move-to-review against the owner deleting their account (no 500); two teams with the same members deleted at once; the deletion of a much-mentioned player against actions and `read` (Q1). Checked once by hand that the first fails without the user lock, and the second with the venue updated first.
- `tests/notifications-list.test.js`: the reply for a player, a captain of two teams, an owner; order; the message only for the current captain and gone after a transfer; no email or phone anywhere; `count` equals endpoint 2 and follows every change; `opens` for each type; 403 for the admin, 401 without a login.
- `tests/notifications-read.test.js`: up to an id; never another user's; a later update stays unread; twice; every bad body.
- Updated: `admin-delete.test.js` (rollback with the new steps), `delete-account.test.js`, `delete-account-races.test.js`, `venue-review.test.js`; the `/players/invites` cases in `captain-id`, `invites-captain-name`, `membership-data`, `pending-invites`, `player-detail`, `team-area` and `visibility` move to `/notifications`.

**App** (Jest, fake API):
- Notifications screen: the sections for a player and an owner; invites and grouped requests with their messages; each button sends the right request once on a double tap; the decline dialog; 403, 404 and 409 alert and reload; a full team; updates with icon, time and note; "New" stays through a refresh and an action, and goes after leaving; `read` gets the newest id and isn't sent with nothing unread; a failed `read`; where each kind of tap goes, and a null `opens`; every empty state; a failed first load; reload on foreground.
- Badge: count on start, foreground, tab switch and after a `/teams` change (also 404 and 409), not after a GET; late and failed replies; nothing carried over to the next login; none for the admin. The `api.js` listener.
- `timeAgo`: each step, and a clock that's behind. Team detail: the gone state (Q5). `navigation.test.js`: the routes and back links.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (for the owner to check by hand; backend running; players A, B and C, venue owner O, the admin, all throwaway; log out and in to switch):
1. As A, create "Alpha FC" and invite B. Log in as B: the Notifications tab has a red **1**. Open it: the invite is under "Needs your action"; "Updates" says "No updates yet."
2. Tap the invite's card: Alpha FC opens, and the back link says "Notifications". Go back and tap **Accept**: the card and the badge disappear.
3. As A: badge **1**. Open Notifications: "B accepted the invite to Alpha FC." with "New"; the badge goes. Pull to refresh: "New" stays. Go to My Teams and back: "New" is gone.
4. As C, ask to join Alpha FC with a message. As A: badge 1, the request with its message. Tap the row: C's page. Back, tap approve. As C: "Your request to join Alpha FC was approved."
5. As A, create a second team. As C, ask to join it, then cancel. As A, pull to refresh: the request is gone, with no update.
6. As A, invite a player and let them decline: "… declined the invite to Alpha FC." Tap it: their page.
7. As C, leave Alpha FC. As A: "C left your team Alpha FC."
8. As A, remove B. As B: "You were removed from Alpha FC." Tap it: the team opens, with Request to join.
9. As A, invite B again (B accepts) and transfer captaincy to B. As B: "You're now the captain of Alpha FC." A has no update about it.
10. As B, invite C and let another player ask to join, then delete Alpha FC. A, C and the other player each get their own sentence; B gets none. Tap one: "This team isn't available any more."
11. While B's Notifications screen shows an invite, cancel it from the captain's phone (or with a second emulator). Tap Accept: "Something changed", and the list reloads.
12. Give O a complete, pending venue. As the admin, approve it, then move it back to review with a note. As O: badge 2, both updates, the note under the second. Tap one: My Venue. O sees no "Needs your action".
13. Put the app in the background, send A an invite from another phone, and come back: the badge appears. Switch tabs: it stays right.
14. Delete a player's account whose name is in one of A's updates (Q1): after a refresh that update is gone.
15. The admin has no Notifications tab. Log out from an account with a badge and log in to one without: no badge.
16. Largest font size: the cards, rows and buttons wrap and stay reachable.

## i. Task split

1. **F5.1 Backend: the table and creating updates.** The migration (after approval), `createUpdates` with its tests, then the hooks in small commits: teams · deletions · venues (with the two transactions), with the race tests. Removes the hook comments. The draft Privacy page gains notifications under "What we store" and "Deleting your account".
2. **F5.2 Backend: the endpoints.** The router, the reading helpers, count and read.
3. **F5.3 App: the Notifications screen**, the gone state on Team detail (Q5), the deleted interim screens, and the removal of `GET /players/invites`.
4. **F5.4 App: the badge.**

Docs in the same commits (TECHNICAL 4.5, 4.7, 6, 7, 8; ARCHITECTURE's flows; CLAUDE.md gains "updates are only created through `createUpdates`"; PRODUCT.md's "Interim screens"). Then the ROADMAP item is ticked.

## j. Answered questions

Questions the docs didn't settle, and contradictions found while writing this spec. The owner answered them on 2026-11-26 (each one as recommended); the answers are built into the sections above.

| | Question | Answer |
|---|---|---|
| Q1 | Contradiction: D2 keeps a snapshot of player names, but PRODUCT.md says deleting an account is "a full deletion, not hiding or anonymising". | **Delete the updates that name the player**, in the same deletion. Only three types name one (accepted, declined, left). |
| Q2 | Does the captain get an update when a member deletes their account? With Q1 it can't name them. | **Yes, without a name:** "A member left your team {team}.", opening the team. A captain's own deletion that hands the team over tells only the new captain ("You're now the captain"). |
| Q3 | The last member leaving also deletes the team, but the decision lists only its captain, the admin and a deleted account. | **Tell the players with a pending invite or request.** The leaver is the captain, so it's a deletion by the captain. |
| Q4 | Contradiction: "Your venue was approved" (PRODUCT.md) or "Your venue is live" (venues spec, code comment). | **"{venue} was approved. Players can find it now."** |
| Q5 | Contradiction: D2 says "isn't available any more"; Team detail shows an alert "This team no longer exists." and goes back. | **Team detail gets the same gone state** as Player and Venue detail, "This team isn't available any more." with Back, wherever it's opened from. This replaces the team membership spec's alert. |
| Q6 | Contradiction: D1 wants the update in the action's transaction; the venues spec and two code comments say "after the successful update". | **D1**, with the owner's row locked first (P20). |
| Q7 | A team deleted because of an offensive name still shows that name in the update. | **Keep the name.** Moderation may revisit it. |
| Q8 | D4's refresh moments differ from PRODUCT.md's "Freshness". | **All of them together.** PRODUCT.md now lists switching tabs and after an action too. |

## k. Proposals (all approved 2026-11-26)

Defaults from the brief, confirmed:
- **D1** An update is created in the same transaction as its action (d.3).
- **D2** A snapshot of names, plus ids that may point to nothing (b.3, c; Q1, Q5).
- **D3** No update for the person who did the action (b.2, d.3).
- **D4** A small count endpoint and its refresh moments; opening the screen marks updates as read, highlighted until the user leaves (d.2, e; Q8).
- **D5** One new screen replaces both interim screens; the admin has no Notifications tab (e).

Proposed by Claude Code, approved:
- **P1** The wording of every update, always naming the team or venue (b.1).
- **P2** Three types for a deleted team: member, invited, requested (b.1).
- **P3** "The invite", not "your invite" (b.1).
- **P4** No text names a captain or the admin (b.1).
- **P5** "Newest" is the highest id (b.3).
- **P6** No backfill (b.3).
- **P7** One table with a type enum and one column per name (c).
- **P8** Plain ids without foreign keys, except the recipient (c).
- **P9** `readAt` instead of a yes/no (c).
- **P10** The two indexes (c).
- **P11** `GET /players/invites` is removed (d.1).
- **P12** A `/notifications` router, 403 for the admin (d.1).
- **P13** No paging (d.2).
- **P14** The backend builds the text and what it opens (d.2).
- **P15** One definition of "pending for this viewer" (d.2).
- **P16** Marking as read up to an id (d.2).
- **P17** The helper is called once per transaction, last (d.3).
- **P18** The recipients' user rows are locked, so 50 holds under races (d.3).
- **P19** The removal skips locked rows (d.3).
- **P20** Approve and move-to-review become transactions, the owner locked first (d.3; Q6).
- **P21** `removeTeamRows` returns who must be told (d.4).
- **P22** What tapping each update opens, with venue updates opening My Venue (b.1, e).
- **P23** No "Needs your action" heading for owners (e).
- **P24** Join requests: one card per team, with Team detail's rows (e).
- **P25** The same confirmations as today (e).
- **P26** Unread is a "New" pill (e).
- **P27** How times are shown (e).
- **P28** The background isn't leaving the screen (e).
- **P29** Back links say "Notifications" (e).
- **P30** The empty states (e).
- **P31** A provider inside each navigator holds the count (e).
- **P32** One listener in `api.js` refreshes the badge after team actions (e).
- **P33** Late replies ignored, failures keep the number (e).
- **P34** A 403 on an action here also reloads the list (f).
