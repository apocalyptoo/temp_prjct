# Feature 3b: Explore and Player detail (spec)

Phase 4, Step 3. Task F3b.0, written 2026-11-23. **Status: draft, waiting for the owner's approval.** Nothing in it is built yet.

**How to read the markers:**
- **Decided**: one of the owner's four decisions of 2026-11-23 (DECISIONS.md, "Explore details"), or a rule already in PRODUCT.md or DECISIONS.md.
- **[Dn, proposed]**: a default from the task brief. A proposal until the owner confirms it.
- **[Pn, proposed]**: a design choice proposed by Claude Code, with its one-line reason. All are listed in section k, so each can be approved or rejected.
- **Qn**: a question or contradiction the docs and code don't settle, with options and a recommendation, in section j. The sections above use the recommended answer and say so.

---

## a. What it covers

The "Explore: Teams and Players, Player detail" items in ROADMAP Step 3, which come to:

1. **The real Explore tab:** one screen with **Teams · Players · Venues** sections, replacing the interim screen with three rows. Read-only for venue owners.
2. **Teams section:** search by name, an area filter, full teams marked "Full" and listed last.
3. **Players section:** search by name, filters by area and by position.
4. **Venues section:** the `VenueList` built in feature 3, now loading in pages.
5. **Paging** on all three lists, built in from the start (review finding 4). This covers ROADMAP's "Pagination on list endpoints" item (decided).
6. **Team area:** an optional Area on teams, set on the team form, shown on team cards and Team detail (review finding 3).
7. **Player detail:** a player's public profile and teams; the phone, with tap to call, for accepted teammates; **Invite to my team** for captains.
8. **Invite players with a server-side search**, instead of downloading every player (review finding 4).
9. **"Position · Area" on player rows** (review finding 12), and player rows opening Player detail.
10. **The old screens go:** `TeamsListScreen`, `PlayersListScreen`, the interim Explore and Venues screens. Afterwards no old-style screen is reachable by players or venue owners (review finding 9).

Not covered: Report and Block on Player detail, hiding blocked and suspended users (moderation feature; this spec only says where they go, section g); the Notifications screen (feature 5); the admin's Users and Teams tabs, which stay as they are **[D5, proposed]**; paging of the admin's lists (Q4); a team's or player's photo (no photos in v1.0).

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [App structure and navigation](../PRODUCT.md#app-structure-and-navigation-v10): Explore's three sections, their search and filters, paging, Player detail, read-only for owners.
- [Team membership](../PRODUCT.md#team-membership-v10): "Team area" (optional, set by the captain, the player Area rules; existing teams start without one) and "Team size" (full teams stay listed, marked "Full", after teams with free spots).
- [Profiles → Area](../PRODUCT.md#profiles-v10): free text with suggestions; filtering ignores case and matches part of the text.
- [Profile visibility](../PRODUCT.md#profile-visibility-v10): what any logged-in user sees of a player; the phone only for accepted teammates and the admin; the email only for the player and the admin.
- [Registration → Position](../PRODUCT.md#registration-v10): the five positions.
- [Administration and moderation](../PRODUCT.md#administration-and-moderation-v10): blocked and suspended users disappear from player lists and search (built by the moderation feature).

Details PRODUCT.md doesn't settle, as used in this spec:

- **Team area is exactly the player Area** (decided): the same `area()` piece in the backend (spaces at both ends removed, every run of spaces inside made one, 2–40 characters after tidying, blank means no area, letters kept as typed) and the same suggestion list in the app (`src/constants/areas.js`).
- **[D1, proposed] Paging:** offset paging with `page` and `limit`, 20 rows per page, `total` in the reply, the same on all three lists. The app loads the next page as the user scrolls.
- **[D2, proposed] Search and every filter run on the backend**, ignoring case and matching part of the text (`containsText`), sent 400 ms after typing stops, like `VenueList` today.
- **[P1, proposed] Paging limits:** `page` from 1 to 1000 (default 1), `limit` from 1 to 50 (default 20). A page past the end is an empty page, not an error. Reason: a cap keeps one request small and stops very deep offsets, which get slow; nobody scrolls past 20,000 rows, they search.
- **[P2, proposed] Order.** Teams: teams with a free spot first (decided), then by name A to Z, ties by id. Players: by name A to Z, ties by id. Venues: unchanged (name A to Z, venues spec P12). Reason: a list people scan by name, the same as venues; and paging needs an order that never changes between two requests, which the id tie-break gives.
- **[P3, proposed] The position filter is one position at a time**, and it matches that position exactly: "Goalkeeper" lists players whose position is Goalkeeper. Players who chose "Any" are found with the "Any" filter (Q2). Reason: predictable, and the same one-choice control as the position picker.
- **[P4, proposed] Who is left out of player lists:** the viewer themselves, and accounts that aren't PLAYER accounts with a profile. Unverified players too, if Q3 is answered that way. Blocked and suspended players are left out by the moderation feature, in the same place (section g).
- **[P5, proposed] Search limits:** `search` at most 60 characters and the `area` filter at most 40, on all lists, as the venue list has today. Reason: one rule and one set of messages for every list.
- **"Full"** means `memberCount >= maxMembers` (15 accepted members), as everywhere else.
- **[D3, proposed] Player detail shows** the name, position, area, height and weight if set, the player's teams (each opens Team detail), and the phone only to accepted teammates.
- **[D4, proposed] Inviting from Player detail:** a captain of several teams picks the team from a list; teams that are full, or where the player is already a member, invited or has asked to join, are shown disabled with the reason. (How the list is shown: P24. The "has asked to join" case: Q5.)

## c. Data changes

One migration, `team_area`. **It needs the owner's approval when it's created in the backend task (F3b.1).**

| Change | Details | Existing data |
|---|---|---|
| **Team area** | `Team.area String?` (decided) | Null for every existing team (decided: existing teams start without one) |

Nothing else changes in the database.

**[P6, proposed] No new indexes for the searches.** Reasons:
- "Matches part of the text, ignoring case" is a Postgres `ILIKE '%text%'`. An ordinary index can't speed that up; only a trigram index (the `pg_trgm` extension) can. At v1.0's size (thousands of rows, short text) Postgres reads the whole table in a few milliseconds, and the extension would tie the migration to whatever the hosting allows, which isn't chosen yet (Phase 5).
- The position filter has five values, so an index on it would rarely be used.
- The member count per team uses the existing unique index on `TeamMember (teamId, userId)`; the players' and venues' lookups use the existing unique `userId` indexes.
- If a search ever gets slow, trigram indexes on `Team.name`, `Team.area`, `PlayerProfile.name`, `PlayerProfile.area`, `OwnerProfile.indoorName` and `OwnerProfile.area` are one later migration, with no change to the API or the app.

**The local database on 2026-11-23** (read, nothing changed): 22 players (none unverified, none without a profile, one with an area), 7 teams (one of them full, 15/15; the others have 1 to 3 members) and 2 live venues. So the migration meets no awkward data, and the full team is there to check "Full" and the order by hand.

## d. API

### d.1 Shared rules

- **Validation:** every query and body goes through a zod schema; controllers read only `req.valid`. URL ids go through `parseId`. Unknown fields are dropped.
- **[P7, proposed] One set of list pieces**, in a new `src/validation/listQuery.js`: `searchFilter()`, `areaFilter()` (both moved from `ownerSchemas.js`, same behaviour and messages), `positionFilter()`, `pageParam()` and `limitParam()`; and a small `src/utils/paging.js` with `pageArgs({ page, limit })` (Prisma's `skip` and `take`) and `pagedReply(items, total, { page, limit })`. Reason: three lists and the invite search share one rule, one set of messages and one reply shape.
- **The query rules**, first problem wins, in this order:
  - `search`: text, trimmed, blank ignored, at most 60. "Search must be text", "Search must be at most 60 characters" (today's messages).
  - `area`: text, tidied like an Area, blank ignored, at most 40. "Area must be text", "Area must be at most 40 characters" (today's messages).
  - `position` (player lists only): blank ignored; otherwise exactly one of the five positions, else "Position must be Goalkeeper, Defender, Midfielder, Forward or Any" (the existing message).
  - `page`: digits only, 1 to 1000, default 1. Else **"Page must be a whole number from 1 to 1000"**.
  - `limit`: digits only, 1 to 50, default 20. Else **"Limit must be a whole number from 1 to 50"**.
  - A value given twice arrives as a list and is refused with that field's message. Every filter that is given must match.
- **The reply shape of every paged list** (D1):

  ```json
  { "items": [ … ], "page": 1, "limit": 20, "total": 57 }
  ```

  `total` is how many rows match the search and filters for this viewer. The app has loaded everything once `page × limit >= total`.
- **Visibility:** every user or profile in a reply goes through `src/utils/visibility.js`. **The team and player endpoints below (1, 5, 6 and 7) don't select an email from the database at all**, so no viewer gets one from them, not even the admin or the player themselves (your own email is on `/players/me`). The venue list keeps today's rule (the owner's email only for that owner and the admin).
- **[P8, proposed] "Who can be found" lives in one new file, `src/utils/discovery.js`:** `discoverablePlayers(viewer)` returns the Prisma condition for the players this viewer may find (P4), used by the players list and the invite search. The moderation feature adds "not suspended" and "no block in either direction" there, and the matching conditions for teams and venues. Reason: one place for the rule, like `visibility.js`, instead of a condition repeated in each controller.
- **Messages:** existing messages keep their words. **Status codes** as before: 400 bad input, 403 wrong role or not the captain, 404 gone.

### d.2 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `GET /teams` | any logged-in user | changed: search, area filter, order, paging, a new light row |
| 2 | `POST /teams/create` | player | changed: `area` |
| 3 | `PATCH /teams/:teamId` | captain | changed: `area` |
| 4 | `GET /teams/:teamId`, `GET /teams/me`, `GET /players/invites` | as today | changed: the team carries `area` |
| 5 | `GET /players` | any logged-in user | changed: search, area and position filters, paging, the viewer left out |
| 6 | `GET /players/:id` | any logged-in user | changed: the public profile for Player detail (was: two stats) |
| 7 | `GET /teams/:teamId/invite-candidates` | captain | new: the search behind Invite players |
| 8 | `GET /owners` | any logged-in user | changed: paging |

`POST /teams/:teamId/invite` and every other endpoint stay as they are. The admin's `/admin/users`, `/admin/teams` and `/admin/indoors` aren't touched (D5, Q4).

### d.3 Endpoint details

Every error reply is `{ "error": "<message>" }`.

**1. `GET /teams`** (changed; any logged-in user; `teamListQuerySchema`: `search`, `area`, `page`, `limit`).

- `search` matches part of the team's name; `area` part of the team's area. A team without an area never matches an area filter.
- Order: teams with a free spot first, then name A to Z, then id (P2).
- **[P9, proposed] Each row is light** (today's reply loads every membership row of every team, with every member's profile):

  ```json
  { "id": 7, "name": "Dhanmondi Strikers", "description": "Weekend 5-a-side crew.",
    "area": "Dhanmondi", "createdAt": "…", "captainId": 12,
    "captain": { "id": 12, "name": "Rahim Uddin" },
    "memberCount": 11, "maxMembers": 15, "viewerState": "none" }
  ```

  No `members` and no `pendingInvites` any more (a captain gets those from `GET /teams/:teamId`). `memberCount` counts accepted members only. The captain goes through the visibility rules, as in `GET /players/invites`. Reason for the captain's name: team names needn't be unique, so it tells two "FC Mirpur" apart.
- **[P10, proposed] `viewerState` on each row** (`captain`, `member`, `invited`, `requested` or `none`, the same words as Team detail; venue owners and the admin always `none`). Reason: the card can say "you're in this team" or "you've asked" without opening it. It's one lookup on the existing `(teamId, userId)` index.
- **[P11, proposed] The page is read with one SQL query**, through Prisma's tagged `$queryRaw` (values sent as parameters, never `$queryRawUnsafe`; the search text through `escapeLike`), plus a count. Reason: "teams with a free spot first" means sorting by a count of accepted members compared with 15, which Prisma's `findMany` can't do. The alternative, storing a member count on `Team`, would be a second copy of a fact that could disagree with the membership rows.

**2. `POST /teams/create`** and **3. `PATCH /teams/:teamId`** (changed). The body gains `area`, checked after `name` and `description` with the player `area()` piece: "Area must be text", "Area must be between 2 and 40 characters"; blank, null or missing is stored as null. **[P12, proposed]** The app always sends all three fields, and a missing `area` clears it, exactly like `description` today (feature 1's P7). Reason: one schema for create and edit, no partial-update rules. Replies as today, now with `area`.

**4. `GET /teams/:teamId`, `GET /teams/me`, `GET /players/invites`**: the team object carries `area` (null when not set). No other change.

**5. `GET /players`** (changed; any logged-in user; `playerListQuerySchema`: `search`, `area`, `position`, `page`, `limit`).

- `search` matches part of the player's name; `area` part of their area; `position` exactly (P3). Left out: P4.
- Order: name A to Z, then id (P2).
- Each row, as today but never with an email:

  ```json
  { "id": 19, "createdAt": "…", "name": "Nayeem Islam",
    "playerProfile": { "name": "Nayeem Islam", "position": "Goalkeeper", "area": "Mirpur 10" } }
  ```

  `area` only when set. Height, weight and phone aren't in the list.

**6. `GET /players/:id`** (changed; any logged-in user). **[P13, proposed]** The existing path becomes the public profile; its old reply (`totalTeams`, `joinedAt`) goes, with `toPlayerStats`. Reason: no screen uses the old reply, and "one player" belongs at this address.

```json
{ "id": 19, "role": "PLAYER", "createdAt": "…", "name": "Nayeem Islam",
  "playerProfile": { "name": "Nayeem Islam", "position": "Goalkeeper",
                     "height": 178, "area": "Mirpur 10", "phone": "01712345678" },
  "teams": [ { "id": 7, "name": "Dhanmondi Strikers", "area": "Dhanmondi",
               "memberCount": 11, "maxMembers": 15, "isCaptain": false } ],
  "inviteOptions": [ { "teamId": 9, "name": "Mirpur United", "memberCount": 15,
                       "maxMembers": 15, "state": "full" } ] }
```

- `playerProfile` through `toVisibleUser`: name and position always; height, weight and area only if set; **`phone` only when the viewer is an accepted teammate** (both accepted members of at least one team), the player themselves, or the admin. The teammate check lives in `visibility.js` (next to `findAcceptedTeammateIds`). Never the email (d.1). For the player themselves and the admin, empty optional fields come as `null` instead of being left out (as `toVisibleUser` does everywhere).
- `teams`: the teams they're an **accepted** member of (pending invites and requests aren't public), the ones they captain first, then by name. Each with its area, counts and `isCaptain`.
- **[P14, proposed] `inviteOptions`**, only when the viewer is a player looking at someone else: one entry per team **the viewer captains** (an empty list when they captain none), with `state`: `canInvite`, `member`, `invited`, `requested` or `full` (the player's own state wins over `full`). Reason: Player detail can show "Invite to my team" with the reasons at once, without a second request (D4). Venue owners, the admin and the player themselves don't get the field.
- 400 "Invalid player id"; **404 "Player not found"** when the id isn't a player account with a profile (a venue owner's or the admin's id too).

**7. `GET /teams/:teamId/invite-candidates`** (new; `playersOnly`; `playerListQuerySchema`). **[P15, proposed]** Its own route under the team, instead of a parameter on `GET /players`. Reason: it's captain-only and about one team, like the other team routes.
- 400 "Invalid team id"; 404 "Team not found"; not the captain: 403 "Only the team captain can invite players." (the invite endpoint's message).
- The players `GET /players` would list for this viewer, **minus everyone who has any row in this team** (the captain, members, invited players and players who asked to join, as the screen leaves them out today). Same filters, order, rows and paging as endpoint 5.
- A read: it doesn't take the team lock. A full team still gets its list; the invite itself is refused as today.

**8. `GET /owners`** (changed): `page` and `limit` join `search` and `area`; the reply becomes the paged shape, with the same venue rows as today. Only the app's `VenueList` reads it.

## e. Screens

Built from `src/components/ui` with theme tokens only. Every button that sends a request uses `useBusyAction` and the Button's `loading` state. Field problems found before sending show under the field; the backend's `error` shows in an alert. No mockups exist for these screens; they follow DESIGN.md section 6 and the built screens.

### Shared pieces

- **[P16, proposed] A new shared component, `SectionTabs`** (`src/components/ui`, with tests, a gallery entry and a DESIGN.md section 6 entry): a row of equal-width segments in a `surface` box with a `border` line, each at least 44 tall; the chosen one has an `accentSoft` background and `accent` text, the others `textMuted`. Role `tablist`, each segment a `tab` with its selected state. Reason: none of the existing components switches between sections; `OptionGroup` is a form field (a label, wrapping chips, radio buttons) and reads wrongly to screen readers here.
- **[P17, proposed] A `usePagedList` hook** (`src/hooks/`), used by all three sections and Invite players; `VenueList` is rebuilt on it. It holds the search text and filters, waits 400 ms after typing stops (`SEARCH_DELAY_MS`; at once on a tapped suggestion, a tapped position, the keyboard's Search key and Clear search), drops replies that arrive after a newer request, loads the next page when the list nears its end (`onEndReached`) while `page × limit < total`, one page request at a time, and skips a row it already has (with offset paging a row can come twice when the list changed between two pages). Reason: paging, the typing pause and the stale-reply guard are the same three times; one tested copy.
- **States every section has:** the first load (spinner; on failure "Couldn't load teams." / "…players." / "…venues." with Try again); pull to refresh (back to page 1 with the current search); a spinner under the list while the next page loads; if that page fails, "Couldn't load more." with a **Try again** link under the list (the rows stay); nothing at all ("No teams yet." and so on); nothing matching ("No teams match your search." with a **Clear search** link that empties the search and every filter).
- **[P18, proposed] A loaded list stays as it is when the user opens a row and comes back:** same rows, same scroll position, same search. It reloads on pull to refresh and whenever the search or a filter changes, not on every return. Reason: reloading on return (what `VenueList` does today) would throw the user back to the first 20 rows after every detail screen. Trade-off: a change made elsewhere shows after a pull to refresh.
- **`personMeta(row)`** in `teamCommon.js` (review finding 12): the position and the area joined with " · " ("Goalkeeper · Mirpur 10"), or just the position when there's no area. It replaces `personPosition` on every player row.

### Explore (rebuilt)

One screen (`ExploreScreen`, route `Explore`, optional param `{ section }`), the same for players and venue owners.

- **[P19, proposed] Layout:** the `ScreenHeader` "Explore" and the `SectionTabs` (Teams · Players · Venues) stay at the top; under them, the chosen section's list fills the rest, with its search and filter fields as the top of the list, so they scroll away with it. Each section is loaded the first time it's shown and then keeps its search, filters, rows and scroll position while the user switches sections. Teams is shown first. Reason: the results get the screen; switching back and forth doesn't lose a search.
- My Teams' "Find a team" link opens Explore with `{ section: 'teams' }`.
- **Venue owners** see the same three sections. Nothing in them sends a request for an owner except the lists themselves: no Create team, no Request to join (Team detail is already read-only), no Invite card on Player detail.

### Teams section

- A "Search teams" `TextField` (`search` icon) and an "Area" `SuggestionField` (the shared area list), as in the venue list.
- One tappable `Card` per team (opens Team detail), like the My Teams card: `Avatar` with the team's initials, the name (`cardTitle`), "Captain: {name}" and "{memberCount} / {maxMembers} members" (`meta`), the area with the small `area` icon (when set), and the description (up to 2 lines, when set). **[P20, proposed]** Pills on the card: **"Full"** (soft) when the team is full (decided: marked "Full"), and the viewer's own pill from `viewerState`, in Team detail's words: "Captain" (strong), "Player", "Invited", "Request sent". Reason: the same words everywhere; the member count already says how full the team is, the pill makes it scannable.
- **[P21, proposed]** The old list's "+ Create Team" button isn't carried over (Create team lives on My Teams). The empty state "No teams yet." has a **Create team** button for players (it opens the form in the My Teams tab, as the old button did) and none for venue owners. Reason: Explore is for finding; one obvious place to create.

### Players section

- A "Search players" `TextField`, an "Area" `SuggestionField`, and **[P22, proposed]** a "Position" `OptionGroup` with **All** first, then the five positions; one choice, All by default; tapping one searches at once. Reason: the position picker people already know, with every choice visible.
- One tappable `Card` per player (opens Player detail): `Avatar`, the name, `personMeta` ("Goalkeeper · Mirpur 10"), a `forward` chevron. The old list's email line is gone.
- Empty: "No players yet."; no match: "No players match your search." with Clear search.

### Venues section

The existing `VenueList`, unchanged to look at, now on `usePagedList` with paging and P18. Its `header` prop goes (Explore draws the header). Venue detail's back link reads "Explore".

### Player detail (new)

`PlayerDetailScreen`, params `{ userId, playerName }`, loads `GET /players/:id` on focus and on pull to refresh. Registered with the team screens in every stack that can show a player (see Navigation).

- `BackLink`; then a `Card` like the player's own Profile: large `Avatar`, the name (`cardTitle`, from `playerName` while loading), the position as a soft `Pill`, the area with the small `area` icon (when set).
- **Details** `Card` of icon `ListRow`s, **[P23, proposed]** only the rows that have a value (as on Venue detail, venues spec P21): Height ("178 cm"), Weight, and **Phone** when the reply has one: tapping it opens the dialler (`openDialler`, labelled "Call {name}"), with the hint "You can see this because you're teammates." No card at all when none of the three is there. Reason: "Not added" is for the owner of a profile; a visitor just needs what's there.
- **Teams** `Card`: one `ListRow` per team (the `teams` icon, the name, "{memberCount} / {maxMembers} members", "Captain" as the trailing label where `isCaptain`, a chevron), each opening Team detail. Empty: "Not in a team yet."
- **[P24, proposed] "Invite to my team" is a card, shown when `inviteOptions` isn't empty:** one row per team the viewer captains, with the team name, its member count, and an **Invite** button (secondary, loading, keyed by team). A row that can't invite has no button and says why: "Already a member", "Already invited", "Asked to join" (Q5), "Team is full (15/15)". After a successful invite the row says "Invited" (or "Joined", if the reply says the invite approved a request that had just come in). A 400, 404 or 409 alerts "Something changed" with the backend's message and reloads. Reason: this is D4's list, shown straight away instead of behind a button and a picker: one tap less, one code path whether the captain has one team or five, and the reasons are visible at once.
- **Your own profile** (opened from your own row in a team): the same screen without the Invite card, with a line "This is how other players see you. Only your teammates see your phone." (part of P23).
- **[P25, proposed] Where Report and Block will go** (moderation feature): two danger text buttons at the bottom of the screen, under the cards, never on your own profile. Reason: the same place as Team detail's rare and destructive actions (feature 1's P9).
- A 404 (the account was deleted): "This player isn't available any more." with a **Back** button, as on Venue detail.
- The admin has no Explore tab and no Player detail screen in this feature (D5); the API still answers the admin.

### The team form, team cards and Team detail (changed)

- **Team form** (`TeamFormScreen`, create and edit): a third field, **Area** (`SuggestionField` with the shared list; optional), after the name, with the helper **[P26, proposed]** "Where your team usually plays, like Mirpur. Players search by it." `checkTeamForm` gains the area check (`areaProblem` / `tidyArea` from `profileChecks.js`, the backend's messages). The form sends `name`, `description` and `area` every time (P12). Edit team gets the area in its params.
- **Team cards** (My Teams and Explore): the area with the small `area` icon under the member count, when set.
- **Team detail:** the area as a muted line with the `area` icon under the team name, when set. **[P27, proposed]** A captain whose team has no area sees, in the same place, "No area yet." with an **Add area** link to Edit team. Reason: existing teams start without one (decided), and a team without an area is invisible to the area filter; this is how they get one.
- **[P28, proposed] Every person row on Team detail opens Player detail:** Members, Join requests and Invited (the brief names the member rows; the captain wants to look at a requester most of all). Their buttons (remove, approve, decline, cancel) keep working as now. The rows show `personMeta`; the Invited rows too, instead of the word "Invited" that the card's title already says.
- **The interim Invites screen** (Q1): its cards show a team and its captain's name, not a player row, so nothing changes there under the recommended answer.

### Invite players (changed)

- **[P29, proposed]** The screen shows the same player list as Explore → Players (one shared `PlayerList` component: search, Area, Position, paging), fed by `GET /teams/:teamId/invite-candidates`, with an **Invite** button on each row instead of the chevron. Tapping the row itself opens Player detail. Reason: "a goalkeeper in Mirpur" is the captain's question, and it's asked here; one component for both lists. This replaces the on-the-phone name filter (feature 1's P12).
- Unchanged: the member count line, "Team is full (x/y)" with every Invite disabled, the row turning into "Invited" (or "Joined") and staying, and "Something changed" with a reload after a 400, 404 or 409.
- Empty: "No players to invite right now."; no match: "No players match your search." with Clear search.

### Navigation

- **Explore stacks** (player and owner): `Explore`, `VenueDetail`, and the team screens. The routes `Teams`, `Players` and `Venues` go.
- **[P30, proposed] `PlayerDetail` joins `teamScreens()`**, also in its read-only form, so it exists in every stack that can show a team: My Teams, Explore (both roles) and the player's Notifications. Team detail and Player detail open each other with `navigation.push`, so a chain (team → player → their other team) goes back one step at a time. Reason: a screen can only navigate inside its own stack (TECHNICAL.md 8.5).
- Back links name the screen underneath where it has a short name ("Explore", "My Teams", "Invites"), otherwise "Back".
- `__tests__/navigation.test.js` changes with the routes.

### What is deleted (review finding 9)

- `src/screens/Team/TeamsListScreen.js` and `src/screens/Player/PlayersListScreen.js` (old style), and their images `assets/icons/viewteam.png` and `player.png`.
- `src/screens/Venue/VenuesScreen.js` (the interim Explore → Venues) and the interim three-row `ExploreScreen` (replaced by the new one in the same place).
- Afterwards the only old-style screens left are the admin's `ManageUsersScreen` and `ManageTeamsScreen` (D5), which only the admin can reach. `react-native-linear-gradient` and Ionicons stay installed until those two are restyled (Step 4).
- PRODUCT.md's "Interim screens" list loses its Explore line.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| `page=0`, `-1`, `1.5`, `abc`, `1001`, or given twice | 400 "Page must be a whole number from 1 to 1000" | The app only sends whole pages |
| `limit=51` or `0` | 400 "Limit must be a whole number from 1 to 50" | The app sends none (20) |
| A page past the end | 200, empty `items`, the real `total` | Stops asking for more |
| A team is created or deleted while someone scrolls | The next page shifts by one row | A repeated row is skipped; a missed row shows after pull to refresh |
| Search with `%` or `_` | Matched literally (`escapeLike`) | — |
| Area filter "  dhanmondi  27 " | Tidied to "dhanmondi 27" | — |
| A team without an area, area filter set | Not listed | The captain sees "No area yet." on Team detail (P27) |
| Two teams with the same name | Both listed, ordered by id | The captain's name on the card tells them apart |
| A full team | Listed after every team with a free spot | "Full" pill; Team detail's buttons already say "Team is full (15/15)" |
| A team fills up while its card is on screen | — | The card is out of date until refresh; Team detail and the backend are always right |
| The viewer in the players list | Left out | — |
| `position=goalkeeper` (wrong case) or `Pivot` | 400 with the position message | The picker only sends the five values |
| A Bangla name, area or search | Matched and counted in code points | Same |
| Player detail of a deleted account | 404 "Player not found" | "This player isn't available any more." |
| Player detail with a venue owner's or the admin's id | 404 "Player not found" | No screen links to one |
| The viewer shares a team only through a pending invite or request | No phone (both must be accepted) | No Phone row |
| Two players stop being teammates while Player detail is open | The next load has no phone | The row goes on reload |
| The captain invites from Player detail, but the player has just joined, been invited, or the team has filled | 400 or 409 from the invite endpoint | "Something changed", reload: the row now shows the reason |
| The player asked to join a moment before the captain taps Invite | The invite approves the request (feature 1's D2) | The row says "Joined" |
| A captain invites on Player detail, goes back to Invite players | — | That list isn't reloaded (P18), so the row still says Invite; tapping it gets "Something changed" and a reload |
| A venue owner calls `invite-candidates` | 403 (`playersOnly`) | No such screen for them |
| A non-captain member calls `invite-candidates` | 403 "Only the team captain can invite players." | — |
| An old app sends a team edit without `area` | The area is cleared (P12) | No released app exists |
| A blocked or suspended player (moderation feature) | That feature leaves them out in `discovery.js` | — |

## g. Hook points

**Notifications:** none new. Inviting from Player detail uses the existing invite endpoint, whose updates are listed in the team membership spec (section g).

**Moderation** (built by that feature; this one leaves a comment at each place):
- `discoverablePlayers(viewer)` in `src/utils/discovery.js`: add "not suspended" and "no block in either direction". That covers Explore → Players and the invite search at once.
- `GET /players/:id`: what a blocked or suspended player's page shows (most likely the same 404), and no `inviteOptions` between blocked players.
- `GET /teams` and `GET /owners`: whether a suspended captain's team and a suspended owner's venue are hidden (the venues spec already expects the venue to be).
- Player detail: the Report and Block buttons (P25).

## h. Test plan

**Backend** (`node:test`, real HTTP against the local server, throwaway users, as in `tests/helpers.js`):
- `tests/list-paging.test.js` (new): on all three lists and the invite search: the defaults, `total`, pages that don't overlap and together hold every row, a page past the end, every bad `page` and `limit` from section f.
- `tests/team-list.test.js` (new): the row's fields and nothing more (no `members`, no email or phone anywhere); `memberCount` counts accepted rows only; search, area, both, `%` and `_`, blank ignored, the limits; a team without an area and the area filter; a team given 15 accepted rows directly in the database comes after every team with a free spot; ties by id; `viewerState` for a captain, member, invited player, requester, stranger, venue owner and the admin.
- `tests/team-area.test.js` (new): create and edit with an area; tidying, 2–40, Bangla, blank and missing to null; the messages; the area in `GET /teams/:teamId`, `/teams/me` and `/players/invites`; a non-captain's edit is still 403.
- `tests/player-list.test.js` (new): the viewer is left out; search, area, position and all three together; a wrong position; the order; only player accounts; never an email, for a stranger, a venue owner and the admin; Q3's answer.
- `tests/player-detail.test.js` (new): the public fields; height and weight only if set; the phone for an accepted teammate, the player and the admin, and for nobody else (a stranger, a venue owner, someone with only a pending invite or request in the same team); never an email for any viewer; `teams` holds accepted teams only, with counts and `isCaptain`; `inviteOptions` for each state and its absence for venue owners, the admin and the player themselves; 404 and 400.
- `tests/invite-candidates.test.js` (new): the captain only; everyone with a row in the team is left out; the filters and paging; 403 and 404.
- `tests/teams-data.test.js` (new, after the migration): `Team.area` exists, accepts null, and is null for the existing teams.
- Updated: `venue-list.test.js` (the paged shape), and every test that reads `GET /teams`, `GET /players`, `GET /owners` or `GET /players/:id` today: `visibility.test.js`, `pending-invites.test.js`, `captain-id.test.js`, `membership-data.test.js`, `team-detail.test.js`, `venue-edit.test.js`, `venue-review.test.js`, `route-ids.test.js`; `team-validation.test.js` and `edit-team.test.js` for `area`.

**App** (Jest, fake API like the existing screen tests):
- `SectionTabs`: roles and states, 44-tall segments, the token guard, the gallery entry.
- `usePagedList` (fake timers): the 400 ms pause; a late reply is dropped; the next page is asked for once; it stops at `total`; a repeated row is skipped; a failed first load, reload and next page.
- Explore: the three sections; switching keeps each section's search and rows; the `section` param; "Find a team" from My Teams; a venue owner sees no Create team.
- Teams section: the request's `search`, `area` and `page`; the card with the captain, the area, "Full" and each viewer pill; the empty and no-match states with Clear search.
- Players section: the position chips send `position`; the row with `personMeta`; a row opens Player detail.
- `VenueList`: paging, and no reload on return.
- Player detail: the cards for a stranger, a teammate (the phone row and `tel:`), yourself, a venue owner; the Invite card for each `state`; the invite request, "Invited", and "Something changed"; the 404 state.
- Team form: the Area field, its suggestions, checks and the body with all three fields; My Teams cards and Team detail show the area; the captain's "Add area" link; rows show `personMeta` and open Player detail.
- Invite players: the request goes to `invite-candidates` with the filters; Invite, "Invited", the full team.
- Navigation: `PlayerDetail` in every stack; no `Teams`, `Players` or `Venues` routes; Android back through a team → player → team chain.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (for the owner; backend running; only a reload is needed, nothing native changes; accounts: player A who captains a team, player B, venue owner O; log out and in to switch):
1. As A: **Explore** shows the title, Teams · Players · Venues, and the Teams list. The full test team (15/15) is at the very end with a "Full" pill; A's own team has a "Captain" pill.
2. Type part of a team's name in another case: after a short pause only matching teams show. Clear search brings the list back.
3. **My Teams → your team → Edit team:** type `mir` in Area, pick "Mirpur", save. Team detail shows the area under the name; the My Teams card shows it too.
4. **Explore → Teams:** filter by area `mirp`: your team is listed. A team without an area isn't.
5. As captain of a team without an area: Team detail says "No area yet." with **Add area**.
6. **Players:** A isn't in the list. Tap **Goalkeeper**: only goalkeepers. Add an area: both must match. Search a name on top: all three combine. Each row reads like "Goalkeeper · Mirpur 10".
7. Tap player B: **Player detail** shows the name, position, area, height and weight only if B filled them in, B's teams, and no phone.
8. In the **Invite to my team** card tap **Invite**: the row says "Invited". As B: the invite is on the Notifications tab; accept it.
9. As A again: B's Player detail now shows the **Phone** row; tapping it opens the dialler with the number. The team's row in the Invite card says "Already a member".
10. From B's page tap one of B's teams: Team detail opens. Tap a member there: their Player detail opens. Android back goes one step at a time back to Explore, and the list is where you left it.
11. **Team detail → Invite players:** search and the Area and Position filters work; players already in the team, invited or asking aren't listed; Invite works as before.
12. To see paging: the 22 test players are just enough (21 without you, so one more than a page). Scroll the Players list to the end: a spinner shows briefly and the last row arrives.
13. **Venues** section: the list, search and area filter work as before; a venue opens Venue detail and back returns to Explore.
14. As O: Explore shows the same three sections; a team opens read-only; a player's page has no Invite card.
15. Turn the backend off and pull to refresh: the list stays. Open a section that hasn't loaded: "Couldn't load…" with Try again.
16. Largest font size: Explore, the cards, Player detail and the team form wrap without cutting text.

## i. Proposed task split

**[P31, proposed]** Five tasks, each leaving the app working:

1. **F3b.1 Backend.** The `team_area` migration (after the owner's approval); `listQuery.js`, `paging.js`, `discovery.js`; the team form's `area`; `GET /teams`, `GET /players`, `GET /players/:id`, `GET /teams/:teamId/invite-candidates`, `GET /owners` with paging; the tests in section h. Because three replies change shape, the same task makes the smallest edits that keep today's screens working until they're rebuilt (the old lists, `VenueList` and Invite players read `items`, first page only). Small commits: migration and team form · paging pieces and the venue list · teams list · players list and invite search · player profile. TECHNICAL.md (and ARCHITECTURE.md where the picture changes) in the same commits.
2. **F3b.2 Team area and player rows in the app.** The team form's Area field, the area on My Teams cards and Team detail, "Add area", and `personMeta` on Team detail's rows.
3. **F3b.3 Player detail.** The screen, its place in `teamScreens()`, the Invite card, and Team detail's rows opening it.
4. **F3b.4 Explore.** `SectionTabs` (with DESIGN.md), `usePagedList`, the new Explore screen with its three sections, `VenueList` on the hook; deletes the old lists, the interim screens and the two images; "Find a team".
5. **F3b.5 Invite players.** The shared `PlayerList` on the invite search.

Then the ROADMAP items are ticked, PRODUCT.md's interim Explore line is removed, and account deletion follows.

## j. Open questions

Questions the docs and code don't settle, and contradictions found while writing this spec. Each has a recommendation; the sections above use it.

| | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | **"Position · Area" on the Invites screen.** The brief and review finding 12 name the Invites screen, but its cards show a team and the captain's name; there's no player row, and `GET /players/invites` sends the captain as `{ id, name }` only. | (a) Nothing changes on the Invites screen; the line goes on Team detail's rows (Members, Join requests, Invited), Invite players and Explore. (b) Add the captain's position and area to the invite card, which needs them in the invites reply. | **(a).** The player decides by the team, which the card opens; the captain's own position adds little. |
| Q2 | **The position filter and "Any".** A player who chose "Any" plays anywhere. Should a captain filtering by "Goalkeeper" also see the "Any" players? | (a) Exact: Goalkeeper lists goalkeepers; "Any" is its own filter. (b) Every position filter also lists the "Any" players, after the exact matches. | **(a).** Predictable, and most test accounts are "Any" (15 of 22), so (b) would fill every filtered list with them. Easy to widen later. |
| Q3 | **Unverified players.** `GET /players` lists accounts that never verified their email. They can't log in, so they can't accept an invite, and anyone can sign up with someone else's email. | (a) Leave them out of Explore → Players and the invite search; Player detail still opens for a player who's already in a team. (b) List them as today. | **(a)**, the same idea as "a venue can't be approved while its owner hasn't verified". No account in the local database is affected (none is unverified). |
| Q4 | **Paging for the admin's lists (a contradiction).** The owner decided the "Pagination on list endpoints" item is covered by this feature, and D5 leaves the admin's Users and Teams tabs alone until Step 4, but Step 4 is "restyle without changing behaviour". So `/admin/users`, `/admin/teams` and `/admin/indoors` would never get paging, and the admin's venue review screen still loads every venue to show one (review finding 4). | (a) Tick the pagination item after this feature and add a new ROADMAP line: paging and search for the admin's lists, built when the moderation feature reworks the Users tab (suspend). (b) Add paging to the three admin endpoints in F3b.1 now, screens later. (c) Leave them unpaged for v1.0 with no item. | **(a).** One admin on good wifi can live with full lists at launch size; moderation touches those screens anyway. |
| Q5 | **A player who has asked to join, on Player detail's Invite card.** PRODUCT.md says inviting a player who already asked approves the request, but D4 shows that team disabled with the reason. Both can be true (the backend rule still covers two taps at the same moment), but the captain can't approve from the player's page. | (a) As D4: the row says "Asked to join", no button; the captain approves on Team detail. (b) The row gets an **Approve** button. | **(a)** for now: the captain usually came from the Join requests card, one Back away, and Invite players already leaves requesters out for the same reason. |

## k. Proposals (waiting for approval)

Defaults from the brief:
- **D1** Offset paging (`page`, `limit`, `total`), 20 per page, the same on all three lists; the app loads more on scroll (b, d.1).
- **D2** Search and every filter run on the backend, ignoring case and matching part of the text, 400 ms after typing stops (b).
- **D3** Player detail shows name, position, area, height and weight if set, the player's teams, and the phone only to accepted teammates (b, e).
- **D4** A captain of several teams picks the team from a list; teams that can't invite are shown disabled with the reason (b, e).
- **D5** The admin's Users and Teams tabs stay as they are until Step 4 (a).

Proposed by Claude Code:
- **P1** Paging limits: `page` 1–1000, `limit` 1–50; a page past the end is empty, not an error (b).
- **P2** Order: teams with a free spot first, then name, then id; players by name, then id (b).
- **P3** The position filter is one position at a time, matched exactly (b; Q2).
- **P4** Player lists leave out the viewer and anything that isn't a player account with a profile (b; Q3).
- **P5** Search at most 60 characters and the area filter at most 40, on every list (b).
- **P6** No new indexes for the searches now; trigram indexes later if needed (c).
- **P7** Shared list pieces: `listQuery.js` and `paging.js` (d.1).
- **P8** `src/utils/discovery.js` holds "who can be found", ready for blocked and suspended users (d.1).
- **P9** The light team row: no members or pending invites; the captain's name; counts (d endpoint 1).
- **P10** `viewerState` on each team row (d endpoint 1).
- **P11** The teams page is one SQL query through tagged `$queryRaw`, not a stored member count (d endpoint 1).
- **P12** Team create and edit take `name`, `description` and `area` every time; a missing area clears it (d endpoints 2–3).
- **P13** `GET /players/:id` becomes the public profile; the old stats reply goes (d endpoint 6).
- **P14** `inviteOptions` in the player profile reply, for captains (d endpoint 6).
- **P15** The invite search is `GET /teams/:teamId/invite-candidates` (d endpoint 7).
- **P16** A new shared component, `SectionTabs` (e).
- **P17** A `usePagedList` hook shared by every paged list; `VenueList` rebuilt on it (e).
- **P18** A loaded list isn't reloaded on return from a detail screen, only on pull to refresh or a changed search. This changes what `VenueList` does today (e).
- **P19** Explore's layout: the title and section tabs stay on top, search and filters scroll with the list, each section keeps its state (e).
- **P20** Team cards show a "Full" pill and the viewer's own pill (e).
- **P21** No Create team button in Explore, except in the empty state for players (e).
- **P22** The position filter is an `OptionGroup` with "All" first (e).
- **P23** Player detail leaves out empty rows, explains why the phone is visible, and marks your own profile (e).
- **P24** "Invite to my team" is an always-visible card listing the captain's teams, instead of a button that opens a picker (e; refines D4).
- **P25** Report and Block will sit at the bottom of Player detail (e).
- **P26** The team form's Area helper: "Where your team usually plays, like Mirpur. Players search by it." (e).
- **P27** A captain whose team has no area sees "No area yet." with an Add area link (e).
- **P28** Members, Join requests and Invited rows all open Player detail and show "Position · Area" (e).
- **P29** Invite players uses the same list as Explore → Players, with the Area and Position filters; its rows open Player detail (e).
- **P30** `PlayerDetail` is registered with the team screens in every stack; Team detail and Player detail `push` each other (e).
- **P31** The five-task split, with the backend task keeping today's screens working (i).
