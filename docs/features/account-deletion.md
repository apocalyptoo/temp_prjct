# Feature 4: Account deletion (spec)

Phase 4, Step 3. Task F4.0, written 2026-11-25. **Status: approved 2026-11-25** (DECISIONS.md, "Account deletion feature spec approved"). The backend (F4.1) was built 2026-11-25; the screens (F4.2, F4.3) aren't yet.

**How to read the markers:**
- **Decided**: one of the owner's three decisions of 2026-11-25 (DECISIONS.md, "Account deletion details"), or a rule already in PRODUCT.md or DECISIONS.md.
- **[Dn, approved]**: a default from the task brief, confirmed by the owner on 2026-11-25.
- **[Pn, approved]**: a design choice proposed by Claude Code, with its one-line reason, approved by the owner on 2026-11-25. All are listed in section k.
- **Qn**: a question or contradiction found while writing the spec. The owner answered them on 2026-11-25; the answers are in section j and built into the sections above.

---

## a. What it covers

The Account deletion item in ROADMAP Step 3:

1. **Deleting your own account in the app:** Settings → Delete account, for players and venue owners, with a screen that says exactly what will happen, the password, and a final confirmation.
2. **The preview:** what will happen to each team the user captains, and to a venue listing, worked out by the backend.
3. **One shared deletion**, used by the app, by the admin and (Phase 5) by the web page: each captained team is handed to its longest-standing accepted member, or deleted when there's no other member.
4. **Admin deletion on the same logic**, with the same preview in the admin's confirm dialogs (Users tab and the venue review screen). This replaces today's behaviour, where deleting a captain deletes their teams for everybody (`backend/src/utils/deletion.js`, its TODO).
5. **The account-deleted notice email** (decided).

Not covered: the web page for deletion requests (Phase 5, decided; section d.6 says what it reuses); in-app notifications (feature 5; hook points in section g); reports, blocks and suspension (moderation; section g); rebuilding the admin's Users tab (moderation reworks it; Q6); deleting a team (unchanged).

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [Account deletion](../PRODUCT.md#account-deletion-v10): the path, what's deleted, the effect on teams, venue owners, the notice email, the web page, admin deletion, all-or-nothing.
- [Team membership](../PRODUCT.md#team-membership-v10): "longest-standing member" is the earliest `acceptedAt`, ties to the lower membership id; the captain is stored only in `Team.captainId`; the 15-member limit.
- [Login sessions](../PRODUCT.md#login-sessions-v10) and [Notifications](../PRODUCT.md#notifications-v10) (the events, the list of account emails).
- [Profile visibility](../PRODUCT.md#profile-visibility-v10): a name is public to logged-in users, so the preview may show the new captain's name.

Details PRODUCT.md doesn't settle, as used in this spec:

- **Who becomes captain.** Among the team's *accepted* members, leaving out the user being deleted: the longest-standing one. Pending invites and requests never count. A team with no such member is deleted, with its pending invites and requests.
- **A handed-over team** changes only its captain and loses the deleted member's row. Its name, description, area and other members stay, and so do its pending invites and join requests (decided). Nothing in the database says which captain sent an invite (`TeamMember` has no "invited by"), so nothing of the deleted user stays behind in them.
- **Which accounts.** PLAYER and OWNER accounts. The ADMIN account is never deleted by this feature **[D5, approved]**.
- **"Other teams"** are teams where the user is an accepted member but not the captain. They just lose a member. Nobody else is affected.
- **After deletion** every login token of the account is refused, because the account no longer exists (`verifyToken` finds no user and replies 401). No `tokenVersion` change is needed. Verify and reset links die with the row.

## c. Data changes

**None.** No migration is needed: the handover uses `Team.captainId` and `TeamMember.acceptedAt`, which exist since 4.1 and 4.2, and the delete rules stay as they are (`Team.captain` stays `Restrict`, as the last safety net).

Checked in the local database on 2026-11-25 (read only): 35 teams, every captain is a PLAYER with an accepted row in their own team, every accepted row has an `acceptedAt`, and there's one ADMIN. So no data needs fixing first.

## d. API

### d.1 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `GET /auth/deletion-preview` | player, venue owner | new **[D1, approved]** |
| 2 | `POST /auth/delete-account` | player, venue owner | new |
| 3 | `GET /admin/users/:id/deletion-preview` | admin | new **[D5, approved]** |
| 4 | `GET /admin/indoors/:id/deletion-preview` | admin | new **[D5, approved]** |
| 5 | `DELETE /admin/users/:id` | admin | changed (handover, notice email, optional `previewCode`) |
| 6 | `DELETE /admin/indoors/:id` | admin | changed (the same) |
| 7 | `POST /teams/create`, `POST /teams/:teamId/invite`, `POST /teams/:teamId/requests` | as today | changed (one clean error reply, d.5) |

**[P1, approved]** Own-account routes sit in `/auth` next to change-password, and deleting is a `POST` with a body rather than a `DELETE`. Reason: the password must travel in a body, and a body on a `DELETE` is dropped by some proxies; it's also the same shape as `POST /auth/change-password`.

### d.2 The shared deletion (`backend/src/utils/deletion.js`)

Everything below is used by every caller. Nothing about teams, profiles or order of deletion is written anywhere else.

**The plan: one function, used by the preview and by the deletion [D1, approved].** `planAccountDeletion(db, userId)` reads and changes nothing. It returns null when there's no such account, else:

```js
{
  user: { id, role, email, displayName, verified },
  captainedTeams: [
    { id, name, outcome: 'handover', newCaptain: { id, name } },
    { id, name, outcome: 'delete' },
  ],
  otherTeams: [{ id, name }],
  pendingCount,               // the user's own pending invites and requests
  venue: null | { name, live },
}
```

- The deletion doesn't work anything out itself: inside its transaction it calls the same function and carries out exactly what it returns. So the two can't follow different rules.
- It loads everything in a fixed number of queries, however many teams there are.
- **[P2, approved]** The longest-standing order moves out of `teamController.js` (`inMemberOrder`) into `membership.js`, and both use it. Reason: the member list and the handover then can't disagree about who is next in line.
- **[P3, approved]** `captainedTeams` lists the teams to be deleted first, then the handed-over ones, each by name then id. Reason: the outcome that can't be undone should be seen first, and a fixed order makes the preview code (below) stable.

**The preview code (Q1). [P4, approved]** `previewCode` is a SHA-256 hash of the outcomes: each captained team's id with its new captain's id (or "delete"). The preview replies with it, the delete sends it back, and the deletion refuses if the plan it just made gives another code. Names aren't part of it, so a renamed team doesn't matter. Reason: without it, the screen can say "handed to Rahim" while the team goes to someone else, because Rahim left a moment ago.

**The deletion: `deleteUserAndData(db, userId, { passwordHash, previewCode } = {})`.** It keeps its name and its `db` parameter (the rollback tests pass a failing client), and now returns a result instead of true/false:

| Result | Meaning |
|---|---|
| `{ status: 'deleted', user }` | Done. `user` carries what the notice email needs |
| `{ status: 'gone' }` | No such account (any more) |
| `{ status: 'admin' }` | An ADMIN account: refused, nothing changed **[P5, approved]** |
| `{ status: 'password-changed' }` | `passwordHash` was given and is no longer the stored one |
| `{ status: 'stale' }` | `previewCode` was given and no longer matches |

**[P5, approved]** The shared function itself refuses ADMIN accounts; the routes' own checks stay in front of it. Reason: the Phase 5 web page, or any later caller, then can't delete the admin by forgetting a check.

**The steps, all in one transaction [D3, approved, widened by P6 (Q2)]:**

1. Find the ids of every team where the user has *any* row (member, invite or request) or is captain.
2. **Lock those teams**, lowest id first: `lockTeams(tx, ids)` in `membership.js`, next to `lockTeam` (the same `SELECT … FOR UPDATE`, with `ORDER BY id`, as a tagged `$queryRaw`). A team that has just been deleted simply isn't in the result.
3. **Lock the user's own row** (`SELECT … FOR UPDATE`). No row: `gone`. Role ADMIN: `admin`. Password hash no longer the given one: `password-changed`.
4. Read the ids of step 1 again. If there's a team that wasn't locked (an invite accepted, a team created in between), **start over** with a new transaction, at most 3 times; after that `stale`.
5. Make the plan. If `previewCode` was given and differs: `stale`.
6. For each captained team: `handover` sets `captainId` to the new captain (one update); `delete` calls `removeTeamRows(tx, teamId)`.
7. Delete the user's own `TeamMember` rows, then the profile (player or owner), then the `User`.

If any step fails, the database undoes all of them.

**[P6, approved] Lock every team where the user has a row, not only the captained ones, then the user's own row (Q2).** Reason: otherwise a team can make this user captain while they're being deleted (a transfer, or another captain deleting their own account at the same moment), and the delete fails with a server error.

Why this is safe, and what was tried on 2026-11-25 (throwaway users in the local database, deleted afterwards):
- **Teams first, the user second, always, lowest id first.** A normal team action holds one team lock and then touches a user's row. If the deletion locked the user first, the two could wait for each other for ever. In this order they can't.
- **The locked user row stops new links.** Creating a team, being invited or being made captain must touch the user's row, so it waits for the deletion and then fails because the user is gone (tried: foreign key error P2003 for all three).
- **Locking captained teams only isn't enough.** Tried: a transfer that lands between reading the list and the last step makes the final delete fail with Postgres 23001 (`Restrict`), a 500 for the user. Nothing is left half-done, but the deletion doesn't happen.
- **`lockTeams` sees fresh data.** Tried: a deletion that waited for a transfer reads the new captain after the wait.

`withLockedTeam` can't be used here: it locks exactly one team and belongs to the team controller. The deletion is a documented exception, like `deleteTeamAndMembers` (CLAUDE.md and TECHNICAL 4.5 are updated in F4.1).

**[P7, approved]** The transaction's timeout is raised from Prisma's 5 seconds to 15. Reason: it may wait for several teams' locks; a timeout is safe (everything is undone) but would be a needless error.

### d.3 After the deletion

**`deleteAccountAndNotify(db, userId, options)` (`backend/src/utils/accountDeletion.js`) [P8, approved]:** calls `deleteUserAndData` and, on `deleted`, starts the notice email without waiting for it (a failed send is only logged), then returns the result. Every caller uses this one. Reason: the email can't be forgotten by one of the callers, and `deletion.js` stays database-only, so its tests never load the mailer.

**The notice email** (decided; `sendAccountDeletedEmail` in `mailer.js`, `accountDeletedEmailHtml` in `emailTemplates.js`, the name through `escapeHtml`):
- Subject: **"Your ConnectArena account was deleted"**. No link.
- **[P9, approved]** Body: "Hi {name}," / "Your ConnectArena account and the profile that belonged to it were just deleted. You can't log in to it any more." / "This can't be undone." Reason: neutral, so the same text is right whether the user or the admin deleted the account, and it doesn't invite someone the admin removed to sign up again.
- The log line for a failed send names the former user id, not the email address.
- Phase 5 adds the support address to it, once there is one (ROADMAP, support email).
- Sent for admin deletions too (Q3), and only to an address the account had verified (Q4).

**[P10, approved]** One log line per deletion: "Account 123 (PLAYER) deleted by itself" / "by admin 1". No email or name. Reason: after a full deletion nothing else says what happened when someone asks.

### d.4 Endpoint details

Success replies use `{ "message": … }` unless a body is shown. Every error reply is `{ "error": "<message>" }`.

**1. `GET /auth/deletion-preview`** (`verifyToken`; PLAYER and OWNER). No body, no query. Reply 200:

```json
{
  "previewCode": "9f2c…64 hex characters",
  "captainedTeams": [
    { "id": 9, "name": "Mirpur Mavericks", "outcome": "delete" },
    { "id": 7, "name": "Dhanmondi Strikers", "outcome": "handover",
      "newCaptain": { "id": 19, "name": "Rahim" } }
  ],
  "otherTeams": [ { "id": 12, "name": "Gulshan FC" } ],
  "pendingCount": 2,
  "venue": null
}
```

- For a venue owner `captainedTeams` and `otherTeams` are empty and `venue` is `{ "name": "Arena 71", "live": true }`.
- `newCaptain` goes through `toVisibleUser` (id and name only).
- 403 for the admin: **"The admin account can't be deleted in the app."** [D5, approved]
- A read: no locks, no rate limit.

**2. `POST /auth/delete-account`** (`verifyToken`; PLAYER and OWNER; then the limiters, then `deleteAccountSchema` in `authSchemas.js`). Body `{ "password": "…", "previewCode": "…" }`.
- zod, in stages: `password` non-empty text, else **"Password is required"** (no strength rule: it's an existing password); `previewCode` 64 lowercase hex characters, else **"Check what will happen before deleting your account"**.
- The admin: 403 as above, before the limiters and the body.
- Wrong password: **400 "Password is incorrect"**, never 401 **[D2, approved]**. Also when the password was changed on another phone in the same moment (`password-changed`).
- `stale`: **409 "Something changed in your teams. Check what will happen and try again."** Nothing is deleted.
- `gone` (another device was first): 401 "Invalid token", like every request of a deleted account.
- `deleted`: **200 "Your account was deleted."**, sent without waiting for the email.

**Rate limits [D2, approved]** (`deleteAccountLimiters`): only failures count, **10 per 15 minutes per account** (`account:<user id>`) and **50 per 15 minutes per IP**, then 429 **"Too many attempts to delete your account. Please wait 15 minutes and try again."** The numbers are change password's. **[P11, approved]** They have their own counters, and a 409 doesn't count as a failure (the password was right). Reason: someone whose teams keep changing shouldn't be locked out, and separate counters keep the two features independent.

**3 and 4. `GET /admin/users/:id/deletion-preview`, `GET /admin/indoors/:id/deletion-preview`** (`verifyToken`, `isAdmin`). The reply of endpoint 1. The same checks, in the same order and with the same messages, as their delete routes: 400 "Invalid user id" / "Invalid venue id"; 403 "You can't delete your own account from the admin screens." / "Admin accounts can't be deleted from the admin screens."; 404 "User not found" / "Venue not found" (`/indoors` only for OWNER accounts).

**5 and 6. `DELETE /admin/users/:id`, `DELETE /admin/indoors/:id`** (changed). All protections and replies stay word for word. New: they call `deleteAccountAndNotify`. **[P12, approved]** Optional query `previewCode` (zod: 64 lowercase hex characters if given, else 400 **"Invalid preview code"**); when it no longer matches: 409 **"Something changed in this user's teams. Check what will happen and try again."** Reason: the app always sends it, so the admin confirms what they saw; existing callers and tests that send nothing keep working. The admin enters no password (as today).

### d.5 Requests in flight

**[P13, approved]** Three existing endpoints get a clean reply when the account disappears between the login check and the write. Today they'd answer 500 (P2003, tried in d.2). Reason: deleting accounts becomes an everyday action, so these races become possible for real users.

| Endpoint | When | Reply |
|---|---|---|
| `POST /teams/:teamId/invite` | the invited player was just deleted | 404 "Player not found" (its existing message) |
| `POST /teams/create`, `POST /teams/:teamId/requests` | the caller's own account was just deleted | 401 "Invalid token" (the app logs out, as for any deleted account) |

Everything else already behaves: membership actions wait for the team lock and then get their usual 404s, and the profile and venue edits get their usual "not found" 404s (`updateMany` finds no row).

### d.6 What the Phase 5 web page reuses

`planAccountDeletion` for what to show and `deleteAccountAndNotify(db, userId, {})` to delete, unchanged. The page adds its own emailed link instead of the password. Both options are optional for that reason.

## e. Screens

Built from `src/components/ui` with theme tokens only; every button that sends a request uses `useBusyAction`.

### Settings

- A **Delete account** button last, under Log out: `Button` `danger`, icon `delete`, full width → Delete account. It's the only red item on the screen: **Log out** becomes a `secondary` button, and its dialog's confirm button isn't red any more (Q5).
- Same for players and venue owners, because they share the screen. The admin has no Settings screen, so the row isn't shown to them **[D5, approved]**.

### Delete account (new, `src/screens/Shared/DeleteAccountScreen.js`) **[D1, approved; layout P14]**

Registered as `DeleteAccount` in the player's and the owner's Profile stacks. It loads the preview each time it comes into view: a spinner first, then the content; if the first load fails, "Couldn't load what will be deleted." with **Try again** (`useTryAgain`). The password field and the button appear only with the preview.

1. `BackLink` "Settings", title "Delete account".
2. "Your account will be deleted straight away. This can't be undone."
3. **Card "What will be deleted"** (`ListRow`s with icons, no avatars):
   - Player: "Your profile" / "Your name, phone, position and everything else you added". Venue owner: "Your account".
   - Player in other teams: "Your place in {n} teams" / the team names, separated by commas. ("Your place in 1 team".)
   - Player with pending items: "Your invites and join requests" / "{n} waiting".
   - Venue owner: **"Your venue listing will be removed"** / "{venue} disappears from Explore" when it's live, "{venue} is waiting for review" when it isn't.
4. **Card "Your teams"**, only for a captain, one row per captained team, in the preview's order:
   - `transfer` icon: **"Dhanmondi Strikers will be handed to Rahim"**
   - `delete` icon: **"Mirpur Mavericks will be deleted (you're the only member)"**
5. "We'll email {email} to confirm that your account was deleted." (`meta`)
6. **Password** (`TextField` secure, `autoComplete="current-password"`), and **[P15, approved]** a `TextLink` "Forgot your password?" that works like Change password's (a dialog, then `POST /auth/forgot`). Reason: a logged-in user who forgot it could otherwise not delete their account without logging out first.
7. **Delete account** (`Button` `danger`, full width).

**[P14, approved]** The order: consequences first, the password last, just above the button. Reason: nobody types a password before seeing what they'd lose.

An empty password shows "Password is required" under the field, and nothing is sent. Otherwise the **final confirmation** (`ConfirmDialog`, destructive) **[P16, approved]**:
- Title "Delete your account?", message "This can't be undone." For a captain, first a summary: "1 team will be deleted and 2 teams will be handed over." (only the parts that apply).
- **Delete account** (danger) · "Keep account". Reason: "Cancel" next to a delete could be read as cancelling the account (the same idea as "Keep invite").
- The dialog stays open with its spinner while the request runs and can't be dismissed (built into `ConfirmDialog`).

Replies:
| Reply | What the user sees |
|---|---|
| 200 | Next section |
| 400 "Password is incorrect" | The dialog closes; the message under the Password field; still logged in |
| 409 | The dialog closes; the "Something changed" alert (`showActionError`); the preview reloads and the password stays typed |
| 429 | The dialog closes; an alert with the message |
| No connection, 500 | The dialog closes; "Couldn't delete your account. Please check your connection and try again." |

### Afterwards **[D4, approved]**

- `AuthContext` gets `deleteAccount(password, previewCode)`: on 200 it removes the saved token and the user **before** anything else, so the app shows the Login screen, then **[P17, approved]** one alert titled "Account deleted": **"Your account was deleted."** Reason: the same pattern as "Session expired", and it can't be missed. Android's Back can't return to the old screens, because the whole navigator is replaced.
- **[P18, approved]** While the delete request runs, a 401 from *another* request of this phone doesn't show "Your session has expired". Reason: the account is already gone on the server a moment before this phone hears about it, and the two messages would clash. A 401 on the delete request itself still logs out as usual.
- Other phones: their next request gets 401, so they show "Your session has expired. Please log in again." and go to Login (as today for any dead token). Logging in says "Invalid email or password".

### Admin: Users tab and venue review **[D5, approved]**

- Tapping a user's trash button (Users tab), or **Delete venue** (`AdminVenueScreen`), first loads the preview. The tapped button shows its spinner meanwhile. **[P19, approved]** If the preview can't be loaded, an alert says so and no confirmation opens. Reason: the admin shouldn't confirm something they can't see.
- Then a `ConfirmDialog` (destructive) titled "Delete {name}?", the message "This deletes their account and profile for good. It can't be undone.", and the same lines as the user's own screen, in the third person: "Dhanmondi Strikers will be handed to Rahim", "Mirpur Mavericks will be deleted (they're the only member)", "The venue listing will be removed". No extra lines for someone with no teams and no venue. Confirm: **Delete account**, or **Delete venue** on the venue screen.
- A 409 shows "Something changed" and closes the dialog; tapping delete again loads a fresh preview.
- **[P20, approved]** `ConfirmDialog` gets optional `children` between the message and the buttons, and that part scrolls when it doesn't fit. Reason: a captain of many teams would otherwise push the buttons off the screen.
- **[P21, approved]** The trash button isn't shown on ADMIN rows. Reason: today it's there and can only ever answer with a refusal.
- In the Users tab only the delete confirmation changes; the old-style list stays until moderation (Q6).

The outcome sentences live in one file, `src/screens/Shared/deletionOutcomes.js`, in both wordings.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| The handover member leaves, or is removed, between the preview and the delete | The plan has a new successor: 409 (Q1); nothing deleted | "Something changed", the preview reloads with the new name |
| The handover member deletes their own account at the same moment | Both lock the same team, one after the other. The first hands over or leaves; the second plans again from what's there now, and 409s if that differs from its preview | One succeeds; the other may have to check again |
| Both last members delete their accounts at the same moment | The first hands the team to the second; the second then has a team to delete that its preview didn't show: 409, check, delete again | As above |
| Someone joins the team of a captain who was alone | Its outcome changes from "deleted" to "handed over": 409 | Reload |
| A member is made captain while deleting their account | The transfer and the deletion run one after the other. Transfer first: a captained team the preview didn't show, 409. Deletion first: the captain gets 404 "Player not found in this team." | Alert, reload |
| A captain of a full team (15/15) | Handover; the team has 14 members and can invite again | "Full" goes away in Explore |
| A handed-over team with pending invites and requests | They stay; the new captain sees them on Team detail at once | The invited player's card shows the new captain's name ("{captain} invited you") |
| A captain alone, with pending invites or requests on the team | Deleted with the team, as when the last member leaves | The invite or request disappears on the next load; accepting gives 404 "Team not found" |
| Two members with the same `acceptedAt` | The lower membership id becomes captain | — |
| A captain of many teams | One transaction, the locks in id order | The list scrolls; the dialog scrolls (P20) |
| An owner with a live venue | The listing goes with the account; `GET /owners` and Venue detail stop showing it at once | Venue detail: "This venue isn't available any more." |
| An owner with a pending venue | The same; the Dashboard's count drops | The admin's review screen shows the "not available" state |
| The admin approves the venue while its owner deletes the account | Approve replies 404 "Venue not found" | Alert, reload |
| The admin tries to delete itself, or another ADMIN | 403 with today's messages, on preview and delete; `/auth/delete-account` and its preview 403 | No such button (P21); no Settings screen |
| The admin and the user delete the same account at once | One deletes; the other gets 404 (admin) or 401 (user). One notice email | "Something changed" / logged out |
| Wrong password, 10 times | 400 each; then 429 | Error under the field; then an alert; still logged in |
| The password is changed on another phone while this one deletes | This phone's token is dead (401), or, if the request was already past the login check, 400 "Password is incorrect" | Logged out, or the error under the field |
| Double tap on Delete account | The second request would get 401 | The loading button and dialog block it |
| The deletion succeeds but the reply is lost | The account is gone | "Couldn't delete your account…"; the next try gets 401 and "Your session has expired", and logging in fails. The notice email confirms it |
| A request in flight from another device | The clean replies in d.5; otherwise 401 on its next request | Logged out |
| The notice email fails | Logged; the reply is unchanged and the account stays deleted (decided) | Nothing different |
| Something fails half-way (database error, timeout) | Everything is undone; 500 "Something went wrong" | "Couldn't delete your account…"; the account still works |
| Signing up again with the same email | Works; a fresh, empty account with a new verification email | — |
| Teammates looking at a screen with the deleted player | Player detail 404 "Player not found" | Its existing "gone" handling |
| A deleted captain's invite or approval already in flight | Waits for the team lock, then 403 (no longer captain) or 404 (team gone) | Logged out on the next request |

## g. Notification and moderation hook points (not built now)

Written in the deletion's own transaction, when feature 5 is built:

| When | Update for | PRODUCT.md event |
|---|---|---|
| A team is handed over | the new captain | You became captain (automatic handover) |

Nothing else fires:
- "A team you were in was deleted" has nobody to tell: a team is only deleted here when there's no other accepted member. Players with a pending invite or request to it aren't members (the same as when the last member leaves).
- A member who disappears from a team: PRODUCT.md has no "member left" event.
- The deleted user's own pending invites and requests: no "declined" update is written.
- "Needs your action" needs no work: a handed-over team's join requests show up for the new captain by themselves, since they're read from the pending rows and `captainId`.

For the later features, all in the one shared deletion:
- **Notifications (feature 5):** the deleted user's own notifications go with the account. Updates kept by others that mention them need a rule there (keep the text, or drop it).
- **Moderation:** reports made by or about the user, and blocks in both directions, go there too. Moderation also decides whether a **suspended** member can be handed a team; until it exists nobody is suspended.

## h. Test plan

**Backend** (`node:test`, real HTTP, throwaway users):
- `tests/deletion-preview.test.js`: a player with no teams, a member, a captain with members (the longest-standing, the tie by id, pending rows never chosen), a captain alone, several teams in order, an owner with a live and a pending venue; the admin 403; nothing secret in the reply (no email or phone of the new captain); the admin routes' 400, 403 and 404.
- `tests/delete-account.test.js`: user, profile and rows gone; handover changes only `captainId` and keeps the other members and the pending invites and requests; a lone captain's team goes with its pending rows; other teams just lose a member; the user's own invites and requests gone from other teams; owner: the venue gone from `GET /owners`; wrong, missing and non-text password (400, still logged in, nothing deleted); missing and badly shaped `previewCode`; a stale code 409 for: the successor left, someone joined a lone captain's team, the user was made captain of another team; a renamed team doesn't matter; the old token 401 afterwards and on a second device; the email can register again; the admin 403.
- `tests/delete-account-races.test.js` (each run in many rounds): two members of one team delete at the same moment; the captain deletes while transferring to a member who deletes too; deletion against accepting an invite, leaving, approving and creating a team. After each round: no 500, no team without a captain, every captain an accepted member, never more than one captain. Checked once by hand that it fails with only the captained teams locked, and without the user lock.
- `tests/rate-limits.test.js` (updated): the 11th wrong password 429; a 409 doesn't count.
- `tests/mailer.test.js` (updated): subject, escaped name, no link. The notice is attempted after a self and an admin deletion and not after a failed one; not for an unverified account (Q4); a failing send (`.invalid`) still replies 200 and the account is gone.
- `tests/admin-delete.test.js` (changed): a captain with members is now handed over, not deleted; rollback at each kind of step (`failAt`) leaves captain, members, profile and user as they were; the `previewCode` query. `tests/admin-delete-safety.test.js` unchanged and passing.
- Updated for d.5: `teams-invites.test.js`, `join-requests.test.js`, `errors-and-roles.test.js`. `route-ids.test.js` for the two preview routes.

**App** (Jest, fake API):
- Settings: Delete account is last and the only red button, for a player and an owner, and opens the screen; Log out and its dialog's confirm button aren't red.
- Delete account: the exact sentences for each outcome; singular and plural; the venue lines; no teams card for a non-captain; failed load with Try again; empty password sends nothing; the dialog's summary and "Keep account"; the request body; 400 under the field; 409 reloads and keeps the password; 429; no connection; one request on a double tap.
- `AuthContext.deleteAccount`: the token is removed before the alert; a 401 from another request meanwhile shows no "Session expired" (P18); a failure leaves the user logged in.
- Admin: the preview loads before the dialog, with the third-person sentences; a failed preview opens no dialog; the delete carries `previewCode`; 409; no trash button on ADMIN rows; the same on the venue review screen.
- `ConfirmDialog` with `children`. `navigation.test.js`: the new route in both stacks.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (for the owner to check by hand; backend running; players A, B and C, venue owner O, the admin; use addresses you can read for A and O, throwaway accounts all):
1. As A, create "Keep FC" and "Solo FC". Invite B and C to Keep FC; accept as B first, then as C. As A, invite another player to Keep FC and leave that invite pending.
2. A: Profile → gear. **Delete account** is last and the only red button (Log out isn't red any more). Tap it: "Solo FC will be deleted (you're the only member)" and "Keep FC will be handed to B".
3. Tap **Delete account** with no password: "Password is required". With a wrong one, confirm: "Password is incorrect" under the field, and you're still logged in (go back and open My Teams).
4. "Forgot your password?" asks first; tap Cancel.
5. Tap Delete account with the right password, then **Keep account**: nothing happened.
6. The "something changed" case, with a second phone or emulator: leave A on the Delete account screen. As B, leave Keep FC. As A, delete: "Something changed", and the screen now says C. (With one phone only, skip this; the tests cover it.)
7. Delete for real: the Login screen with "Your account was deleted." Back doesn't return to the app. Logging in as A says "Invalid email or password". The email arrives and has no link.
8. As the new captain: Keep FC shows you as captain, and the pending invite is still there and can be cancelled. Solo FC is gone from Explore.
9. If A was also logged in on a second phone: its next action shows "Your session has expired".
10. Sign up again with A's email: it works, and the account is empty.
11. O with a live venue: Settings → Delete account says "Your venue listing will be removed". Delete. As a player, Explore → Venues no longer shows it.
12. Admin → Users: no trash button on the admin row. Tap the trash on a captain: the dialog lists what happens to each team. Cancel, then delete one for real. Admin → Venues → a venue → Delete venue: the dialog says the listing will be removed.
13. Largest font size: the Delete account screen and the dialogs wrap, and the buttons stay reachable.

## i. Task split

1. **F4.1 Backend.** Small commits: the plan, the shared order and `lockTeams` · the shared deletion with handover, the admin routes on it, with the race tests · the notice email · the preview and delete endpoints with their limits · the clean replies of d.5. Docs in the same commits (TECHNICAL 4.5, 5.3, 5.5, 6.1, 6.5; ARCHITECTURE "Deleting safely"; CLAUDE.md's `withLockedTeam` line; the draft Privacy page's "Emails we send" and "Deleting your account"; the old TODO and comments in `deletion.js`).
2. **F4.2 Delete account in the app.** Settings, the Delete account screen, `AuthContext`, and what's seen afterwards.
3. **F4.3 Admin dialogs.** `ConfirmDialog` children, the Users tab and the venue review screen. (Between F4.1 and F4.3 the Users tab's old text still says teams are deleted.)

Then the ROADMAP item is ticked.

## j. Answered questions

Questions the docs didn't settle, and contradictions found while writing this spec. The owner answered them on 2026-11-25 (each one as recommended); the answers are built into the sections above.

| | Question | Answer |
|---|---|---|
| Q1 | Contradiction: D1 says the preview and the deletion "can't disagree", and PRODUCT.md that the screen says exactly what will happen, but teams can change between looking and confirming. | **Refuse** with "Something changed" and show the new outcome: the preview code (P4, P12). |
| Q2 | Contradiction: D3 locks only the captained teams, but a team where the user is only a member can make them captain meanwhile, and the deletion then fails with a server error (tried, d.2). | **Lock every team where the user has a row, then the user's own row** (P6). |
| Q3 | Does the notice email also go out when the admin deletes the account? | **Yes**, with the same text. |
| Q4 | Does it go to an address that was never verified? (Only the admin can delete such an account, and the address could be a stranger's.) | **No**, only to a verified address. This narrows the decision of the same day. |
| Q5 | Contradiction: PRODUCT.md makes Delete account the one "last, in red", but Log out on Settings is red too (feature 2 spec). | **Log out becomes a secondary button.** Red then means "this destroys something". |
| Q6 | Contradiction: the admin's confirmation in the new design, but the Users tab is an old-style screen that moderation rebuilds. | **Only the dialog is new.** Moderation rebuilds the tab. |
| Q7 | "Deletion confirmation" in PRODUCT.md's list of account emails could mean the web page's link or the notice. | **Two separate items**, as PRODUCT.md now lists them. |

## k. Proposals (all approved 2026-11-25)

Defaults from the brief, confirmed:
- **D1** The Delete account screen shows exactly what will happen, from a backend preview that uses the same rule as the deletion (d.2, d.4, e).
- **D2** A wrong password replies 400, never 401; deleting is rate-limited per account and per IP, like change password (d.4).
- **D3** The whole deletion runs in one transaction with the team locks first (d.2; P6 and Q2 widen which teams).
- **D4** Afterwards the app clears the login and returns to Login with "Your account was deleted."; other devices are logged out (e).
- **D5** The admin account can't be deleted in the app; admin deletion keeps its protections, uses the shared logic and shows the preview (d.2, d.4, e).

Proposed by Claude Code, approved:
- **P1** `/auth/deletion-preview` and `POST /auth/delete-account`, next to change-password (d.1).
- **P2** One longest-standing order in `membership.js`, shared by the member list and the handover (d.2).
- **P3** Teams to be deleted are listed before handed-over ones (d.2).
- **P4** A preview code, so a deletion is refused when the outcomes changed (d.2; Q1).
- **P5** The shared function itself refuses ADMIN accounts (d.2).
- **P6** Lock every team where the user has a row, then the user's row, and check the list again (d.2; Q2).
- **P7** A 15-second transaction timeout for the deletion (d.2).
- **P8** `deleteAccountAndNotify`: every caller deletes and notifies through one function (d.3).
- **P9** Neutral email text that fits self and admin deletion (d.3).
- **P10** One log line per deletion, without personal details (d.3).
- **P11** Own rate-limit counters; a 409 doesn't count (d.4).
- **P12** `previewCode` is optional on the admin's delete routes (d.4).
- **P13** Clean replies instead of 500 when an account disappears mid-request (d.5).
- **P14** Delete account screen: consequences first, the password last (e).
- **P15** "Forgot your password?" on the Delete account screen (e).
- **P16** The final dialog: a summary of the teams, and "Keep account" instead of "Cancel" (e).
- **P17** One "Account deleted" alert over the Login screen (e).
- **P18** No "Session expired" message while this phone's own deletion runs (e).
- **P19** The admin's confirmation opens only once the preview has loaded (e).
- **P20** `ConfirmDialog` takes `children` and scrolls (e).
- **P21** No trash button on ADMIN rows in the Users tab (e).
