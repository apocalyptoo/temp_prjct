# Feature 1: Team membership (spec)

Phase 4, Step 3. Task F1.0, written 2026-11-21. **Status: approved 2026-11-21** (DECISIONS.md, "Team membership feature spec approved").

**How to read the markers:**
- **[Pn, approved]**: a design choice proposed by Claude Code, with its one-line reason, approved by the owner on 2026-11-21. All are listed in section k.
- **[Dn, approved]**: a default from the task brief, confirmed by the owner on 2026-11-21.
- The open questions were answered on 2026-11-21; the answers are in section j and built into the sections above.

---

## a. What it covers

The two Team membership items of ROADMAP Step 3, plus team editing:

1. **Join request flow:** a player asks to join a team (with an optional message); the captain approves or rejects; the player can cancel.
2. **Team membership:** cancel invites, leave a team, transfer captaincy, the 15-member limit (including "no invites when full"), "Accept invite" instead of "Request to join".
3. **Editing a team:** the captain changes the name and description.

Not covered: notifications (feature 5; only the hook points are listed in section g), Player detail and the Explore sections with search (Explore feature), blocking and reporting (moderation), automatic captaincy handover on account deletion (account deletion feature).

## b. Rules

The rules are in [PRODUCT.md, "Team membership"](../PRODUCT.md#team-membership-v10) (who can do what, invites and join requests, the join request message, editing, leaving and captaincy, team size) and [DECISIONS.md 2026-11-21, "Team membership details for the screens"](../DECISIONS.md). They are not copied here.

Details PRODUCT.md doesn't settle, as used in this spec:

- **Kinds of `TeamMember` row.** A *pending invite* is `status: pending, origin: invite`. A *pending join request* is `status: pending, origin: request`. A *member* is `status: accepted` (any origin). The captain is the member whose `userId` is `Team.captainId`.
- **Member count** means accepted rows only (the captain included), as today.
- **Only players act.** Every action endpoint is for PLAYER accounts (`playersOnly`). Venue owners and the admin can view teams; the admin keeps its own delete route.
- **What happens to the message.** It's stored on the pending request row. Approving clears it (in the same update that accepts the row). Rejecting and cancelling delete the row, and the message with it.
- **Stale screens.** Every action re-checks the current state on the backend. If the thing acted on is gone (cancelled, already handled, team deleted), the reply is 404 with a short message, and the app shows it and reloads.
- **A fix the new flow needs, not a new rule.** Today `POST /teams/:teamId/accept` and `/reject` act on *any* pending row, and `GET /players/invites` lists *every* pending row. Once join requests exist, that would let a player accept their own join request (the Phase 1 bug again) and show their requests as invites. All three must only look at `origin: invite` rows.

## c. Who sees what on the team page

Every logged-in user can open any team's page (team membership is public to logged-in users, PRODUCT.md "Profile visibility"). The header always shows the team name and description; the **Members card** always lists every accepted member (captain first), with their position.

| Viewer (`viewerState`) | Header pills | Cards shown | Buttons |
|---|---|---|---|
| **Captain** (`captain`) | "Captain" (strong) · "x / 15 members" (soft) | Join requests (with messages; approve / reject), Invited (pending invites; cancel), Members (remove on every row but the captain's) | **Invite players** (primary; disabled with "Team is full (15/15)" when full) · **Transfer captaincy** (secondary; hidden when the captain is the only member) · **Edit team** · **Leave team** · **Delete team** |
| **Accepted member** (`member`) | "Player" (soft) · "x / 15 members" | Members | **Leave team** |
| **Invited player** (`invited`) | "Invited" (soft) · "x / 15 members" | Notice line "**{Captain} invited you** to this team", Members | **Accept invite** (primary; disabled with "Team is full (15/15)" when full) · **Decline** (secondary) |
| **Player with a pending request** (`requested`) | "Request sent" (soft) · "x / 15 members" | A "Your request" card: "Waiting for the captain", plus their message if they wrote one; Members | **Cancel request** (secondary) |
| **Any other player** (`none`) | "x / 15 members" | Members | **Request to join** (primary; disabled with "Team is full (15/15)" when full, Q1) |
| **Venue owner** (`none`) | "x / 15 members" | Members | None (read-only) |
| **Admin** (`none`) | API only | The API gives the admin Join requests (with messages), Invited and Members | No admin Team detail screen in this feature (Q5). The admin's Teams tab keeps its list and delete. |

Phone numbers aren't shown on the team page, not even to accepted teammates (Q8); they appear on Player detail (Explore feature).

**[P20, approved]** The "Invited" and "Request sent" pills. Reason: the viewer sees at once where they stand, in the same place as the "Captain"/"Player" pill.

Button placement for the captain, which the mockup doesn't show (Edit, Leave, Delete, the Invited card, removing a member): see section e, P9.

## d. API

### d.1 Shared rules

- **Validation:** every body goes through a zod schema in `src/validation/teamSchemas.js`; controllers read only `req.valid`. URL ids go through `parseId` (400 "Invalid team id" / "Invalid player id").
- **Visibility:** every user object goes through `toVisibleUser` (`src/utils/visibility.js`). The join request message is a new membership field. It's added to `MEMBERSHIP_FIELDS_NOT_IN_REPLIES` and put back only for the captain, the requester and the admin. `origin` and `acceptedAt` stay out of replies (the app doesn't need them).
- **The limit is one setting:** `MAX_TEAM_MEMBERS = 15` in `src/utils/membership.js`. Replies carry it as `maxMembers` so the app never hard-codes 15, and messages are built from it ("Team is full (15/15).").
- **Transactions and the 15-member limit.** Every endpoint that changes membership rows or the captain runs in one interactive `prisma.$transaction`, and its first step **locks the team row**: `SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE` (Prisma's tagged `tx.$queryRaw`, which sends the id as a parameter; never `$queryRawUnsafe`). No row means 404 "Team not found". Two approvals at the same moment then run one after the other: the second one waits for the lock, counts 15 accepted members and gets 409. Postgres releases the lock when the transaction ends. A shared helper `lockTeam(tx, teamId)` in `src/utils/membership.js` does this.
  **[P6, approved]** Lock the team row in *every* membership write (request, invite, accept, approve, leave, transfer, remove, cancel, edit, delete), not only in approvals. Reason: it also closes the other races in one simple rule, for example a member leaving while the captain makes them captain, or the last member leaving (deleting the team) while someone accepts an invite.
- **[P19, approved]** `src/utils/deletion.js` gets a variant that takes the transaction client, so "the last member leaves" can delete the team inside the same transaction. Reason: Prisma can't nest interactive transactions, and the team must be deleted under the same lock.
- **Status codes. [P1, approved]** 400 bad input · 403 not allowed (wrong role, not the captain) · 404 the team, request, invite or member doesn't exist (any more) · **409 the current state doesn't allow it** (team full, already in the team, already asked, captain can't leave). Existing replies keep their codes and words. Reason: the app can treat 404 and 409 as "refresh the screen" without parsing messages.
- **Route order:** `GET /teams/me` stays above `GET /teams/:teamId`. In `playerRoutes.js`, `/requests` goes above `/:id` like `/invites`.

### d.2 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `GET /teams/:teamId` | any logged-in user | new |
| 2 | `GET /teams/me` | any logged-in user | changed (new fields) |
| 3 | `GET /players/requests` | player | new **[P3]** |
| 4 | `GET /players/invites` | player | changed (invites only, member count) |
| 5 | `POST /teams/:teamId/requests` | player | new |
| 6 | `DELETE /teams/:teamId/requests/me` | player (the requester) | new **[P5]** |
| 7 | `POST /teams/:teamId/requests/:userId/approve` | captain | new **[P5]** |
| 8 | `POST /teams/:teamId/requests/:userId/reject` | captain | new **[P5]** |
| 9 | `POST /teams/:teamId/invite` | captain | changed (limit, approves a pending request) |
| 10 | `DELETE /teams/:teamId/invites/:userId` | captain | new **[P4]** |
| 11 | `POST /teams/:teamId/accept` | player (the invitee) | changed (invites only, limit) |
| 12 | `POST /teams/:teamId/reject` | player (the invitee) | changed (invites only) |
| 13 | `DELETE /teams/:teamId/members/:userId` | captain | changed (accepted members only) **[P4]** |
| 14 | `POST /teams/:teamId/leave` | player (a member) | new |
| 15 | `POST /teams/:teamId/transfer` | captain | new |
| 16 | `PATCH /teams/:teamId` | captain | new |
| 17 | `DELETE /teams/:teamId` | captain | unchanged (now takes the lock) |
| 18 | `GET /players` | any logged-in user | changed (adds position) **[P8]** |

`POST /teams/create`, `GET /teams` and the admin routes stay as they are.

**[P5, approved]** Requests are addressed by the player's id (`/requests/:userId/...`, like `/members/:userId`), and the requester cancels with `DELETE /teams/:teamId/requests/me`. Reason: a player has at most one row per team (unique `teamId` + `userId`), so the player id names the request, and the app already has it.

**[P4, approved]** Split "cancel an invite" out of the remove-member endpoint. `DELETE /teams/:teamId/invites/:userId` cancels a pending invite. `DELETE /teams/:teamId/members/:userId` removes accepted members only. Reason: today the remove endpoint deletes *any* row, so it could also silently delete a join request (a decline without the "declined" update). Separate endpoints give each action its own check, its own message and its own notification hook. `tests/remove-player.test.js` changes with it.

**[P3, approved]** "My sent requests" is its own endpoint, `GET /players/requests`, next to `GET /players/invites`, instead of a part of `/teams/me`. Reason: `/teams/me` stays "teams I'm in", and the two "waiting on someone else" lists sit side by side.

### d.3 Endpoint details

Success replies use `{ "message": ... }` unless a body is shown. Every error reply is `{ "error": "<message>" }`.

**1. `GET /teams/:teamId`**: one team, for any logged-in user (all roles).

```json
{
  "id": 7, "name": "Dhanmondi Strikers", "description": "Weekend 5-a-side crew.",
  "captainId": 12, "createdAt": "…",
  "memberCount": 11, "maxMembers": 15,
  "viewerState": "captain",
  "members": [
    { "id": 31, "userId": 12, "status": "accepted", "createdAt": "…",
      "user": { "id": 12, "role": "PLAYER", "name": "Rahim Uddin", "playerProfile": { "name": "Rahim Uddin", "position": "Pivot" } } }
  ],
  "joinRequests":   [ { "id": 40, "userId": 19, "createdAt": "…", "message": "I play Thursdays with Tanvir", "user": { … } } ],
  "pendingInvites": [ { "id": 41, "userId": 22, "createdAt": "…", "user": { … } } ]
}
```

- `viewerState`: `captain` · `member` · `invited` · `requested` · `none`. Venue owners and the admin always get `none`.
- `members`: accepted only, the captain first, then by `acceptedAt` (longest-standing first), ties to the lower id. The user's position comes from their public profile. (Area joins it once the "Area" rename is done; until then the address stays hidden.)
- `joinRequests` (oldest first) and `pendingInvites` (newest first): only for the captain and the admin. Nobody else gets these fields at all.
- `myRequest: { "createdAt": "…", "message": "…" | null }`: only when `viewerState` is `requested`.
- 404 "Team not found".
- **[P2, approved]** The fields `viewerState`, `memberCount`, `maxMembers`, `myRequest`, the member order, and oldest-first join requests. Reason: the app shows the right buttons and counts without working anything out itself, and the oldest request is answered first (fair to the person who asked first).

**2. `GET /teams/me`** (changed): same list as today (teams where the viewer is an accepted member), each team gaining `memberCount`, `maxMembers`, and, for the captain only, `joinRequestCount` (pending requests). `members` and `pendingInvites` stay as today. Covered by P2.

**3. `GET /players/requests`** (new, `playersOnly`): the viewer's pending join requests, newest first.

```json
[ { "id": 40, "teamId": 7, "createdAt": "…", "message": "…",
    "team": { "id": 7, "name": "Dhanmondi Strikers", "memberCount": 11, "maxMembers": 15 } } ]
```

**4. `GET /players/invites`** (changed): only `origin: invite` rows. The team object gains `memberCount` and `maxMembers`, so the screen can disable Accept when the team is full.

**5. `POST /teams/:teamId/requests`** (`playersOnly`). Body: `{ "message"?: string | null }`.
- zod (`joinRequestSchema`): `message` optional; if given, it must be text (else "Message must be text"); trimmed; missing, null or blank is stored as null; at most 150 code points after trimming (else "Message must be at most 150 characters"). Counted with `charCount`, like team names.
- In the locked transaction:
  - The viewer is already a member or the captain: 409 "You're already in this team."
  - The viewer already has a pending request: 409 "You've already asked to join this team."
  - The viewer has a pending invite: **[D3, approved]** the request accepts the invite instead (with the full-team check below; the message is dropped). Reply 200 `{ "message": "Joined team successfully", "joined": true }`.
  - The team is full: 409 "Team is full (15/15)." (Q1: requests are blocked when full, like invites.)
  - Otherwise create `{ status: pending, origin: request, message }`. Reply 201 `{ "id", "teamId", "userId", "status": "pending", "createdAt", "message" }`.
- 403: the `playersOnly` message (venue owner or admin). 404 "Team not found".

**6. `DELETE /teams/:teamId/requests/me`** (`playersOnly`): deletes the viewer's pending `origin: request` row. 200 "Request cancelled". 404 "Join request not found".

**7. `POST /teams/:teamId/requests/:userId/approve`** (`playersOnly`, captain).
- Not the captain: 403 "Only the team captain can approve or reject join requests."
- No pending `origin: request` row for that player: 404 "Join request not found".
- `memberCount >= 15`: 409 "Team is full (15/15)." The request stays pending.
- Otherwise one update: `status: accepted`, `acceptedAt: now`, `message: null`. 200 "Request approved".

**8. `POST /teams/:teamId/requests/:userId/reject`** (`playersOnly`, captain): same 403 and 404 as approve; deletes the row (and the message). 200 "Request declined". Works when the team is full.

**9. `POST /teams/:teamId/invite`** (changed; body `{ userId }` as today, `inviteSchema`). Existing replies stay: 403 "Only the team captain can invite players.", 404 "Player not found", 400 "Player is already invited or in the team." (a pending invite or a member). New, in the locked transaction:
- `memberCount >= 15`: 409 "Team is full (15/15)." (checked first, before the player checks).
- The player has a pending join request: **[D2, approved]** the invite approves it (`status: accepted`, `acceptedAt: now`, `message: null`). Reply 200 `{ "message": "Request approved", "joined": true }`.
- Otherwise create the invite as today: 201 with the invite row.

**10. `DELETE /teams/:teamId/invites/:userId`** (new, `playersOnly`, captain): deletes a pending `origin: invite` row. 403 "Only the team captain can cancel invites." 404 "Invite not found". 200 "Invite cancelled".

**11. `POST /teams/:teamId/accept`** (changed): only the viewer's pending `origin: invite` row (404 "Invite not found" otherwise, as today). In the locked transaction: `memberCount >= 15` gives 409 "Team is full (15/15)." and the invite stays pending. Otherwise `status: accepted`, `acceptedAt: now`. 200 "Joined team successfully" (as today).

**12. `POST /teams/:teamId/reject`** (changed): only `origin: invite` rows. 404 "Invite not found", 200 "Invite rejected" (as today).

**13. `DELETE /teams/:teamId/members/:userId`** (changed): removes an **accepted** member only. A pending row gives 404 "Player not found in this team." Other replies as today: 403 "Only the team captain can remove players.", 400 "The team captain cannot remove themselves.", 200 "Player removed successfully."

**14. `POST /teams/:teamId/leave`** (`playersOnly`), in the locked transaction:
- The viewer isn't an accepted member: 404 "You're not a member of this team."
- The viewer is the captain and other members exist: 409 "Transfer captaincy before leaving the team."
- The viewer is the captain and the only member: delete the team with all its rows (pending invites and requests too). 200 `{ "message": "Team deleted", "teamDeleted": true }`.
- Otherwise delete the viewer's row. 200 `{ "message": "You left the team.", "teamDeleted": false }`.

**15. `POST /teams/:teamId/transfer`** (`playersOnly`, captain). Body `{ userId }`, checked by `transferSchema` (the same rule as `inviteSchema`: a positive whole number up to `MAX_DB_INT`).
- Not the captain: 403 "Only the team captain can transfer captaincy."
- `userId` is the captain: 400 "You're already the captain."
- `userId` isn't an accepted member: 404 "Player not found in this team."
- Otherwise one update of `Team.captainId`. The old captain stays an accepted member. 200 `{ "message": "Captaincy transferred", "captainId": 19 }`.

**16. `PATCH /teams/:teamId`** (`playersOnly`, captain). Body `{ name, description }`, checked by the same rules as create (`updateTeamSchema` = `createTeamSchema`: name 2–40, description at most 200, blank becomes null). 403 "Only the team captain can edit this team." Replies the updated team in the `GET /teams/:teamId` shape.
**[P7, approved]** The app always sends both fields, and a missing description is stored as null, exactly as at create. Reason: one schema and no partial-update rules. The edit screen always has both values anyway.

**17. `DELETE /teams/:teamId`**: unchanged replies; it now takes the team lock inside its transaction.

**18. `GET /players`** (changed): each player gains their public `position`. **[P8, approved]** Reason: the Invite players screen shows positions (captains choose by position, PRODUCT.md "Registration"), and position is public.

**Schema change (needs approval in the backend task):** `TeamMember.message String?` (nullable, no default). Nothing else changes in the database.

## e. Screens

Built from `src/components/ui` with theme tokens only, checked against [the My Teams mockup](../design/floodlight-my-teams.png) and [the Team detail mockup](../design/floodlight-team-detail-captain.png). Every button that sends a request uses the `Button` `loading` state (IconButtons show their own pressed and disabled state and ignore taps while their request runs). Errors show the backend's `error` in an alert. On 404 or 409, the screen reloads after the alert.

**[P16, approved]** No "Success" alerts: after an action the screen simply updates (the row disappears, the pill changes). Reason: fewer taps. The change on screen is the confirmation.

**Navigation.** Team detail takes `{ teamId }` and loads `GET /teams/:teamId` (a loading spinner first). It's registered in the My Teams stack and in `ExploreStack`, so Explore → Teams → a team opens it, for venue owners too (read-only). The captain-only screens (Invite players, Transfer captaincy, Edit team) and Request to join are registered next to it in both player stacks, from one shared list, because a screen can only navigate inside its own stack. Venue owners' Explore stack registers only Team detail.

### My Teams

- `ScreenHeader`: title "My Teams", action **Create team** (primary, `add` icon). No greeting (Q3): it's added later, once DESIGN.md's "Salam, Rahim" question is decided.
- One `Card` per team (tappable, opens Team detail): `Avatar` (`avatarLarge`) with the team's initials, the name (`cardTitle`), "{memberCount} / {maxMembers} members" (`meta`), a `Pill` ("Captain" strong, "Player" soft), the description (`bodySmall`, up to 2 lines; nothing when empty). For the captain with requests: `Divider` + `NoticeLine` "**2 join requests** waiting for you" ("**1 join request**" when one).
- **Requests sent** section (`SectionHeader`) under the teams, only when there are any: one `ListRow` per request with the team name, "Waiting for the captain" (`meta`), the player's own message if any, and a **Cancel** button (secondary, small, loading). No dialog: it's quick to send again. Tapping the row opens Team detail. **[D1, approved]**
- Empty state (no teams and no requests sent): `EmptyState` "You're not in a team yet." + **Create team**. **[P15, approved]** Plus a `TextLink` "Find a team" opening Explore → Teams. Reason: joining is the other way into a team, and new players more often join than create.
- Pull to refresh, and a reload whenever the screen comes into view (as today).
- **[P17, approved]** The delete button leaves the team cards; Delete team lives on Team detail only. Reason: the mockup's cards have no delete, and a destructive action one tap from a list is easy to hit by mistake.

### Team detail

Layout from the mockup: `BackLink`; pills; `title` (team name); description (`bodySmall`, `textMuted`); action buttons; cards with `SectionHeader`s, `ListRow`s and `Divider`s. The rows aren't tappable in this feature (Player detail arrives with the Explore feature).

- **Captain view:**
  - Buttons: **Invite players** (primary) and **Transfer captaincy** (secondary) side by side, as in the mockup. When the team is full, Invite players is disabled with the label "Team is full (15/15)". When the captain is the only member, Transfer captaincy is hidden and Invite players takes the full width.
  - **Join requests** card (only when there are any): `SectionHeader` "Join requests" with a soft Pill showing the plain count, for example "2" (Q2: not the mockup's "2 new"). Each row: Avatar, name, position, the message under it (`bodySmall`, `textMuted`, quoted) if there is one, and decline (X) / approve (check) `IconButton`s labelled "Decline {name}" / "Approve {name}". When the team is full, approve does nothing and shows the 409 message (the backend decides).
  - **Invited** card (only when there are any): one row per pending invite, with "Invited" (`meta`) and a plain `IconButton` (`reject` icon) "Cancel invite to {name}".
  - **Members** card: every accepted member. The captain's row has the "Captain" label (crown + text) as its trailing item. Every other row has a plain `IconButton` (`remove` icon) "Remove {name}".
  - Below the cards: **Edit team** (a secondary `Button` with the `edit` icon), then **Leave team** and **Delete team** as danger text buttons.
  - **[P9, approved]** This placement (Invited card, remove buttons on rows, Edit / Leave / Delete under the cards). Reason: the mockup has no place for them; putting the rare and destructive actions at the bottom keeps the top for the everyday ones (invite, requests), and the danger actions away from them.
- **Member view:** pills, name, description, Members card, then **Leave team** (danger text button).
- **Invited view:** a `NoticeLine` "**{captain name} invited you** to this team", **Accept invite** (primary) and **Decline** (secondary) side by side, then Members. Accept is disabled with "Team is full (15/15)" when full.
- **Requested view:** a "Your request" card ("Waiting for the captain", plus the message if any) with **Cancel request** (secondary), then Members.
- **Visitor view (other player):** **Request to join** (primary, full width; disabled with "Team is full (15/15)" when full), then Members.
- **Venue owner view:** pills, name, description, Members. No buttons.
- **Team gone:** when the load returns 404, an alert "This team no longer exists." and the screen goes back.

### Request to join (new, small screen)

**[P11, approved]** A pushed screen instead of a dialog: header "Ask to join {team}", a `TextField` "Message to the captain (optional)" with the helper "Up to 150 characters" and a live count, and **Send request** (primary, loading). On success it goes back to Team detail, which now shows the requested view. Reason: `ConfirmDialog` has no text field, and a screen handles the keyboard properly (`Screen keyboardAware`).

### Create team and Edit team

One screen, `TeamFormScreen`, in two modes. **[P13, approved]** Reason: identical fields and rules; one screen keeps them in step.
- Fields: **Team name** (helper "2–40 characters") and **Description** (optional, multiline, helper "Up to 200 characters"). The app checks the same limits (counting code points) before sending, and shows the backend's message if it still refuses.
- Create: title "Create team", button **Create team**. On success, Team detail of the new team replaces the form (so Back returns to My Teams).
- Edit: title "Edit team", the fields filled in, button **Save changes**. On success it goes back to Team detail.

### Invite players

- Title "Invite players", a line "{memberCount} / {maxMembers} members". Under it, a `TextField` "Search by name" filtering the list on the phone.
- The list: every player from `GET /players` except the captain, members, pending invitees and players who have asked to join (they're in the Join requests card). Each row: Avatar, name, position, and an **Invite** button (secondary, small, loading). After a success the button becomes a disabled "Invited" and the screen stays open.
- When the team is full: the screen shows "Team is full (15/15)" and every Invite button is disabled.
- Empty state: "No players to invite right now."
- **[P12, approved]** Stay on the screen after inviting, leave out players who have asked to join, and filter by name on the phone. Reason: captains often invite several players in a row, a requester is better approved from the Join requests card, and the list can be long (real search and pagination come with the Explore feature).

### Transfer captaincy

A screen listing every accepted member except the captain (`ListRow`s, tappable). Tapping one opens the confirmation dialog below. On success it goes back to Team detail, which now shows the member view. Empty state (never reached, the button is hidden): "No other members yet."

### Notifications tab (interim: Invites)

The old Invites screen rebuilt in the new design until feature 5 replaces it: title "Invites"; one `Card` per invite with the team name (`cardTitle`), "{captain name} invited you · {memberCount} / {maxMembers} members" (`meta`), and **Accept** (primary) / **Decline** (secondary) side by side, both loading. Accept is disabled with "Team is full (15/15)" when full. Empty state: "No invites right now." Pull to refresh, reload on focus.
**[P14, approved]** Tapping the card opens Team detail (registered in the Notifications stack too). Reason: a player wants to see who's in the team before accepting.

### Confirmation dialogs (`ConfirmDialog`)

| Action | Title | Message | Confirm button |
|---|---|---|---|
| Leave team (member) | Leave {team}? | You'll need a new invite or an approved request to join again. | **Leave team** (danger) |
| Leave team (captain, other members exist) **[P10]** | Transfer captaincy first | You're the captain of {team}. Make another member captain, then you can leave. | **Transfer captaincy** (primary; opens Transfer captaincy). Cancel: "Not now" |
| Leave team (captain, the only member) | Leave and delete {team}? | You're the only member, so leaving deletes the team and cancels its pending invites and requests. This can't be undone. | **Leave and delete** (danger) |
| Transfer captaincy | Make {name} captain? | You'll stay in {team} as a player. {name} will manage invites, requests and the team's details. | **Make captain** (primary) |
| Remove member | Remove {name} from {team}? | They'll no longer be a member of this team. | **Remove** (danger) |
| Delete team | Delete {team}? | This deletes the team for all {memberCount} members and cancels its pending invites and requests. This can't be undone. | **Delete team** (danger) |
| Decline join request | Decline {name}'s request? | They can ask to join again later. | **Decline** (danger) |
| Cancel invite **[P18]** | Cancel the invite to {name}? | They won't be able to accept it any more. | **Cancel invite** (danger). Cancel: "Keep invite" |

The dialog's confirm button shows the loading state while the request runs, and the dialog can't be dismissed meanwhile (built into `ConfirmDialog`). The app always says "Decline", never "Reject" (Q4).

**[P10, approved]** The captain still sees "Leave team" when other members exist, and tapping it explains the transfer. Reason: the captain learns how to leave instead of wondering where the button went. (This also settles Q6.)
**[P18, approved]** "Keep invite" instead of "Cancel" on the cancel-invite dialog. Reason: "Cancel" next to "Cancel invite" is confusing.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| The team is deleted while you're looking at it | Any call: 404 "Team not found" | Alert "This team no longer exists.", go back; My Teams reloads on focus |
| You're removed while looking at the team | The next load gives `viewerState: none` | The screen shows the visitor view |
| Request when already invited | Accepts the invite (D3), with the full check | Shows the member view |
| Invite when they've already asked to join | Approves the request (D2), with the full check | The invited player disappears from the Invite list on reload; they're now a member |
| Captain leaves when alone | Deletes the team in the same transaction | "Leave and delete" dialog; then go back to My Teams |
| Captain leaves with other members | 409 "Transfer captaincy before leaving the team." | Prevented by the P10 dialog; the 409 covers a stale screen |
| The team is full at the moment of approving or accepting | 409 "Team is full (15/15)."; the request or invite stays pending | Alert, reload |
| Two approvals at the same moment with 14 members | The team lock makes them run one after the other: one 200, one 409 | The second captain device shows the alert |
| Acting on something already cancelled or handled (invite, request, member) | 404 with "Invite not found", "Join request not found" or "Player not found in this team." | Alert with the message, reload |
| Double tap on any action | The loading Button ignores the second tap; the lock plus the unique `(teamId, userId)` makes a duplicate impossible anyway | |
| Venue owner or admin calls an action endpoint | 403 with the existing `playersOnly` message | No buttons are shown to them |
| A non-captain calls a captain action | 403 with that action's captain message | No buttons are shown |
| The requester or invitee deletes their account | Their rows go with the account (existing cascade); approve or accept gives 404 | Alert, reload |
| Transfer to someone who just left | The lock serialises the two; transfer gives 404 "Player not found in this team." | Alert, reload |
| A message of 151 characters, a non-string message, or only spaces | 400 "Message must be at most 150 characters" / 400 "Message must be text" / stored as null | The field stops at 150 and shows the count |

## g. Notification hook points (built in feature 5, not now)

"Needs your action" items need no hooks: they're the pending rows themselves (invites for the player, join requests for the captain), and they disappear when the row is accepted, declined or cancelled.

"Updates" are written by these actions, in the same transaction:

| Action | Update for | PRODUCT.md event |
|---|---|---|
| Approve request (7), or invite that approves a request (9, D2) | the requester | Your join request was approved |
| Decline request (8) | the requester | Your join request was declined |
| Accept invite (11), or request that accepts an invite (5, D3) | the captain | Your invite was accepted |
| Decline invite (12) | the captain | Your invite was declined |
| Remove member (13) | the removed player | You were removed from a team |
| Transfer captaincy (15) | the new captain | You became captain |
| Delete team (17) | every other accepted member | A team you were in was deleted |

No update for: cancelling a request (6) or an invite (10), leaving (14; PRODUCT.md has no "member left" event, and a captain who is the last member has nobody to tell), editing (16).

## h. Test plan

**Backend** (`node:test`, real HTTP against the local server, throwaway users, as in `tests/helpers.js`):
- `tests/team-detail.test.js`: `GET /teams/:teamId` for each viewer state and role; members' order; `joinRequests`, `pendingInvites` and messages only for the captain and the admin; `myRequest` only for the requester; no email, phone or address of other users; 400 and 404.
- `tests/join-requests.test.js`: request with and without a message; message rules (151 code points refused, 150 Bangla characters accepted, blank and spaces become null, non-string refused); already a member or already asked (409); request when invited accepts the invite (D3); cancel; approve clears the message; reject deletes the row; non-captain 403; venue owner and admin 403; acting on a cancelled request 404; `GET /players/requests`.
- `tests/team-limit.test.js`: with 15 members, invite, request, accept and approve all give 409 and leave the rows pending; **two approvals at once** with 14 members (`Promise.all`) give exactly one 200 and one 409, and 15 accepted rows. Check once by hand that this test fails when the lock is removed, so it really tests the lock.
- `tests/leave-transfer.test.js`: member leaves; captain with members gets 409; captain alone deletes the team and its pending rows; transfer to a member, to self (400), to a non-member or pending player (404); the old captain stays a member.
- `tests/edit-team.test.js`: captain edits; same validation messages as create; non-captain 403.
- Updated: `teams-invites.test.js` (accept and reject ignore requests; invite approves a pending request, D2), `pending-invites.test.js` (`/players/invites` lists invites only), `remove-player.test.js` (pending rows now 404; cancel invite through the new route), `visibility.test.js` (the message), `route-ids.test.js` (bad ids on the new routes), `admin-delete.test.js` (still rolls back with the shared helper changed).

**App** (Jest, fake API like `__tests__/navigation.test.js`):
- Team detail shows the right pills, cards and buttons for each `viewerState` and for a venue owner; Invite players, Accept invite and Request to join are disabled when full; Transfer captaincy is hidden when the captain is alone.
- Each dialog's wording; the right endpoint is called on confirm; a 404 or 409 reloads.
- My Teams: the "x / 15 members" text, the notice line (singular and plural), the Requests sent section and its Cancel, the empty state.
- Team form: limits counted in code points; create vs edit mode.
- Navigation: Explore → Teams → Team detail, for players and venue owners.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (backend running, accounts: players A and B, a third player C, venue owner O; log out and in to switch):
1. A creates a team. A opens it: captain view, "1 / 15 members", no Transfer captaincy.
2. B opens it from Explore → Teams and sends a request with a message. B sees "Request sent", the message, and the request under Requests sent on My Teams.
3. A sees "1 join request waiting for you" on My Teams, and the request with its message on the team page. A approves: B is in Members, and the count goes up.
4. A invites C. C sees the invite on the Notifications tab, opens the team, then accepts.
5. A transfers captaincy to B. A now sees the member view and leaves. B is captain.
6. B edits the name and description; the new values show on My Teams and in Explore.
7. O opens the team from Explore: read-only, no buttons.
8. Full team: set 15 accepted rows in the local database (allowed for test data, see CLAUDE.md) and check that Invite players and Request to join are disabled and that accept and approve show "Team is full (15/15)."
9. B removes C, then leaves as the last member after C is gone: "Leave and delete", and the team disappears from Explore.

## i. Task split

1. **F1.1 Backend.** The migration (`TeamMember.message`, after your approval), `lockTeam` and `MAX_TEAM_MEMBERS`, the deletion helper variant, every endpoint in section d, and the tests in section h. Small commits inside the task: migration · reads (1–4, 18) · requests (5–8) · invite, accept, reject and the limit (9–12) · remove and cancel split (10, 13) · leave, transfer, edit (14–16). Docs updated in the same commits (ARCHITECTURE.md, CLAUDE.md, including the `MEMBERSHIP_FIELDS_NOT_IN_REPLIES` note that "feature 1 decides").
2. **F1.2 Screens, part 1: Team detail.** All viewer states, the dialogs, Request to join, Transfer captaincy, and Explore → Teams → Team detail (both player stacks and the venue owner's Explore stack).
3. **F1.3 Screens, part 2: around the team.** My Teams (cards, notice line, Requests sent, empty state), the Create/Edit team form, Invite players, the interim Notifications (Invites) screen. Old team screens that nothing uses any more are deleted here (`AddMemberScreen`, `CreateTeamScreen`).

Then the two ROADMAP items are ticked.

## j. Answered questions

Questions the docs didn't settle, and contradictions found while writing this spec. The owner answered them on 2026-11-21; the answers are built into the sections above.

| | Question | Answer |
|---|---|---|
| Q1 | Can a player ask to join a full team? | **No.** Blocked like invites: the button reads "Team is full (15/15)" and the backend refuses with 409. |
| Q2 | The mockup's "2 new" pill on Join requests (nothing records which requests the captain has seen) | **Show the plain count** ("2"). Recorded as a mockup difference in DESIGN.md. |
| Q3 | The "Salam, Rahim" greeting on My Teams | **Left out** for this feature; added later once DESIGN.md decides it. |
| Q4 | "Reject" or "Decline"? (PRODUCT.md used both) | **"Decline"** on every button and dialog. PRODUCT.md's wording is aligned. API paths keep `reject` (users never see them). |
| Q5 | Does the admin get a Team detail screen in this feature? | **No.** The admin's Teams tab stays a list with delete; `GET /teams/:teamId` already works for the admin. |
| Q6 | PRODUCT.md said "for everyone, leave team", but the captain can't leave without transferring first | **Everyone sees Leave team;** for a captain with other members it explains the transfer (P10). PRODUCT.md reworded. |
| Q7 | Can a removed member ask again or be invited again? | **Yes, straight away.** |
| Q8 | Show teammates' phone numbers on the team page? | **No.** Phones appear on Player detail (Explore feature). |
| Q9 | Can a player edit their join request message after sending? | **No.** They cancel and send a new request. |

## k. Proposals (all approved 2026-11-21)

Defaults from the brief, confirmed:
- **D1** My Teams shows a "Requests sent" section with Cancel (e).
- **D2** Inviting a player who has already asked to join approves their request, subject to the limit (d, endpoint 9).
- **D3** Asking to join a team that already invited you accepts the invite, subject to the limit (d, endpoint 5).

Proposed by Claude Code, approved:
- **P1** Status codes, with 409 for "the current state doesn't allow it" (d.1).
- **P2** Reply fields `viewerState`, `memberCount`, `maxMembers`, `myRequest`, `joinRequestCount`; members captain first then longest-standing; join requests oldest first (d, endpoints 1–2).
- **P3** `GET /players/requests` for sent requests, instead of a part of `/teams/me` (d.2).
- **P4** Cancelling an invite gets its own endpoint; remove-member removes accepted members only (d.2).
- **P5** Request endpoints addressed by player id; the requester cancels with `DELETE …/requests/me` (d.2).
- **P6** Every membership write locks the team row, not only approvals (d.1).
- **P7** Edit team takes both fields every time, with the create schema (d, endpoint 16).
- **P8** `GET /players` adds the public position (d, endpoint 18).
- **P9** Captain view placement: Invited card, remove buttons on member rows, Edit / Leave / Delete under the cards (e).
- **P10** A captain with members still sees Leave team, which explains the transfer (e).
- **P11** Request to join is a small screen with the message field (e).
- **P12** Invite players: stays open after inviting, leaves out requesters, filters by name on the phone (e).
- **P13** One form screen for create and edit; after create, Team detail replaces it (e).
- **P14** Interim Invites cards open Team detail (e).
- **P15** My Teams empty state adds "Find a team" (e).
- **P16** No success alerts; screens update in place (e).
- **P17** Delete team only on Team detail, not on My Teams cards (e).
- **P18** "Keep invite" on the cancel-invite dialog (e).
- **P19** A deletion helper variant that takes the transaction client (d.1).
- **P20** "Invited" and "Request sent" pills (c).
