# Connect Arena: Product Requirements

What the app should do, what's in each release, the approved business rules, and the decisions that are still open. How the app works *today* is in [ARCHITECTURE.md](ARCHITECTURE.md). The task list is in [ROADMAP.md](ROADMAP.md). The reasons behind decisions are in [DECISIONS.md](DECISIONS.md).

---

## What Connect Arena is

A football community app for indoor football (futsal) players in Bangladesh. Players build profiles, form and join teams, and discover indoor venues. Android first.

## Roles

- **PLAYER:** the main user. Plays, joins and runs teams.
- **OWNER:** an indoor venue owner. Has a venue profile that players can discover.
- **ADMIN:** manages users and moderation.

**Two meanings of "owner":**

- `Role.OWNER` is a **venue owner** (a type of account).
- The player who creates a team is called the **captain** in product terms. In the code this is `Team.ownerId`.

## v1.0 scope

What exists today, made secure and polished, plus:

- Player registration, email verification, login, persistent login
- Profile editing (players and venue owners)
- Change password while logged in
- Account deletion inside the app (required by Google Play)
- Player discovery
- Team creation, discovery and management, with multiple team memberships
- Captain invitations and player join requests, with captain approval
- Basic in-app notifications so users can see pending invites and join requests (exact form: open decision)
- Venue discovery and basic venue owner profile management
- Essential admin and moderation
- Security and privacy fixes
- UI and visual improvements

## v1.1 scope (planned, not built in v1.0)

- Team-to-team challenges and responses
- Match scheduling, cancellation, results and history
- Other features to be decided later

## Out of scope (not planned for v1.0 or v1.1)

Tournaments, venue booking, payments, real-time chat, advanced rankings and statistics, iOS release.

## Business rules (approved)

### Team membership (v1.0)

- Only PLAYER accounts can create teams.
- Players can belong to multiple teams.
- Players can request to join a team; the captain approves or rejects.
- Captains can invite players; the player accepts or rejects.
- A captain's invitation counts as captain approval.
- Players cannot approve their own join requests.

### Challenges and results (v1.1, approved now, built later)

- Only captains can send challenges on behalf of their team.
- A result becomes official only when both captains confirm the same result. A result confirmed by one captain stays provisional.

## Open decisions

> When a decision is made, move it into Business rules, record it in DECISIONS.md and remove it from this table.

| Area | Questions | Needed for | Status |
|---|---|---|---|
| Team membership | Request/invite expiry, withdrawing a request, duplicate requests, captain transfer, member limits | v1.0 | Open |
| Player profiles | What's public, private or visible only to teammates | v1.0 | Open |
| Venue owners | Exactly what owners can manage in v1.0; can owners also play? | v1.0 | Open |
| Administration | Moderation powers, reporting, enforcement | v1.0 | Open |
| Notifications | Form of in-app notifications (badge, inbox screen, etc.) | v1.0 | Open |
| Account deletion | Deletion flow, what data is kept, effect on teams (e.g. when a captain deletes their account) | v1.0 | Open |
| UI/UX | Navigation structure, visual design system, screen-by-screen changes | v1.0 | Open |
| Challenges | Who accepts/rejects, expiry, duplicates, cancellation | v1.1 | Open |
| Match scheduling | Who proposes/confirms date, time, venue; rescheduling | v1.1 | Open |
| Match cancellation | Who can cancel; does the other captain need to agree | v1.1 | Open |
| Match results | Submission, corrections, disagreements, admin intervention | v1.1 | Open |
