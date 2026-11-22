# Feature 3: Venues (spec)

Phase 4, Step 3. Task F3.0, written 2026-11-23. **Status: approved 2026-11-23** (DECISIONS.md, "Venues feature spec approved"). **Built 2026-11-23** in tasks F3.1–F3.4 (section i). Details settled while building: the app's search field has an icon inside it and caps the search at 60 and the area at 40 characters; the venue cards join multi-line opening hours with " · "; Venue detail's 404 state has a "Back to venues" button; the admin review screen loads `GET /admin/indoors` and picks its venue (no single-venue admin endpoint); the Dashboard shows the totals as 2 × 2 tiles.

**How to read the markers:**
- **[Dn, approved]**: a default from the task brief, confirmed by the owner on 2026-11-23.
- **[Pn, approved]**: a design choice proposed by Claude Code, with its one-line reason, approved by the owner on 2026-11-23. All are listed in section k.
- **Qn**: a question or contradiction found while writing the spec. The owner answered them on 2026-11-23; the answers are in section j and built into the sections above.
- Everything else comes from PRODUCT.md or DECISIONS.md, including the owner's decisions of 2026-11-23 (DECISIONS.md, "Venue details").

---

## a. What it covers

The Venues items in ROADMAP Step 3:

1. **The rest of the venue listing:** area, opening hours and pricing info, on Edit venue and everywhere the listing shows.
2. **Admin approval:** a new venue is "Pending review" and hidden from discovery until the admin approves it, which is refused unless the address, area and phone are filled in. The admin can leave a note on a pending venue and move an approved venue back to review with a note (decided 2026-11-23).
3. **My Venue's status:** the "Pending review" or "Live" pill, the missing-fields checklist and the admin's note.
4. **Venue discovery:** a venue list with search by name and an area filter (approved venues only), and a new **Venue detail** screen (tap the phone to call, tap the website to open it).
5. **The admin's side:** the Venues tab with pending venues first, approving, the note, moving back to review, and the Dashboard's "Venues waiting for review" count.

Not covered: the Teams and Players sections of Explore with search, and Player detail (**feature 3b**, right after this one, DECISIONS.md 2026-11-23); reporting a venue and suspending its owner (moderation feature, which hides a suspended owner's venue); "Your venue was approved" in the app (notifications feature, section g); venue photos, booking and several venues per account (later versions); pagination (ROADMAP's pagination item, with feature 3b; Q2).

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [Venue owners](../PRODUCT.md#venue-owners-v10): the listing fields, one venue per account, admin review, the completeness rule, the checklist, "can't clear once approved", edits after approval staying live, the admin's note and moving back to review, venue discovery.
- [Profiles → Area](../PRODUCT.md#profiles-v10): Area is free text with suggestions; filtering ignores case and matches part of the text; the same suggestion list is reused for venue areas. The phone rule (mobile numbers only) applies to venue phones.
- [Profile visibility → Venue listings](../PRODUCT.md#profile-visibility-v10): an approved listing is visible to any logged-in user; the owner's login email only to the owner and the admin.
- [App structure and navigation](../PRODUCT.md#app-structure-and-navigation-v10): My Venue, Explore, Venue detail, the admin Dashboard and Venues tab.

Details PRODUCT.md doesn't settle, as used in this spec:

- **[D4, approved] Venue area uses exactly the player Area rules:** the shared suggestion list (`src/constants/areas.js`), the same tidying (spaces at both ends removed, every run of spaces inside made one, letters kept as typed), the same 2–40 character limit after tidying (blank means no area), and the same case-insensitive, part-of-the-text filtering. In the backend it's the same `area()` piece from `profileFields.js`.
- **[P1, approved] Opening hours and pricing info** are optional plain text, trimmed, blank becomes null, **at most 120 characters** each, and may contain line breaks (for example a second line for Fridays). Reason: long enough for "Sat–Thu 8am–2am, Fri 2pm–2am" or a couple of prices, short enough to stay a summary rather than a menu.
- **[P2, approved] The admin's note** is trimmed text of **at most 200 characters**; blank means no note. There's one note at a time (a new note replaces the old one; no history). Reason: the owner only needs the current instruction; a history is a messaging system v1.0 doesn't have.
- **[D5, approved] When a venue is approved, the admin's note is cleared.** Moving a venue back to review sets a new note.
- **"Complete"** means address, area and phone are all filled in (PRODUCT.md). Opening hours, pricing info, website and description stay optional.
- **"Can't clear once approved"** means: on a live venue, an edit that would leave the address, area or phone empty is refused. Every live venue is complete from the start (Q1), so this never meets an already-empty field.
- **[P3, approved] A venue is identified by its owner's user id** in every route (`/owners/:userId`, `/admin/indoors/:id`). Reason: one venue per account (PRODUCT.md), and the existing replies and admin routes already use the owner's user id; when venues get their own table (later versions), the routes change anyway.

## c. Data changes

One migration, `venues`. **It needs the owner's approval when it's created in the backend task (F3.1)**, after the data step for Q1 (below).

| Change | Details | Existing data |
|---|---|---|
| **Venue area** | `OwnerProfile.area String?` (D4) | Null for every venue (the field is new); the three existing venues get one before the migration (Q1) |
| **Opening hours, pricing info** | `OwnerProfile.openingHours String?`, `OwnerProfile.pricingInfo String?` (P1) | Null |
| **Approval** | **[P4, approved]** `OwnerProfile.approvedAt DateTime?`: null means "Pending review", a date means "Live" (approved at that moment). No status enum. Reason: there are exactly two states (no rejected state, decided 2026-11-23), and the date tells the admin when a venue went live. | Set to the migration time for every existing venue (PRODUCT.md: existing venues are treated as approved), once they're complete (Q1) |
| **The admin's note** | **[P5, approved]** `OwnerProfile.reviewNote String?` (P2). Reason: one note per venue, stored with the venue it's about. | Null |
| **Index** | **[P6, approved]** an index on `OwnerProfile.approvedAt`. Reason: every discovery query filters on it, and the Dashboard counts the nulls. | — |

Nothing else changes in the database. Search by name and the area filter use Prisma's `contains` with `mode: 'insensitive'` on the stored text (decided in the profiles spec, "Filtering by area"); no search index is needed at this size.

**The local database on 2026-11-23** has three venues: "Camp nou" (user 1684), "F12 Test Arena" (user 12207, an `@example.com` test account) and "Barnabeu Arena" (user 19034). All three have a phone and an address; none has an area (the field doesn't exist yet). So "treat existing venues as approved" would put three incomplete venues live. That's Q1.

## d. API

### d.1 Shared rules

- **Validation:** every body and query goes through a zod schema; controllers read only `req.valid`. The new venue fields join `profileFields.js` (`venueArea` reuses `area()`, plus `openingHours()`, `pricingInfo()`, `reviewNote()`); `ownerSchemas.js` and `adminSchemas.js` (new, one file per router) use them. Unknown fields are stripped. URL ids go through `parseId`.
- **Messages:** one short message per reply. Existing messages keep their words.
- **Visibility:** every venue in a reply goes through `src/utils/visibility.js`. **[P7, approved]** `toPublicVenue` gains `area`, `openingHours` and `pricingInfo`, and never returns `approvedAt`, `reviewNote` or the owner's email (the email only with `canSeeEmail`, as today). The owner (`/owners/me`) and the admin get everything except secrets. Reason: the note is between the admin and the owner; players only ever see live venues, so the status means nothing to them.
- **[P8, approved] `missingFields`:** the backend works out which of `address`, `area` and `phone` are empty, always in that order, and returns it as `missingFields` (an array, empty when complete) in `GET /owners/me`, `PATCH /owners/me` and every admin venue reply. Reason: the completeness rule then lives in one place; the app shows the list instead of repeating the rule.
- **Status codes** as before: 400 bad input, 403 wrong role, 404 gone, 409 the current state doesn't allow it.

### d.2 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `GET /owners/me` | venue owner | changed: new fields, `approvedAt`, `reviewNote`, `missingFields` |
| 2 | `PATCH /owners/me` | venue owner | changed: new fields; can't clear address, area or phone while live |
| 3 | `GET /owners` | any logged-in user | changed: approved venues only; `search` and `area` filters |
| 4 | `GET /owners/:userId` | any logged-in user | new: one approved venue (Venue detail) |
| 5 | `GET /admin/indoors` | admin | changed: new fields, status, note, `missingFields`; pending first |
| 6 | `POST /admin/indoors/:id/approve` | admin | new |
| 7 | `PUT /admin/indoors/:id/note` | admin | new: set or clear the note on a pending venue |
| 8 | `POST /admin/indoors/:id/move-to-review` | admin | new: back to pending, with a note |
| 9 | `GET /admin/stats` | admin | changed: `pendingVenueCount` |
| 10 | `DELETE /admin/indoors/:id` | admin | unchanged (deletes the owner's account) |

**[P9, approved] The public venue routes stay under `/owners`** (3 and 4), not a new `/venues` router. Reason: the smallest change; the app already calls `GET /owners`. Route order: `/me` stays above `/:userId`. The admin routes keep the existing `/admin/indoors` naming for the same reason.

### d.3 Endpoint details

Every error reply is `{ "error": "<message>" }`.

**1. `GET /owners/me`** (changed). As today, plus the new fields and the status:

```json
{ "id": 19034, "email": "…", "role": "OWNER", "createdAt": "…",
  "ownerProfile": { "indoorName": "Barnabeu Arena", "phone": "01712345678", "address": "Road 5",
                    "area": null, "website": null, "description": null,
                    "openingHours": null, "pricingInfo": null,
                    "approvedAt": null, "reviewNote": "Please add your area",
                    "missingFields": ["area"] } }
```

**2. `PATCH /owners/me`** (changed; `onlyRole('OWNER', 'Owners only')`, then `updateVenueSchema`). Every field each time (as today, spec P11 of feature 2): `indoorName`, `phone`, `address`, `website`, `description` with today's rules and messages, plus, in this order after `address`:
- `area`: the player Area rules (D4): optional text, tidied, 2–40, blank or missing null. "Area must be text", "Area must be between 2 and 40 characters".
- `openingHours`: optional text, trimmed, at most 120, blank null. "Opening hours must be text", "Opening hours must be at most 120 characters".
- `pricingInfo`: optional text, trimmed, at most 120, blank null. "Pricing info must be text", "Pricing info must be at most 120 characters".

Then, in the controller, **the live-venue rule:** if the venue is live and the body leaves `address`, `area` or `phone` empty, 400 with the first one, in that order: **[P10, approved]** "A live venue needs an address", "A live venue needs an area", "A live venue needs a phone number". Reason: says why the field can't be emptied, not just that it's required.

**[P11, approved] One conditional update:** an edit that leaves one of the three empty is written with `where: { userId, approvedAt: null }`; if nothing was updated and the venue exists, it went live in the meantime, so the reply is the 400 above. An edit that keeps all three filled is written without that condition. Reason: an approval and an emptying edit arriving at the same moment can't leave an incomplete venue live, without a lock.

Reply: 200 with the `GET /owners/me` shape. The edit never changes `approvedAt` or `reviewNote` (edits stay live, decided 2026-11-23; the note stays until the admin changes it or approves).

**3. `GET /owners`** (changed; any logged-in user). **Only live venues** (`approvedAt` not null). Optional query (`venueListQuerySchema`):
- `search`: text, trimmed; blank ignored; at most 60 ("Search must be at most 60 characters"). Matches part of the venue name, ignoring case.
- `area`: text, tidied like Area; blank ignored; at most 40 ("Area must be at most 40 characters"). Matches part of the venue's area, ignoring case ("dhanmondi" finds "Dhanmondi 27").
- Both together must both match.

**[P12, approved]** Sorted by venue name, A to Z (ties by user id). Reason: a list people scan by name; "newest first" means nothing to a player. Reply: a plain array of public venues (`toPublicVenue`), as today, each with `userId`, `indoorName`, `area`, `address`, `phone`, `website`, `description`, `openingHours`, `pricingInfo`, `createdAt`. No pagination yet (Q2).

**4. `GET /owners/:userId`** (new; any logged-in user). One live venue, the same fields as in the list. 400 "Invalid venue id" (`parseId`); **404 "Venue not found"** if there's no venue owner with that id or the venue isn't live (a pending venue is hidden even from someone who knows the id; the owner uses `/owners/me`, the admin the admin routes).

**5. `GET /admin/indoors`** (changed). Every venue, each with today's fields (including the owner's `email` and `verified`) plus `area`, `openingHours`, `pricingInfo`, `approvedAt`, `reviewNote` and `missingFields`. **[P13, approved]** Order: pending venues first, oldest waiting first (by the owner's `createdAt`), then live venues by name A to Z. Reason: the admin works through the queue in the order venues arrived.

**6. `POST /admin/indoors/:id/approve`** (new; `isAdmin`). No body.
- 400 "Invalid venue id"; 404 "Venue not found" (no venue owner with that id).
- Already live: 409 "This venue is already live".
- **Incomplete: [P14, approved] 409 `{ "error": "This venue can't go live yet. Missing: area, phone", "missingFields": ["area", "phone"] }`.** Reason: 409 is "the current state doesn't allow it" (as for the team limit); the message reads well in an alert, and the list lets the screen mark the fields. This is the one reply with a field besides `error`.
- **The owner hasn't verified their email (Q5):** 409 "The owner hasn't verified their email yet". Checked before completeness.
- Otherwise one conditional update (`where: { userId, approvedAt: null, address, area and phone not null }`, P11's reason): `approvedAt` now, `reviewNote` null (D5). If it updates nothing, the venue is re-read and the matching 409 above is sent.
- Reply 200 with the admin venue shape (as in 5).

**7. `PUT /admin/indoors/:id/note`** (new; `isAdmin`; `reviewNoteSchema`). Body `{ note }`: text, trimmed, at most 200 ("Note must be text", "Note must be at most 200 characters"); blank or null clears the note.
- 404 "Venue not found". **[P15, approved]** A live venue: 409 "This venue is live. Move it back to review to leave a note". Reason: the owner only sees the note while pending (decided), so a note on a live venue would be invisible.
- Reply 200 with the admin venue shape.

**8. `POST /admin/indoors/:id/move-to-review`** (new; `isAdmin`; `moveToReviewSchema`). Body `{ note }`: **required**, text, trimmed, 1–200 ("Add a note for the owner", "Note must be at most 200 characters").
- 404 "Venue not found"; already pending: 409 "This venue is already waiting for review".
- One update: `approvedAt` null, `reviewNote` the note. The venue disappears from `GET /owners` and `GET /owners/:userId` at once.
- Reply 200 with the admin venue shape.

**9. `GET /admin/stats`** (changed): adds `pendingVenueCount`, the number of venues with `approvedAt` null.

**10. `DELETE /admin/indoors/:id`**: unchanged.

## e. Screens

Built from `src/components/ui` with theme tokens only. Every button that sends a request uses `useBusyAction` and the Button's `loading` state (TECHNICAL.md 8.8). Field problems found before sending show under the field; the backend's `error` shows in an alert. No mockups exist for these screens; they follow DESIGN.md section 6.

**[P16, approved] A new icon, `price`** (Lucide `Banknote`), for pricing info; opening hours use the existing `time` (Clock). Recorded in DESIGN.md section 7. Reason: none of today's icons means money.

### My Venue (owner, changed)

- Under the venue name, the status as a `Pill`: **[P17, approved]** "Live" (strong) or "Pending review" (soft). Reason: the strong lime pill marks the good state, like "Captain".
- **While pending:**
  - **The admin's note**, when there is one: a `Card` with the `SectionHeader` "Note from the admin" and the text.
  - **The checklist:** a `Card` "Before your venue can go live" with three rows, Address, Area and Phone, each with the `success` icon (in `accent`) and "Added", or the `warning` icon and "Missing". When all three are added: "Your listing is complete. The admin will review it soon." Built from `missingFields`.
- **While live:** no checklist and no note.
- The "Listing" card gains **Area** (`area` icon), **Opening hours** (`time`) and **Pricing info** (`price`) rows, each "Not added" when empty (feature 2's P26). Order: Phone, Address, Area, Website, Opening hours, Pricing info, Description.
- Edit venue, loading on focus and pull to refresh: as today.

### Edit venue (owner, changed)

Fields in this order: Venue name, **Area** (`SuggestionField` with the shared area list; optional; helper **[P18, approved]** "The neighbourhood players search by, like Dhanmondi 27."; reason: says why it matters, since it's how players find the venue), Address, Phone, Website, **Opening hours** (optional, multiline, helper "Like Sat–Thu 8am–2am"), **Pricing info** (optional, multiline, helper "Like ৳2,000 per hour"), Description. Every field is sent each time.

Checks before sending (`venueChecks.js`): the new fields' limits, and, **on a live venue**, the three "A live venue needs…" messages under the field when address, area or phone is emptied. The backend checks again.

### The venue list (players and owners; Explore → Venues)

**[D1, approved]** Until feature 3b, Explore keeps its three rows, and "Venues" opens this list. **[P19, approved]** It's built as a `VenueList` component (in `src/screens/Venue/`), shown by a small `VenuesScreen` with a `ScreenHeader` "Venues" and a back link; feature 3b puts the same `VenueList` into the real Explore as its Venues section. The old `IndoorsListScreen` is deleted, and the Explore route is renamed from `Indoors` to `Venues`. Reason: built once in the new design, reused as is.

- A search `TextField` "Search venues" (the `search` icon as its label's companion; any text) and an area `SuggestionField` "Area" (the shared list). **[P20, approved]** The list reloads from `GET /owners` with `search` and `area` 400 ms after the person stops typing (or at once when a suggestion is tapped). Reason: the backend does the matching (one rule, the same as everywhere else), without a request per keystroke.
- One `Card` per venue: the venue name (`cardTitle`), the area with the `area` icon (when set), and the opening hours on one line (`meta`, when set). Tapping it opens Venue detail.
- Empty states: no live venues at all, "No venues yet."; nothing matches, "No venues match your search." with a **Clear search** link.
- Loading, pull to refresh and a failed first load ("Couldn't load venues.", Try again) as on the other rebuilt screens.

### Venue detail (players and owners, new)

`BackLink` "Venues", the venue name (`title`), and the area as a soft `Pill` (when set). A "Listing" `Card` of `ListRow`s: Address (`area` icon), Phone (`phone`), Website (`website`), Opening hours (`time`), Pricing info (`price`), Description (`description`).
- **[P21, approved]** Empty optional rows are left out (no "Not added"). Reason: "Not added" invites the owner to fill something in; a player just needs what's there.
- **Phone:** tapping the row opens the phone's dialler (`Linking.openURL('tel:<number>')`), labelled "Call {venue name}".
- **Website:** a `TextLink` only when `isWebLink` passes, otherwise plain text (as on My Venue).
- Loads `GET /owners/:userId`. A 404 (the venue was deleted or moved back to review): "This venue isn't available any more." with a way back. Pull to refresh.
- Registered in both Explore stacks (`VenueDetail`, params `{ userId, venueName }`). Feature 3b's Explore opens the same screen. The moderation feature adds a Report button here.

### The admin's Venues tab (changed) [D2, approved]

The Venues tab shows pending venues first with a count, then live ones.

**[P22, approved] Rebuilt in the new design**, together with the Dashboard (below). Reason: the screen changes almost completely, and admin screens built from the shared components stay clear without extra work.

- **The list** (`AdminVenuesScreen`): a `SectionHeader` "Waiting for review" with a count `Pill`, then one `Card` per pending venue: name, area, the owner's email, "Unverified" when the owner hasn't verified their email, and "Missing: area, phone" (from `missingFields`) or "Complete". Then "Live (n)" with one row per live venue. Each opens the review screen. Empty: "No venues yet."
- **[P23, approved] The review screen** (`AdminVenueScreen`, in the Venues tab's stack): the full listing, the owner's email, the status and the date it went live. Reason: a note needs a text field, and a list full of text fields is hard to use.
  - **Pending:** **Approve** (primary), disabled with "Missing: …" under it while `missingFields` isn't empty, or with "The owner hasn't verified their email yet" for an unverified owner (Q5); a "Note for the owner" `TextField` (helper "The owner sees this on My Venue while the venue is pending.", at most 200) with **Save note** (secondary; saving an empty field clears the note).
  - **Live:** **Move back to review** (secondary), which opens a step with a required "Note for the owner" field (the reason) and **Move back to review** (danger), then a confirmation "Move {name} back to review?" / "Players won't see it until you approve it again."
  - Both: **Delete venue** (danger, with today's confirmation: it deletes the owner's account).
  - After an action the screen shows the new state; a 409 (the venue changed meanwhile) alerts "Something changed" with the backend's message and reloads.

### The admin Dashboard (changed) [D3, approved]

A tappable `Card` "Venues waiting for review" with the count (from `pendingVenueCount`), highlighted when it's above zero (a `Badge`-style count), opening the Venues tab. The existing counts stay. Rebuilt in the new design (P22).

### Navigation

- Explore stacks (player and owner): `Venues` (was `Indoors`) and `VenueDetail`.
- Admin Venues tab: `AdminVenues` (was `ManageIndoors`) and `AdminVenue`.
- `__tests__/navigation.test.js` changes with the route names.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| A new owner, only a venue name | Pending, `missingFields: ["address", "area", "phone"]`; not in `GET /owners` | My Venue: "Pending review", the checklist with three "Missing" |
| The owner completes the listing | Still pending until the admin approves | Checklist all "Added", "The admin will review it soon." |
| The admin approves an incomplete venue | 409 with `missingFields` | Approve is disabled first; if the listing changed meanwhile, the alert names what's missing |
| The owner empties the area while the admin approves | P11: whichever lands second sees the other; the venue is never live and incomplete | Either "A live venue needs an area" or the admin's 409 |
| The owner edits a live venue (name, hours, description) | Stays live; the edit shows in discovery at once | — |
| The owner tries to empty the phone of a live venue | 400 "A live venue needs a phone number" | The same message under the field, before sending |
| Note on a live venue | 409 | The review screen doesn't offer it |
| Move back to review without a note | 400 "Add a note for the owner" | Checked under the field |
| A player has Venue detail open when the venue is moved back or deleted | 404 on the next load | "This venue isn't available any more." |
| A pending venue's id in `GET /owners/:userId` | 404 "Venue not found" | — |
| The owner looks at Explore → Venues while pending | Their venue isn't listed | My Venue explains the status |
| Search with `%` or `_` in it | They must match literally, not as wildcards (the backend task checks how Prisma's `contains` treats them and escapes them if needed) | — |
| Search "dhan", area "  dhanmondi  27 " | Area tidied to "dhanmondi 27"; both must match | — |
| A Bangla venue name or area | Matched and counted in code points | Same |
| Opening hours of 121 characters | 400 "Opening hours must be at most 120 characters" | Checked before sending |
| The owner's account is deleted | The venue disappears (as today) | Venue detail: 404 state |
| A suspended owner (moderation feature) | That feature hides the venue from `GET /owners` and `/owners/:userId` | — |
| Existing venues without an area | None: Claude Code fills in an area for the three test venues before the migration (Q1) | — |
| An unverified owner's venue | Approve: 409 "The owner hasn't verified their email yet" (Q5) | "Unverified" on the admin's list and the review screen; Approve disabled with that reason |

## g. Notification hook points

For the notifications feature (feature 5), which builds the Updates list:
- **Approve** (endpoint 6): "Your venue is live" for the owner. PRODUCT.md lists "Your venue was approved" already.
- **Move back to review** (endpoint 8): "Your venue was moved back to review" for the owner, showing the note (added to PRODUCT.md's events, Q4).
- **Saving a note** (endpoint 7): no notification proposed; the owner sees it on My Venue.

Both hooks are one call after the successful update in the controller; this feature leaves a comment at each place.

## h. Test plan

**Backend** (`node:test`, real HTTP against the local server, throwaway users, as in `tests/helpers.js`):
- `tests/venue-edit.test.js` (updated): the new fields with their limits and messages; area tidying and Bangla code points; blank to null; the live-venue rule for each of the three fields, in order; edits to a live venue keep it live and keep the note; a pending venue can empty them; the reply's `missingFields`.
- `tests/venue-review.test.js` (new): approve (complete → live, note cleared; incomplete → 409 with `missingFields` in order; already live → 409; an unverified owner → 409 (Q5); 404 and 400 ids; player and owner 403); note (set, replace, clear, 200-character limit, live venue 409); move to review (note required, sets pending and the note, the venue disappears from both public routes, already pending 409); the race: an emptying edit and an approval fired together never leave an incomplete live venue (as `team-limit.test.js` does).
- `tests/venue-list.test.js` (new): only live venues; search and area match part of the text ignoring case; both together; `%` and `_` match literally; tidied area; blank ignored; limits; sorted by name; `GET /owners/:userId` for live (200), pending (404), a player's id (404), a bad id (400); the owner's email never in either reply, `reviewNote` and `approvedAt` never either.
- `tests/admin-stats.test.js` or the existing stats test: `pendingVenueCount`.
- `tests/visibility.test.js` (updated): `toPublicVenue` with the new fields and without the status, note and email.
- `tests/venues-data.test.js` (after the migration): the new columns exist and accept null; the index exists; every existing venue is live and complete (Q1).

**App** (Jest, fake API like the existing screen tests):
- My Venue: the pill per state; the checklist from `missingFields`; the complete text; the note card only while pending; the new rows with "Not added".
- Edit venue: the new fields filled in and sent (every field, nulls for empty); the area suggestions; the limits; the live-venue messages before sending; the double-tap guard.
- `VenueList`: the request with `search` and `area` after the pause (fake timers); a tapped suggestion searches at once; the empty and no-match states with Clear search; tapping a venue opens Venue detail.
- Venue detail: the rows, empty ones left out; the phone opens `tel:`; the website link only when `isWebLink` passes; the 404 state.
- Admin Venues list and review screen: the order and counts; Approve disabled with the missing list; approve, note and move to review send the right requests, with the loading Button; the required note; a 409 alerts and reloads.
- Dashboard: the waiting count and its link.
- `venueChecks.js`: the new limits and the live-venue rule.
- Navigation: the renamed and new routes in the Explore stacks and the admin Venues tab.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (for the owner; backend running; log out and in to switch accounts):
1. Sign up a new venue with only a name; verify and log in. **My Venue**: "Pending review", the checklist with Address, Area and Phone "Missing".
2. **Edit venue**: type `dhan` in Area → "Dhanmondi" is suggested; pick it. Add an address and a phone, opening hours and pricing info; save. My Venue: all three "Added", "The admin will review it soon.", the new rows filled in.
3. As a player: **Explore → Venues**: the new venue isn't listed yet.
4. As the admin: the **Dashboard** shows "Venues waiting for review: 1"; tap it. The **Venues** tab lists it under "Waiting for review". Open it, write a note ("Please add the road number"), Save note.
5. As the owner: My Venue shows the note. Change the address; save.
6. As the admin: open the venue, **Approve**. The Dashboard count drops.
7. As the owner: My Venue shows "Live", no checklist, no note. In Edit venue, clear the phone and save: "A live venue needs a phone number". Change the opening hours instead: saved, still live.
8. As a player: **Explore → Venues** lists it. Search part of its name in another case; filter by "dhan"; both find it. A search with no match shows "No venues match your search." and Clear search.
9. Open it: **Venue detail** shows the listing without empty rows. Tap the phone: the dialler opens with the number. Tap the website: the browser opens.
10. As the admin: **Move back to review** without a note: the error. With a note ("The venue is closed for renovation"): it's pending again. As the player, pull to refresh: it's gone from the list; an open Venue detail says it isn't available any more. As the owner: My Venue shows "Pending review" and the note.
11. As the admin: try to approve a venue missing its area: Approve is disabled and says what's missing.
12. Largest font size: My Venue, Edit venue, the venue list, Venue detail and the admin screens wrap without cutting text. Android back from each new screen returns to the screen before.

## i. Task split

1. **F3.1 Backend.** First, Q1's data step: Claude Code gives the three test venues an area of its choice in the local database and says which rows changed (no need to show them first: they're fake venues); then, after the owner approves it, the `venues` migration (section c); the new profile fields; `PATCH /owners/me` with the live-venue rule; `GET /owners` with search and the area filter; `GET /owners/:userId`; the admin list, approve, note and move to review; `pendingVenueCount`; visibility; the tests in section j. Small commits: migration · owner edit · discovery · admin review · stats. TECHNICAL.md (and ARCHITECTURE.md where the big picture changes) in the same commits.
2. **F3.2 Owner screens.** My Venue (pill, checklist, note, new rows), Edit venue (new fields, area suggestions, the live-venue checks), `venueChecks.js`, the `price` icon (DESIGN.md).
3. **F3.3 Venue discovery.** `VenueList`, the interim `VenuesScreen`, Venue detail, the Explore route changes; deletes `IndoorsListScreen`.
4. **F3.4 Admin.** The rebuilt Venues tab and review screen, and the Dashboard's waiting count; deletes `ManageIndoorsScreen` (and rebuilds `AdminDashboard`).

Then the ROADMAP items are ticked, and feature 3b follows.
## j. Answered questions

Questions the docs didn't settle, and contradictions found while writing this spec. The owner answered them on 2026-11-23; the answers are built into the sections above.

| | Question | Answer |
|---|---|---|
| Q1 | **Existing venues without area.** PRODUCT.md says existing venues are treated as approved, but all three in the local database lack an area (the field is new), so treating them as approved would put incomplete venues live. Options were: stay live as they are, go back to pending until complete, or fill them in first. | **Fill them in first.** They're fake venues: at the start of F3.1, Claude Code gives each an area of its choice in the local database and says which rows changed. Every existing venue is then complete and approved, and "a live venue is always complete" holds from the start, with no special case in the code. |
| Q2 | **Pagination.** ROADMAP's pagination item says pagination comes "with the Explore lists", and this feature builds the venue list. | **No pagination now.** The list returns every live venue; the pagination item changes all lists together, with feature 3b. |
| Q3 | **"admin Pending venues" screen.** PRODUCT.md's "New screens in v1.0" listed "admin Pending venues", while D2 puts pending venues first inside the Venues tab. | **The Venues tab's "Waiting for review" section is that screen.** PRODUCT.md's list now says so. |
| Q4 | **"Moved back to review" notification.** PRODUCT.md's events listed "Your venue was approved" but nothing for moving back. | **Add it:** "Your venue was moved back to review", showing the note, is now one of PRODUCT.md's update events (built by the notifications feature). |
| Q5 | **Unverified owners.** They can't log in, so they can't maintain a live listing. | **Approve refuses them:** 409 "The owner hasn't verified their email yet". Recorded in PRODUCT.md's admin review rules. |

## k. Proposals (all approved 2026-11-23)

Defaults from the brief, confirmed:
- **D1** Until feature 3b, Explore → Venues opens the new venue list, built to drop into the real Explore later (e).
- **D2** The admin's Venues tab: pending first with a count; Approve disabled until complete, showing what's missing; a note on pending venues; Move back to review with a required note on live ones (e).
- **D3** The Dashboard shows "Venues waiting for review" with the count, opening the Venues tab (e).
- **D4** Venue area uses exactly the player Area rules (b).
- **D5** Approving clears the admin's note (b).

Proposed by Claude Code, approved:
- **P1** Opening hours and pricing info: plain text, at most 120 characters each, line breaks allowed (b).
- **P2** The admin's note: at most 200 characters, one note at a time, no history (b).
- **P3** A venue is identified by its owner's user id in every route (b).
- **P4** Approval is stored as `approvedAt` (null = pending), not a status enum (c).
- **P5** The note is `OwnerProfile.reviewNote` (c).
- **P6** An index on `approvedAt` (c).
- **P7** `toPublicVenue` adds area, opening hours and pricing info, never the status, the note or the email (d.1).
- **P8** The backend returns `missingFields` to the owner and the admin, so the completeness rule lives in one place (d.1).
- **P9** The public venue routes stay under `/owners`; the admin routes keep `/admin/indoors` (d.2).
- **P10** The live-venue messages: "A live venue needs an address / an area / a phone number" (d endpoint 2).
- **P11** Conditional updates instead of a lock, so an approval and an emptying edit can't race into an incomplete live venue (d endpoints 2 and 6).
- **P12** The venue list is sorted by name, A to Z (d endpoint 3).
- **P13** The admin's list: pending first, oldest waiting first, then live by name (d endpoint 5).
- **P14** A refused approval is 409 with `missingFields` in the reply (d endpoint 6).
- **P15** No note on a live venue (409) (d endpoint 7).
- **P16** A new `price` icon (Lucide Banknote) (e).
- **P17** The status pill: "Live" strong, "Pending review" soft (e).
- **P18** The venue Area helper: "The neighbourhood players search by, like Dhanmondi 27." (e).
- **P19** A reusable `VenueList` component behind an interim `VenuesScreen`; `IndoorsListScreen` deleted; route `Indoors` renamed `Venues` (e).
- **P20** The list searches on the backend 400 ms after typing stops (e).
- **P21** Venue detail leaves out empty optional rows (e).
- **P22** The admin Venues tab and Dashboard are rebuilt in the new design (e).
- **P23** A separate admin review screen per venue, for the note and the actions (e).

