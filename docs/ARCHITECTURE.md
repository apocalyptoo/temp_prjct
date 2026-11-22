# How ConnectArena Works

A beginner-friendly tour of the app as it exists today. Everything here was checked against the source code. When this file and the code disagree, the code wins: fix this file.

Known bugs and missing features are not explained here. They're tracked in [ROADMAP.md](ROADMAP.md).

> **Naming:** the app shows "ConnectArena" on its login screen. The code and the Android project still use the name `IndoorFootballApp`.

---

## 1. The big picture

ConnectArena is a mobile app for indoor football (futsal). Players build teams, venue owners list their indoor fields, and an admin looks after everything.

The project has two parts that live side by side:

- `IndoorFootballApp/`: the **mobile app** people install on their phone.
- `backend/`: the **server** the app talks to. It stores all the data in a database.

Each part has its own `package.json`, so `npm` commands are always run inside one of the two folders. The root [README.md](../README.md) explains how to set everything up on a new computer.

### The three roles

Every account has exactly one role, chosen when the account is created.

| Role | Who it is | What they can do today |
|---|---|---|
| **Player** | Someone who plays | Register, log in, view their profile, browse all teams, create a team, invite players to their team, remove players from their team, delete their team, accept or reject invites, browse all players and all venues |
| **Owner** | Someone who runs an indoor venue | Register, log in, view their venue profile, browse all teams and all registered venues |
| **Admin** | The person running the app | See counts (users, players, owners, teams), list and delete users, list and delete teams, list and delete venues (deleting a venue deletes the owner's account). The admin screens can't delete the admin's own account or any admin account |

Admin accounts can't be created from the app. They're made with a script (see [section 8](#8-configuration)).

Both players and owners can ask for a password-reset email from their Settings screen ("Change Password").

Missing today: editing a profile, changing a password while logged in, deleting your own account and in-app notifications. See [ROADMAP.md](ROADMAP.md), Phase 4. What each release will include is in [PRODUCT.md](PRODUCT.md).

---

## 2. System diagram

```
 ┌──────────────────────┐
 │  Phone app           │   React Native (Android)
 │  IndoorFootballApp/  │
 └──────────┬───────────┘
            │ HTTPS requests, with the login token attached
            ▼
 ┌──────────────────────┐
 │  ngrok tunnel        │   public web address that forwards
 │  (…ngrok-free.dev)   │   to the developer's computer
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐  sends  ┌──────────────────────┐
 │  Backend server      │ ──────▶ │  Gmail (SMTP)        │
 │  backend/, port 4000 │  email  │  verification and    │
 │  Express + Prisma    │         │  password-reset mail │
 └──────────┬───────────┘         └──────────┬───────────┘
            │ database queries               ▼
            ▼                         User's inbox: the link
 ┌──────────────────────┐             in the email opens the
 │  PostgreSQL database │             backend in a browser,
 └──────────────────────┘             again through ngrok
```

Some terms from the diagram:

- **React Native** is a framework for building phone apps in JavaScript.
- **Backend** (or server) is a program that runs on a computer, receives requests from the app and sends back answers.
- **ngrok** is a tool that gives a program on your own computer a public web address, so a phone anywhere can reach it.
- **PostgreSQL** is the database: the program that stores all the data in tables.
- **SMTP** is the standard way programs send email. The backend logs in to a Gmail account to send mail, using the **nodemailer** library (version 10, which needs Node.js 20 or newer), all from one file, `src/utils/mailer.js`. Mail to `@example.com` addresses is never sent, only logged. That domain is reserved and can't receive mail, and the automated tests use it for their throwaway users.

Right now the backend and database run on the developer's own computer. Phones reach them only through the ngrok address.

---

## 3. A request's journey: a player creates a team

Here's what happens, step by step, when a player creates a team.

**On the phone**

1. The player taps **+ Create Team** on **All Teams** (Explore), which opens the form in the My Teams tab.
   File: `IndoorFootballApp/src/screens/Team/TeamsListScreen.js`. It asks the navigator to show the `CreateTeam` screen.
2. They type a name and description and tap **Create team**.
   File: `src/screens/Team/TeamFormScreen.js` (the same screen edits a team). `checkTeamForm` first checks the same limits as the backend (name 2–40 characters, description at most 200, counted in characters as people see them) and shows any problem under the field. Then it calls `api.post('/teams/create', { name, description })`.
3. Before the request leaves the phone, the shared API helper adds the login token.
   File: `src/api/api.js`. An **interceptor** (a function that runs on every request) reads the token from storage (`src/utils/storage.js`) and adds the header `Authorization: Bearer <token>`.
4. The request travels over HTTPS to the ngrok address, which forwards it to the backend on port 4000.

**On the server**

5. `backend/src/server.js` receives it. `express.json()` turns the JSON body into a JavaScript object. The `/teams` prefix sends it to the teams router.
6. `backend/src/routes/teamRoutes.js` matches `POST /create` and runs four functions in order: `verifyToken`, `playersOnly`, `validate(...)`, then `createTeam`.
7. `backend/src/middleware/auth.js`: `verifyToken` checks the token is genuine and not expired. If it's fine, the user's id and role go into `req.user`. If not, the request stops with a 401 ("not logged in") error. `playersOnly` then stops venue owner and admin accounts with a 403.
8. `backend/src/middleware/validate.js` checks the request body against `createTeamSchema` (in `backend/src/validation/teamSchemas.js`; see "How requests are checked" below). The name is required, must be text, and must be 2 to 40 characters once spaces at the ends are trimmed. The description is optional, but if given it must be text and at most 200 characters after trimming (an empty description is saved as none). Team names don't have to be unique. If a check fails, it replies 400 with a clear message, such as "Team name must be between 2 and 40 characters", and `createTeam` never runs.
9. `backend/src/controllers/teamController.js`: `createTeam` takes the checked, trimmed values from `req.valid.body` and uses Prisma to save them. In one step it creates the `Team` row, with the creator as its captain (`captainId`), and a `TeamMember` row with `status: 'accepted'`, `origin: 'creator'` and `acceptedAt` set to now, so the captain is also a member.
10. Prisma turns that into SQL and PostgreSQL stores both rows.

**Back to the phone**

11. The server replies with status 201 ("created") and the new team as JSON.
12. The form is replaced by the new team's **Team detail** (so Back goes to My Teams). My Teams and All Teams reload whenever they come back into view, so the new team appears there too.

If anything fails, the server replies with an error message and the screen shows it in an alert.

---

## 4. Backend

The backend is an **Express** app. Express is a small Node.js library for building web servers: you tell it "when a request comes in for this address, run this function". The code uses modern `import`/`export` syntax (ES modules).

### Folder layout

```
backend/
├── src/
│   ├── server.js        starts the server and connects the routers
│   ├── config.js        loads backend/.env, checks the settings, stops the server if one is wrong
│   ├── config/
│   │   └── loadConfig.js    the rules each setting must follow (tested on its own)
│   ├── db.js            the one shared Prisma client (database connection) for the whole server
│   ├── routes/          which address goes to which function
│   ├── controllers/     the functions that do the work
│   ├── middleware/
│   │   ├── auth.js          login, admin and player-only checks
│   │   ├── rateLimits.js    limits on repeated login, register and password-reset requests
│   │   ├── validate.js      checks a request against its rules before the controller runs
│   │   └── errorHandler.js  turns any unhandled error into a short generic reply
│   ├── validation/      the rules for each request (zod schemas), one file per router, plus shared helpers
│   └── utils/           shared helpers: the password rule, who may see what (visibility), email normalising, deleting users and teams, checking ids from URLs, HTML escaping, tokens, email templates, sending email (mailer.js)
├── prisma/
│   ├── schema.prisma    the database tables, described in code
│   └── migrations/      the history of changes to the tables
├── scripts/
│   └── createAdmin.js   creates an admin account
└── tests/               automated tests (run with `npm test` while the server is running)
```

Three terms used in this layout:

- **Route:** a rule linking an address and method (like `POST /teams/create`) to the code that handles it.
- **Controller:** the function that does the real work for a route: it reads the request, talks to the database and sends a reply.
- **Middleware:** a function that runs *before* the controller, for example to check the user is logged in. It can let the request continue or stop it.

### The five routers

`server.js` connects each address prefix to a router file. Each router file uses the controller with the same name (the `/legal` pages are fixed text, so they need none).

| Prefix | Route file | What it handles |
|---|---|---|
| `/auth` | `authRoutes.js` | Register, log in, verify email, forgot/reset password (no login needed), `GET /auth/me`: who is logged in, and `POST /auth/change-password` (both need a token) |
| `/players` | `playerRoutes.js` | My player profile and Edit profile (`PATCH /players/me`), my pending invites, my pending join requests, list all players, a player's stats |
| `/owners` | `ownerRoutes.js` | My owner profile and editing my venue listing (`PATCH /owners/me`), list all registered venues |
| `/teams` | `teamRoutes.js` | Create, list, my teams, one team, edit team, invite, cancel invite, accept, reject, join requests (ask, cancel, approve, decline), remove member, leave, transfer captaincy, delete team |
| `/legal` | `legalRoutes.js` | The Terms of Use (`/legal/terms`) and Privacy Policy (`/legal/privacy`) as web pages, no login needed. The text is a placeholder until the deployment phase writes the real one |
| `/admin` | `adminRoutes.js` | Stats, list/delete users, list/delete teams, list/delete venues (admins only). Deleting users only works on player and owner accounts, deleting venues only on owner accounts (404 "Venue not found" otherwise), and an admin account, including your own, gets 403 |

There's also `GET /`, which replies "API running" so you can check the server is up.

Route order matters in `playerRoutes.js`: `/me`, `/invites` and `/requests` come before `/:id`. Otherwise Express would treat the word "me" as a player id. For the same reason `GET /teams/me` comes before `GET /teams/:teamId` in `teamRoutes.js`.

### How login works

The backend uses a **JWT** (JSON Web Token): a signed piece of text that proves who you are, a bit like a stamped wristband at an event.

1. The app sends email and password to `POST /auth/login`.
2. The controller looks up the user and compares the password with the stored **hash** using **bcrypt**. A hash is a scrambled one-way version of the password, so the real password is never stored. bcrypt is the library that creates and checks these hashes. If the email doesn't exist, it still compares against a fixed dummy hash, so an unknown email takes as long as a wrong password and the timing gives nothing away. Only after the password matches does it check that the account is verified.
3. If everything matches, the server creates a JWT containing the user's id, role, email and the account's current **token version** (`tv`), signed with the secret `JWT_SECRET`. It's valid for **30 days**, so people on phones don't have to log in every week.
4. The reply contains the token plus basic user info (id, name, email, role).

From then on, the app sends the token with every request, in the header `Authorization: Bearer <token>`, and `verifyToken` (`src/middleware/auth.js`) checks it:

- The header must have exactly that shape, and the token must be genuine (signed with the secret, using the HS256 method), and not expired. Anything else gets 401.
- It then looks the account up in the database. If the account is gone, or the token's version number doesn't match the account's current `tokenVersion`, the token gets 401.
- The role and email it passes on come from the database, not from the token, so a change takes effect at once.

**Logging out every phone at once.** A token is like a wristband with a number written on it. The account keeps the current number. When the password is reset (the "Forgot password" email) or changed while logged in, the number goes up by one, in the same database update as the new password. Every wristband with the old number stops working, so every phone that was logged in is logged out, including one that might belong to whoever learned the old password. Logging in again gives a token with the new number. A password change while logged in also hands the phone that made it a new wristband straight away, so that phone stays logged in. Later, a suspension by the admin will do the same (DECISIONS.md, "Which events log out every device"). Normal **Log out** only deletes the token on that one phone.

`GET /auth/me` returns the logged-in user's own details (id, name, email, role, verified) through the visibility rules. The app calls it at start-up to restore the login from the saved token (see section 6). A missing, bad or expired token gets 401, and so does a token for an account that has since been deleted, or one cancelled by a password reset.

### How permissions work

There are four layers of checks:

- **Logged in?** `verifyToken` runs on every route except `/auth`.
- **Admin?** The `isAdmin` middleware runs on every `/admin` route. It rejects anyone whose token role isn't `ADMIN`.
- **Player?** The `playersOnly` middleware runs on every team action: creating, editing and deleting a team, inviting, accepting, rejecting, the join request actions, removing a member, cancelling an invite, leaving and transferring captaincy. Venue owner and admin accounts get a 403 saying only player accounts can create or join teams.
- **Only this role?** `onlyRole(role, message)` guards a route for one kind of account, before the request body is checked. Edit profile (`PATCH /players/me`) uses it, so a venue owner or the admin gets 403 "Players only" whatever they send; editing a venue listing (`PATCH /owners/me`) gives anyone but a venue owner 403 "Owners only".
- **Everything else** is checked inside the controllers. For example, `GET /players/me` refuses non-players, and inviting, removing or deleting in a team is refused unless you created that team.

Known security problems in these checks: see [ROADMAP.md](ROADMAP.md), Phase 1.

### Who can see what (profile visibility)

The backend decides which fields each person may see, following "Profile visibility" in [PRODUCT.md](PRODUCT.md). Hiding fields only in the app isn't enough, because anyone can read what the backend sends. The rules live in one file, `src/utils/visibility.js`, and every endpoint that returns user or profile data passes it through those helpers:

| What | Who sees it |
|---|---|
| Everything about an account | The user themselves (e.g. `/players/me`, `/owners/me`, the login reply) and the admin (admin routes) |
| A player's name, position, and height, weight and area (each only if set) | Any logged-in user. The area is a general area like "Dhanmondi 27", never a full address; it replaced the old address field |
| A player's phone | Only accepted teammates: both are accepted members of at least one same team |
| Email | Only the user themselves and the admin |
| A venue listing (name, address, phone, website, description) | Any logged-in user: it's a business listing. The owner's login email stays hidden |
| Password hashes, tokens and token expiry times | Nobody, ever |

The main helpers:
- `toVisibleUser(user, viewer)` gives you or the admin everything except secrets, and anyone else only the public fields.
- `toPublicPlayer` and `toPublicVenue` apply the profile rules.
- `withoutSecrets` strips passwords and tokens.
- `findAcceptedTeammateIds` works out a viewer's teammates in one database query.

Today no endpoint returns another player's phone, so teammates don't see it anywhere yet. That arrives with the Player detail screen in Phase 4, using these same helpers. Responses keep their usual field names: hidden fields are simply left out, and the app's screens skip a field that's missing. **Any new endpoint that returns user data must go through these helpers.**

### How requests are checked (validation)

Anyone can send the backend anything, not only the app: a missing field, a number where text belongs, a list, an object, or text thousands of characters long. Two things go wrong if that reaches the database unchecked. An object like `{"not": ""}` in a lookup is read by Prisma as a *query instruction* ("any token that isn't empty") instead of a value, which once allowed an account takeover. And a wrong type, like a phone number sent as a list, makes Prisma fail, which shows up as a 500 "Something went wrong".

So every request that sends data is checked **before** its controller runs:

- The rules are written as **schemas** with the **zod** library, in `src/validation/`: one file per router (`authSchemas.js`, `teamSchemas.js`), plus small shared helpers in `common.js`. A schema says, field by field, what's allowed: "name: text, trimmed, 2 to 50 characters", "height: a number from 100 to 250, or nothing".
- Each route lists its schema, for example `validate({ body: registerSchema })`. The checker in `src/middleware/validate.js` runs after the rate limits and login checks, and before the controller.
- If something is wrong, the reply is 400 with **one** short message, the first problem found, such as `{ "error": "Venue name is required" }`. The app shows it in an alert.
- If everything is fine, the checked and cleaned values (trimmed, emails lowercased, empty optional fields turned into "nothing") go on `req.valid`. Controllers read only from there, never straight from the request.
- **Fields the rules don't mention are ignored**, not refused. The app sends a few extras, and they're simply dropped.
- **Login is the exception to "one clear message":** any badly shaped login gets the same "Invalid email or password" as a wrong password, so login never reveals anything.
- Ids in the address (like the `5` in `/teams/5/invite`) aren't part of the schemas. They're checked with `parseId` (see below).
- Text limits count characters the way people see them, so a Bangla name isn't counted as longer than it looks. Passwords are limited to 72 bytes, because the password scrambler (bcrypt) ignores anything after that.

The limits and conventions are recorded in DECISIONS.md ("Input validation conventions and limits").

### Protection against abuse and leaks

- **Security headers (helmet).** `server.js` uses the `helmet` library, which adds standard protective headers to every reply. One of them is a content security policy, a rule list telling browsers what a page may load or do. The defaults work for the reset-password page, because its form posts back to the same site and it uses no inline scripts or styles.
- **Rate limits (express-rate-limit).** Too many requests get a 429 "too many attempts" reply. This stops password guessing and email spamming. In Bangladesh many phones on a mobile network can share one public address, so most limits count per address *and* email rather than per address alone (see DECISIONS.md, 2026-11-19):

  | Route | Limit |
  |---|---|
  | Login | Only **failed** attempts (wrong password) count: 10 per 15 minutes for one address + email, and at most 50 per 15 minutes for one address across all emails. "Please verify your email" doesn't count, because the password was right |
  | Register | 20 per hour per address |
  | Forgot password | 5 per hour for one address + email, and at most 20 per hour per address |
  | Resend verification email | 5 per hour for one address + email, and at most 20 per hour per address |
  | Reset (form submit) | 10 per 15 minutes per address |
  | Reset page and verify link (opened in a browser) | 30 per 15 minutes per address each |
  | Change password (logged in) | Only **failed** attempts count (a wrong current password, or a new password that breaks the rule): 10 per 15 minutes per account, and at most 50 per 15 minutes per address across all accounts |

  Emails are compared lowercased and trimmed. For IPv6, the whole /56 network counts as one address, because one connection usually owns a range of IPv6 addresses. Browser pages get a readable "Too many attempts" page instead of JSON. The counters are kept in memory, so they reset when the server restarts.
- **Email cooldown.** A password reset email or a new verification email isn't sent again to the same account within 5 minutes. The reply is unchanged and the earlier email's link still works. This caps how many emails one inbox can get, however many addresses someone uses.
- **Tokens are stored hashed.** The links in verification and reset emails carry a long random token. The database keeps only its **SHA-256 hash**, a fixed fingerprint that can't be turned back into the token. When a link is used, the backend hashes the token it received and looks up that hash. If the database ever leaked, the stored values couldn't be used as working links. (Passwords use bcrypt, which is deliberately slow. These tokens are long and random, so a fast hash is safe and allows a direct lookup.) The code is `hashToken` in `src/utils/tokens.js`.
- **Trust proxy.** The backend is reached through ngrok, which passes each visitor's real address in the `X-Forwarded-For` header. `server.js` sets `trust proxy` to 1 (trust exactly one proxy), so Express reads the visitor's address from there. Without it, every visitor would look like ngrok and share one rate-limit counter. Trusting more than one hop would let visitors fake their address.
- **No internal details in errors.** When something fails, controllers pass the error to `errorHandler.js`. It logs the real error on the server and replies only "Something went wrong" (500), or "Invalid request body" (400) when the request body can't be read. Error messages, stack traces and database details never reach the client.
- **Ids in addresses are checked.** Every id taken from an address (like the `5` in `/teams/5/invite`) goes through `parseId` in `src/utils/ids.js` first. Anything that isn't a positive whole number small enough for the database gets a 400 reply ("Invalid team id" and so on) instead of reaching the database and causing a 500.

---

## 5. Database

The data lives in PostgreSQL. The backend talks to it through **Prisma**, an **ORM** (Object-Relational Mapper): a library that lets you read and write database rows with JavaScript code instead of writing SQL by hand.

The server uses **one** Prisma client, created in `backend/src/db.js` and imported by every controller. Each client keeps its own pool of open database connections, so one client per file would multiply the connections the server holds, and hosted databases limit how many you get. The admin script (`scripts/createAdmin.js`) and the tests (`tests/helpers.js`) are separate programs, so each has its own client.

The tables are described in `backend/prisma/schema.prisma`. Changes to that file reach the real database through **migrations**: small saved SQL scripts, one per change, applied in order so every copy of the database ends up with the same tables. They live in `backend/prisma/migrations/`.

### The tables in plain words

- **User:** one row per account. Holds the email, the hashed password, the role (`PLAYER`, `OWNER` or `ADMIN`), whether the email is verified, and temporary tokens for email verification and password reset, each with an expiry time. The tokens are stored only as SHA-256 hashes (see "Tokens are stored hashed" in section 4), and both token columns have an index so lookups stay fast. It also holds a **token version** (`tokenVersion`, a number starting at 0). Every login token carries a copy of it. Increasing it cancels all of that account's login tokens at once, which logs the account out on every phone (see "How login works" in section 4). **`termsAcceptedAt`** records when the user ticked "I agree to the Terms of Use and Privacy Policy" at sign-up; it's empty for accounts made before the checkbox existed and for the admin.
- **PlayerProfile:** extra details for a player: name, phone, playing position, and optional height, weight and **area** (their neighbourhood, like "Dhanmondi 27", never a full address). The position is one of a fixed list: Goalkeeper, Defender, Midfielder, Forward or Any. Each player has exactly one.
- **OwnerProfile:** extra details for a venue owner: indoor (venue) name, and optional phone, address, description and website (a new owner signs up with only the venue name and fills in the rest later). Each owner has exactly one.

The migration `20261121204305_profiles_registration` made these profile changes. It was written by hand so nothing was lost: the old free-text positions were converted to the list (for example "gk" became Goalkeeper and "ATT" became Forward; anything unclear became Any), and the old player `address` column was renamed to `area` with its values kept.
- **Team:** a team's name, optional description, its captain (`captainId`), and when it was created. The creator becomes the captain. `captainId` is the only place the captain is recorded, so a team can never have two captains or none. It has an index, so finding a player's teams stays fast.
- **TeamMember:** links a user to a team. It has a `status`, which can only be `pending` (invited but not yet in) or `accepted` (in the team); the database refuses any other value. It also records:
  - **`origin`:** how the membership started: `invite` (the captain invited the player), `request` (the player asked to join) or `creator` (the captain's own row, made with the team).
  - **`createdAt`:** when the invite, request or team was created (this used to be called `joinedAt`, a misleading name).
  - **`acceptedAt`:** when the player actually became a member; empty while pending. The **longest-standing member** is the one with the earliest `acceptedAt` (ties go to the lower row id). It decides who becomes captain when a captain deletes their account.
  - **`message`:** a join request's optional message to the captain (added by migration `20261121120000_join_request_message`). Empty on every other row. Approving the request clears it; rejecting or cancelling deletes the whole row.

  `origin`, `acceptedAt` and `message` are left out of API replies (`MEMBERSHIP_FIELDS_NOT_IN_REPLIES` in `src/utils/membership.js`); `createdAt` is included. Only the captain, the requester and the admin will see a message, once the join request endpoints exist. A user can appear only once per team. An index on (user, status) keeps "my teams" and "my invites" fast. The captain also has an `accepted` row, like any member; nothing on the row marks them as captain (that's `Team.captainId`). Only `accepted` rows count as membership: member lists, member counts and a player's number of teams all leave out `pending` rows.

Admins have a User row but no profile.

### How they relate

```
                 ┌────────────────┐
     ┌── 0..1 ── │      User      │ ── 0..1 ──┐
     │           └───┬────────┬───┘           │
     ▼               │        │               ▼
PlayerProfile        │        │         OwnerProfile
                     │captains│ is a member through
                     ▼        ▼
                  ┌──────┐  ┌────────────┐
                  │ Team │◀─│ TeamMember │
                  └──────┘  └────────────┘
```

- A user has either a PlayerProfile or an OwnerProfile, depending on their role.
- A user can captain many teams (`Team.captainId`, the `captain` relation; `captainedTeams` on User).
- A team has many TeamMember rows, and a user can be a member of many teams.

The database has delete rules as a safety net: deleting a user also deletes their profile and their membership rows, and deleting a team also deletes its membership rows (this is called **cascade**). But it **refuses** to delete a user who is still captain of a team, so a team can never be left without a captain; the team must first be handed over or deleted. The code doesn't rely on cascade yet: when it deletes a team or a user, it still deletes the linked rows itself, in order (members, then teams, then profiles, then the user). All those steps run inside one **transaction**: the database either does every step or, if one fails, undoes the ones already done, so nothing is ever left half-deleted. This logic lives in one shared file, `src/utils/deletion.js` (`deleteUserAndData`, `deleteTeamAndMembers` and `removeTeamRows`), used by the admin screens, a captain deleting their team, and the last member leaving a team. Deleting a team also takes the team lock (see "Join requests" in section 6), so it can't overlap another change to the same team.

### Two meanings of "owner"

This used to trip people up. "Owner" now means only one thing:

1. **Owner the role** (`Role.OWNER`): a venue owner, a type of account.
2. The *player* who runs a team is the **captain** (`Team.captainId`), everywhere: in the database, the API replies and the app. Until Task 4.1 the code called this the "team owner" (`Team.ownerId`), and also marked the captain's member row with `role: 'captain'`; both are gone.

When the code says "only the team captain can invite players", it means the team's captain (a player), not a venue owner.

---

## 6. Mobile app

### Folder layout

```
IndoorFootballApp/
├── App.js               entry point: wraps everything in the theme and the login state,
│                        and sets the status bar (always white icons)
├── index.js             registers the app with React Native
├── __tests__/           Jest tests: renders the whole app once; checks the theme tokens
│                        and the Icon component
├── jest.config.js       Jest settings; jest.setup.js swaps native modules for mocks
├── react-native.config.js  lists the font folders the app ships
├── assets/fonts/        Barlow Condensed and Inter font files, with their licenses
├── src/
│   ├── api/api.js       shared helper for talking to the backend
│   ├── components/ui/   shared building blocks screens are made from (see "Shared components" below)
│   ├── contexts/        AuthContext.js: who is logged in
│   ├── navigation/      which screens exist for each role
│   ├── screens/         one file per screen, grouped by area
│   │   (Auth, Player, Owner, Team, Admin; Shared holds the Explore screen; Dev holds
│   │   the developer-only UI gallery)
│   ├── theme/           the look: colours, fonts, sizes (see "The theme" below)
│   └── utils/storage.js saves and reads the login token
├── android/             the native Android project
└── ios/                 the native iOS project
```

### The theme (colours, fonts and sizes in one place)

The app's look lives in one folder, `src/theme/`, as named values called **tokens**: `colors.accent` is the lime green, `spacing.screenPadding` is the space at the sides of a screen, `typography.display` is the big screen-title text style. Screens are meant to use these names instead of writing colours or sizes themselves, so changing the look later means editing the theme folder, not every screen. The full design is in [DESIGN.md](DESIGN.md).

- **Two colour layers.** `palette.js` holds the actual colours with plain names (`lime`, `nearBlack`). `colors.js` gives them meanings (`accent`, `bg`, `danger`). Screens only use the meanings.
- **Text styles** (`typography.js`) bundle a font, size, line height and letter spacing. Headings are always uppercase, and that's built in. Each font weight is its own font file (`Inter-SemiBold`, `BarlowCondensed-Bold`), because Android picks a custom font's weight by file.
- **`spacing.js`, `radius.js`, `shadows.js`** hold the spacing scale and layout spacings, corner roundness, and the one shadow for floating things like dialogs.
- **`ThemeProvider.js`** makes the theme available everywhere. A screen reads it with `const { colors, spacing } = useTheme();`. There's only one theme (dark), but because screens ask for it this way, a light theme could be added later without editing them.

The fonts are files in `assets/fonts/`. For Android they're also copied by hand into `android/app/src/main/assets/fonts/`, which is where Android loads them from (a rebuild with `npm run android` is needed after adding fonts).

The status bar always shows white icons on the dark background, whatever the phone's light or dark setting. Android's own window behind the app is dark too, so no white flash shows while the app starts. That colour is set on the Android side (`android/app/src/main/res/values/colors.xml`), because native files can't read the JavaScript tokens, so it has to be kept the same as `bg` by hand. React Navigation also gets a theme built from the tokens, so its screen background and headers are dark instead of white.

**Today the existing screens still use their old, hand-written light styles.** They're restyled one at a time later. The only change made to screens for the theme: the two registration screens had no background of their own and used to show React Navigation's light grey, so that grey is now set on them directly until registration is rebuilt.

### Shared components

Screens are built from ready-made pieces in `src/components/ui/`, so each piece looks the same everywhere and is styled in one place. A screen imports them from one place: `import { Screen, Text, Button } from '../../components/ui';`.

- **Layout and text:** `Screen` (the dark background, side padding, room for the status bar, optional scrolling), `Text` (every piece of text, with a style name such as `body` or `display`), `ScreenHeader`, `SectionHeader`, `Divider`, `TabBar` (the bottom tab bar).
- **Actions:** `Button` (main, secondary or danger; with a `loading` state that shows a spinner and ignores taps while a request runs), `IconButton` (approve, reject or plain), `TextLink`, `BackLink`.
- **Content:** `Card`, `ListRow`, `Avatar` (initials in a circle), `Pill`, `Badge`, `NoticeLine` ("● 2 join requests waiting for you"), `EmptyState`, `Icon`.
- **Forms and questions:** `TextField` (label, error message, password show/hide), `Checkbox` (a tick box with its sentence, for the Terms at sign-up), `OptionGroup` (pick one of a few choices, like the position), `SuggestionField` (a text field that suggests common values as you type, like areas; any other text is still allowed), `ConfirmDialog` ("Delete this team?" with Cancel and Confirm).

They take their colours, fonts and sizes only from the theme. A test reads every file in the folder and fails if one contains a colour code or a font name, so that rule can't slip.

**UI gallery (development only).** In a development build, the Login screen has a small "UI gallery" link that opens a screen showing every component in its states, plus two small copies of the design mockups built from the components. Release builds don't have the link, the screen, or even its code: the screen is only loaded inside a development-only check, which a release build removes before packaging.

Existing screens still use their old hand-written styles until each is restyled.

### Icons

Icons come from **Lucide**, a free set of line icons, drawn on screen by **react-native-svg** (a library that draws vector shapes). Screens never use Lucide directly. They use our own `Icon` component with our own names, for example `<Icon name="teams" />`, and `src/components/ui/Icon.js` is the one file that knows which Lucide icon each name means. If the icon set ever changes, only that file changes. The list of names is in [DESIGN.md](DESIGN.md) section 7.

An icon takes the text colour by default. When an icon means something on its own (an icon-only button), it gets an `accessibilityLabel` so screen readers can announce it; otherwise screen readers skip it. Existing screens still use the old icon library (Ionicons) until each one is restyled.

### How navigation switches by role

A **navigator** is the part of the app that decides which screen is showing and lets you move between screens. The app uses React Navigation and two kinds of navigator:

- A **stack navigator** works like a pile of cards: opening a screen puts it on top, and going back removes it.
- A **tab navigator** shows a bar at the bottom with icons you tap to switch screens.

The login state lives in a **context** (`AuthContext.js`). A React context is a value that any screen can read without passing it around by hand. It holds the current `user`, plus `login`, `logout` and `register` functions.

`src/navigation/AppNavigator.js` reads `user` from the context and picks a whole set of screens:

```
no user logged in  → AuthStack        (Login, role choice, Player/Owner sign-up, Check your email, Forgot password)
user.role PLAYER   → PlayerNavigator  tabs: My Teams · Explore · Notifications · Profile
user.role OWNER    → OwnerNavigator   tabs: My Venue · Explore · Notifications · Profile
user.role ADMIN    → AdminNavigator   tabs: Dashboard · Reports · Venues · Users · Teams
```

Each logged-in role gets a **bottom tab bar** (our own `TabBar` component), and **each tab has its own stack**. So when you open a team from My Teams, Team detail is put on top of the My Teams stack and the tab bar stays visible. Each tab remembers where you were: switching to Explore and back keeps you on Team detail. Tapping the tab you're already on takes you back to that tab's first screen.

What each tab holds today:
- **Player:** My Teams (your teams → team detail → invite players, transfer captaincy, edit team, request to join; create team), Explore, Notifications (for now the Invites screen, which opens Team detail), Profile (your details, with a gear that opens Settings and an Edit profile button; Settings has Edit profile, Change password, the Terms of Use and Privacy Policy pages, and Log out).
- **Venue owner:** My Venue (the venue listing, with Edit venue to change it), Explore (read-only for owners), Notifications (for now just "No notifications yet."), Profile (for now the Settings screen).
- **Admin:** Dashboard, Reports (for now just "Reports arrive with moderation."), Venues, Users and Teams (the old management screens).
- **Explore** (players and owners) is for now a simple screen with three rows, Teams, Players and Venues, opening the old lists. Tapping a team in the Teams list opens Team detail.

The team screens (Team detail, Request to join, Transfer captaincy, Edit team and Invite players) are registered as one group, `teamScreens` in `src/navigation/teamScreens.js`, in every stack that can open a team: the player's My Teams and Explore stacks, and the venue owner's Explore stack, which gets Team detail only. A screen can only open screens in its own stack, which is why each stack needs its own copy.

These "for now" screens are placeholders; the Step 3 features replace them (see PRODUCT.md, "App structure and navigation"). The old screens keep their old look and headers until they're restyled, so the app looks mixed for a while.

**Android back button:** inside a tab it goes back one screen in that tab. On the first screen of any other tab, it goes to the first tab. On the first tab's first screen, it leaves the app.

Because the screen set swaps as soon as `user` changes, logging in or out instantly moves you to the right part of the app.

### How the app talks to the backend

All requests go through `src/api/api.js`. It's a shared **axios** client (axios is a library for making web requests) with:

- the backend address. This is a hardcoded ngrok URL. The `process.env.API_URL` it checks first is never set in a React Native build.
- a **request interceptor** that adds `Authorization: Bearer <token>` to every request when a token is saved.
- a **response interceptor** that spots an expired or invalid login: when a request that carried the token gets a 401 reply, it calls the handler `AuthContext` registered (`setSessionExpiredHandler`). A 403 never counts (it means "not allowed", not "logged out"), and neither does the login request itself.

### How the login token is stored

`src/utils/storage.js` saves the token in **AsyncStorage**, the phone's simple built-in key-value storage for the app, under the key `jwt`. Logging in saves it, and logging out removes it.

The user's details (name, role) are kept in memory, and the token stays saved until you log out, so closing the app doesn't log you out.

### App start: restoring the login

1. `AuthContext` looks for a saved token. With none, the login screen shows.
2. With a token, `AppNavigator` shows a plain loading view (not the login screen) while the app calls `GET /auth/me` (15-second limit).
3. If that works, the reply becomes `user`, and the app opens on the right screens for the role.
4. If it replies 401, the token is no good: it's removed and the login screen shows (with the "session expired" message below).
5. Any other failure (no connection, the ngrok tunnel down, a server error, the time limit) keeps the token and shows **"Can't reach the server"** with a **Retry** button, which runs the check again. Being offline never logs you out by itself, but a small **Log out** link under Retry removes the saved token and shows the login screen (no server call needed).

The loading and "Can't reach the server" views are in `src/screens/Auth/StartupScreen.js`. They paint the theme's dark background and light text themselves, because they show before the navigator (straight on the Android window). They still use React Native's built-in spinner and button.

### Expired or invalid login while using the app

When any request that carried the token gets a 401 (for example the token's 30 days are up, or the password was reset on another phone, which logs out every phone), the response interceptor in `api.js` tells `AuthContext`, but only if that request carried the token saved right now. (Right after a password change, the app saves a fresh token; a request that was sent with the old one a moment earlier gets a 401 too, and must not log out the phone that changed the password.) It removes the saved token, clears `user` (so the app swaps to the login screen) and shows an alert: "Your session has expired. Please log in again." If several requests fail at once, the alert shows only once. **Log out** in Settings or on the admin dashboard also removes the saved token.

---

## 7. Key flows

### Registration and email verification

1. On the Login screen, the user taps **Create an account**, picks **I'm a player** or **I run a venue**, and fills in the short form (`PlayerRegisterScreen.js` or `OwnerRegisterScreen.js`): for a player, name, email, phone, position (picked from five buttons), password twice and the Terms box; for a venue owner, venue name, email, password twice and the Terms box. The two links under the box open the Terms of Use and Privacy Policy pages in the phone's browser.
   Before sending, the screen checks every field with the backend's own rules and messages (`signUpCommon.js`) and shows each problem under its field: for example "Passwords don't match", or the password rule, whose helper lists exactly which symbols count. The phone number is tidied first (`src/utils/phone.js`): spaces and dashes are removed, and so is a leading +88 or 88 before "01", so "+880 1712-345678" is sent as "01712345678". The Create account button stays tappable when the Terms box is unticked and then shows the error under the box. If a field near the top has a problem while you're at the bottom, the form scrolls up to it. It spins while the request runs, and a second tap does nothing.
2. The app sends `POST /auth/register` with email, password, role, the short profile details and `acceptedTerms`, which is the Terms box's own value: the app never fills it in.
3. Before the controller runs, `registerSchema` (`src/validation/authSchemas.js`) checks the request (see "How requests are checked"). Every field must be the right type, and the checks run in this order, so a request with several problems gets the first one's message:
   - email, password, role and profile details are all there ("Email, password, role, and profileData are required")
   - the role is PLAYER or OWNER
   - the email is lowercased and trimmed (`normalizeEmail` in `src/utils/email.js`, so `Test@Example.com ` and `test@example.com` are the same account; login, forgot password, resend verification and the admin script do the same), looks like an email address, and is at most 254 characters
   - the password passes the strength rule (at least 8 characters with upper case, lower case, a number and a symbol) and is at most 72 bytes
   - the profile (the short sign-up forms): for a player, a name of 2–50 characters, a Bangladeshi mobile number (01, then a digit from 3 to 9, then 8 more digits, like 01712345678) and a position from the list (Goalkeeper, Defender, Midfielder, Forward, Any, spelled exactly like that). For a venue owner, only a venue name of 2–60 characters. Names are trimmed. Anything else the app sends (an old form's height or address, say) is ignored.
   - last, the Terms box: `acceptedTerms` must be exactly `true` ("Please accept the Terms of Use and Privacy Policy").

   Then the controller checks that the email is new ("Email already registered").
4. It saves the User and their profile in a single step, with `verified` set to false and `termsAcceptedAt` set to now. It also saves the hash of a new random verification token and an expiry 24 hours away.
5. It emails a link containing the token itself to `BACKEND_PUBLIC_URL/auth/verify?token=…` through Gmail. If sending fails, the account still exists, so the reply is still a success (201). It says "Account created, but we couldn't send the verification email. Use 'Resend verification email' on the login screen." The error is logged on the server.
   In the app, a success replaces the form with **Check your email** (`CheckEmailScreen.js`): "We've sent a link to … The link works for 24 hours.", or, when the reply says sending failed, "Your account is ready, but we couldn't send the email. Tap Resend to try again." Its **Resend email** button sends a new link (the reply shows under it), and **Back to log in** returns to Login. The form isn't kept underneath, so Back also goes to Login.
6. Clicking the link opens the backend in a browser. If the token isn't shaped like one the backend makes (64 lowercase hex characters), it shows an "Invalid or expired link" page without touching the database. It shows the same page if no user has that token's hash, or if the link is more than 24 hours old, with a hint to request a new email from the app's login screen. Otherwise it marks the user verified, clears the token and its expiry, and shows an "Email verified" page telling them they can now log in in the app.

### Editing a player profile

A player sees their own details on the **Profile** tab (`PlayerProfileScreen.js`): name, position, area, height, weight, phone and email. Anything not filled in yet says "Not added", and the phone and email say who can see them ("Only your teammates can see this", "Only you can see this"). The screen reloads whenever it comes into view, and on pull to refresh. They change their details on **Edit profile** (`EditProfileScreen.js`), which sends `PATCH /players/me`. While typing an area, common areas are suggested under the field ("pur" suggests Mirpur and Mohammadpur, among others); any other text is allowed. The phone is tidied like at sign-up (+88, spaces and dashes removed), a comma in the height or weight counts as a decimal point, and every field is checked before sending, with the problem under it. After saving, the app's own copy of the user's name is updated too, so the new name shows everywhere.

1. The app sends every field each time: name, phone, position, height, weight and area. An optional field that's left out, empty or null is cleared.
2. Only player accounts may do this: anyone else gets 403 "Players only", checked before the fields are.
3. `updatePlayerProfileSchema` (`src/validation/playerSchemas.js`) checks the fields with the same rules as sign-up (`src/validation/profileFields.js`): a name of 2–50 characters, a Bangladeshi mobile number, a position from the list, height 100–250 cm and weight 30–200 kg (numbers, optional), and an area. The area is tidied first (spaces at both ends removed, and every run of spaces inside made one space) and must then be 2–40 characters; the letters stay as typed.
4. The profile is updated in one step, and the reply is the player's own profile, the same as `GET /players/me`. The new name shows straight away in `GET /auth/me` and in team lists. The email can't be changed here (not in v1.0).

### Editing a venue listing

A venue owner fills in or changes their listing with `PATCH /owners/me` (the Edit venue screen arrives with task F2.4). A new owner signs up with only the venue name, so this is where the rest of the listing comes from.

1. The app sends every field each time: venue name, phone, address, website and description. Only the venue name is required; an optional field that's left out, empty, only spaces or null is cleared.
2. Only venue owner accounts may do this: anyone else gets 403 "Owners only", checked before the fields are.
3. `updateVenueSchema` (`src/validation/ownerSchemas.js`) checks the fields: a venue name of 2–60 characters; a phone, if given, that's a Bangladeshi mobile number (no landlines in v1.0); an address of at most 200 characters; a website of at most 200 characters that is a real `http://` or `https://` link (`isWebLink` in `src/utils/links.js`: so "www.arena.com", "http:arena.com" or "javascript:…" are refused; the app checks with the very same rule); and a description of at most 500. Spaces at both ends of each text are removed.
4. The listing is updated in one step, and the reply is the owner's own profile, the same as `GET /owners/me`. The venue lists show the new details straight away.

### Resending the verification email

1. If someone logs in with the right password before verifying, login replies "Please verify your email" (403). `LoginScreen.js` then shows a notice ("Your email isn't verified yet. Check your inbox for the link.") and a **Resend verification email** button, which spins while the request runs. Changing the email hides them again.
2. The button calls `resendVerification()` in `AuthContext`, which sends `POST /auth/resend-verification` with the email. A missing, non-text or blank email is refused; otherwise it's lowercased and trimmed before the lookup.
3. If that account exists and isn't verified, the backend makes a new token (only its hash is saved, valid for 24 hours, replacing the old link) and emails a new link. It doesn't do this if it already sent one in the last 5 minutes.
4. The reply is always the same ("If that account needs verifying, we've sent a new email."), whether or not the account exists or is already verified, so it gives nothing away. The app shows that reply.

Known problems in this flow: see [ROADMAP.md](ROADMAP.md), Phases 1 and 2.

### Login

1. `LoginScreen.js` checks that both fields are filled in ("Email is required", "Password is required" under the fields), then calls `login()` from `AuthContext`, which sends `POST /auth/login`. The Log in button spins while it runs, and a second tap does nothing.
2. The backend refuses a missing or non-text email or password, and a blank email. The email is lowercased and trimmed before the lookup, so capitals or stray spaces don't matter. An unknown email and a wrong password get exactly the same reply ("Invalid email or password"), so nobody can use the login screen to find out who has an account. Only after the password is confirmed correct does an unverified account get told to verify its email first. Otherwise it replies with a JWT and the user's details (see [section 4](#how-login-works)).
3. `AuthContext` saves the token and sets `user`. `AppNavigator` then switches to that role's screens.

### Password reset

1. The user taps **Forgot password?** on the Login screen and enters their email on **Forgot password** (or, when logged in, taps **Forgot your current password?** on Change password, which sends the link to the account's own email; venue owners still have the old Settings screen's **Change Password** button until task F2.4). The app sends `POST /auth/forgot`. The rebuilt Forgot password screen then replaces its form with "If that email has an account, we've sent a reset link. It works for 1 hour." and a **Back to log in** button, instead of an alert.
2. A missing, non-text or blank email is refused; otherwise it's lowercased and trimmed. If the email exists, the backend saves the hash of a new random reset token, which expires in 1 hour, and emails a link containing the token to `BACKEND_PUBLIC_URL/auth/reset-password-page?token=…`. If it already sent a reset email to that account in the last 5 minutes, it sends nothing new. The reply is the same in every case, whether or not the email exists.
3. The link opens a small web form served by the backend. It only shows the form if the token looks like one the backend makes (64 lowercase hex characters); anything else gets an "Invalid or expired link" page. The form submits the new password to `POST /auth/reset`.
4. The backend refuses a token that isn't plain text, and a new password that fails the same strength rule as registration. Otherwise it hashes the token, finds the user with that hash and an unexpired link, saves the new password hash, clears the token and its expiry, and marks the account verified. The reset proves the email works, so it also clears any leftover verification link.
5. Because the form is used in a browser, the replies are simple web pages, not raw JSON: "Password changed" on success; for a weak password, the rule plus a "Try again" link back to the form; for a bad or expired link, a message to request a new reset from the app. Requests sent as JSON still get JSON replies.

Known security problems in this flow: see [ROADMAP.md](ROADMAP.md), Phase 1.

### Changing the password while logged in

`POST /auth/change-password`, from **Settings → Change password** (`ChangePasswordScreen.js`; venue owners get it with task F2.4). Any logged-in account can use it. The screen asks for the current password, the new one (with the same rule as sign-up shown under it) and the new one again, and checks them before sending.

1. The app sends the current password and the new one.
2. `changePasswordSchema` checks that both are there, that the new one follows the same strength rule as sign-up (and is at most 72 bytes), and that it isn't the same as the current one.
3. The controller compares the current password with the stored hash. If it's wrong, the reply is 400 "Current password is incorrect". It's deliberately not 401: the app treats a 401 as "your session has expired" and logs out, and a typo shouldn't do that. Wrong attempts are rate-limited (see "Protection against abuse and leaks").
4. In one database update, it saves the new password's hash, raises the token version by one (so every other phone is logged out) and cancels any password reset link that was still waiting. The update only applies if the stored password hasn't changed since step 3, so two changes at the same moment can't both succeed.
5. The reply is `{ "message": "Password changed", "token": "…" }`: a fresh login token with the new version number. `changePassword()` in `AuthContext` saves it before anything else, so this phone stays logged in; any other phone gets a 401 on its next request and shows "Your session has expired". The app then shows one alert, "Password changed: You're still logged in on this phone. Any other phones have been logged out.", and goes back to Settings. A wrong current password shows under that field instead, and never logs anyone out.
6. Then, without making the reply wait, the backend emails the account a short notice: the password was changed, and if it wasn't you, use Forgot password on the login screen. The email has no link in it (links in "your account changed" emails are what phishing copies). If sending fails, it's logged; the password is already changed.

### Team invites

1. A captain opens their team and taps **Invite players** (`InvitePlayersScreen.js`). It loads the team (`GET /teams/:teamId`) and every player (`GET /players`), and lists everyone except the captain, the members, players already invited and players who have asked to join (they're approved from Team detail's Join requests card). A search box filters the list by name on the phone. Tapping **Invite** keeps the screen open and turns that row's button into a disabled "Invited". When the team is full, the screen says "Team is full (15/15)" and every Invite button is disabled.
2. The app sends `POST /teams/:teamId/invite`. The backend checks that the sender is a player account, that the player id is a positive whole number, that the sender is the team's captain (`Team.captainId`), that the team isn't full (409 "Team is full (15/15)."), that the invited person exists and is a player (otherwise 404 "Player not found"), and that they aren't already invited or in the team (400). It then adds a `TeamMember` row with status `pending` and origin `invite`. **If the player has already asked to join, the invite approves their request instead** (both sides agreed): the row becomes `accepted`, its message is cleared, and the reply is 200 `{ message: 'Request approved', joined: true }`.
3. The invited player sees it on the Notifications tab's **Invites** screen (`InvitesScreen.js`, which calls `GET /players/invites` whenever it comes into view and on pull to refresh): a card with the team name, "<captain name> invited you · 11 / 15 members", and **Accept** and **Decline** buttons. Accept is disabled and reads "Team is full (15/15)" when the team is full. Tapping the card opens Team detail, so the player can see who's in the team first. With no invites it says "No invites right now." The reply gives each invite's `team.captain` as `{ id, name }`, alongside `team.captainId`: the captain's player name, through the visibility rules (never their email).
4. **Accept** (`POST /teams/:teamId/accept`) changes the status to `accepted` and records the time in `acceptedAt`, unless the team is full (409 "Team is full (15/15)."; the invite stays pending). **Reject** (`POST /teams/:teamId/reject`) deletes the row. Both only work on a pending invite (never on the player's own join request), and like every membership change they run under the team lock (see "Join requests" below). If there's no pending invite for that player and team, they reply 404 "Invite not found".

The captain can **cancel an invite** (`DELETE /teams/:teamId/invites/:userId`; 404 "Invite not found" if it's already gone), **remove a member** (`DELETE /teams/:teamId/members/:userId`, accepted members only, so it can't delete an invite or a join request by mistake) or delete the whole team (`DELETE /teams/:teamId`). On Team detail the captain does these with the X next to an invite, the remove button on a member's row, and **Delete team**, each after a confirmation.

A pending invite isn't membership yet. In the team lists (`GET /teams` and `GET /teams/me`) each team's `members` holds only accepted members. The team's captain also gets a separate `pendingInvites` list, so they can see who they've invited; nobody else gets it. **My Teams** (`MyTeamsScreen.js`) shows each team as a card like the mockup: its name, "11 / 15 members", a Captain or Player pill and the description; a captain with join requests waiting also sees "2 join requests waiting for you". Below the teams, a **Requests sent** card lists the player's own join requests (from `GET /players/requests`), each with its message and a **Cancel** button. With no teams and no requests it says "You're not in a team yet.", with **Create team** and a **Find a team** link to Explore → Teams. It reloads whenever it comes into view and when you pull down, so a team deleted in Team detail disappears straight away. **All Teams** shows each team's captain by name: the captain is always one of the team's accepted members, so the app takes the name from the `members` list the backend already sends. The app calls the team's captain **Captain** everywhere (badges, labels, messages). A player's team count (`GET /players/:id`, `totalTeams`) and the admin's member counts also include only accepted memberships. `pendingInvites` holds invites only, never join requests.

### One team (the team page)

`GET /teams/:teamId` returns one team to any logged-in user (venue owners and the admin too). It's what the Team detail screen loads (feature 1, [features/team-membership.md](features/team-membership.md)).

- **`viewerState`** says where the viewer stands: `captain`, `member` (accepted), `invited` (a pending invite), `requested` (a pending join request) or `none`. Venue owners and the admin are always `none`, because they can't join teams. The app uses it to pick the buttons to show.
- **`memberCount`** (accepted members) and **`maxMembers`** (15, `MAX_TEAM_MEMBERS` in `src/utils/membership.js`), so the app never hard-codes the limit.
- **`members`**: accepted members only, the captain first, then the longest-standing (earliest `acceptedAt`, ties to the lower row id). Each person goes through the visibility rules, so other people's email, phone and address are left out; their name and position are included.
- **`joinRequests`** (oldest first, each with its `message`) and **`pendingInvites`** (newest first): only for the captain and the admin. Nobody else gets these fields.
- **`myRequest`** (`{ createdAt, message }`): only for the player whose join request is pending, so they can see what they sent.
- 400 "Invalid team id", 404 "Team not found".

The shaping is done by `toTeamDetail` in `teamController.js`; the team lists use `toTeamListItem`. **My Teams** (`GET /teams/me`) also gives each team `memberCount` and `maxMembers`, and the captain gets `joinRequestCount` (the number of join requests waiting). `GET /players/requests` lists the player's own pending join requests (newest first, with their message and the team's member count); only player accounts may call it. `GET /players/invites` lists invites only (never the player's own requests), and each team carries `memberCount` and `maxMembers`. `GET /players` gives each player their public position in `playerProfile`.

**The join request message** is private: only the team's captain, the player who sent it and the admin ever get it in a reply. Every other reply leaves it out (`MEMBERSHIP_FIELDS_NOT_IN_REPLIES`).

### Leaving, captaincy and editing

All three are for player accounts only and run under the team lock (feature 1, [features/team-membership.md](features/team-membership.md)). The new screens for them come in the next app tasks.

- **Leave** (`POST /teams/:teamId/leave`): a member's row is deleted (200 "You left the team."). The captain can't leave while other members exist (409 "Transfer captaincy before leaving the team."). A captain who is the only member deletes the team by leaving, together with its pending invites and requests (200, `teamDeleted: true`). Anyone who isn't an accepted member gets 404 "You're not a member of this team."
- **Transfer captaincy** (`POST /teams/:teamId/transfer` with `{ userId }`): only the captain, and only to an accepted member of the team (404 "Player not found in this team." otherwise; 400 "You're already the captain." for yourself). It's a single update of `Team.captainId`, the only place the captain is stored, so there's never a moment with two captains or none. The old captain stays in the team as a player. Because of the team lock, a transfer and the new captain leaving at the same moment run one after the other, so the captain is always a member.
- **Edit team** (`PATCH /teams/:teamId` with `{ name, description }`): only the captain. The same checks and messages as creating a team; the app sends both fields every time, and a missing description is removed. The reply is the updated team, in the same shape as `GET /teams/:teamId`.

### The Team detail screen

`TeamDetailScreen.js` (feature 1, [features/team-membership.md](features/team-membership.md)) shows one team as the viewer sees it. It's opened with `{ teamId }` from **My Teams** and from **Explore → Teams**, and loads `GET /teams/:teamId` every time it comes into view. The backend's `viewerState` decides what's shown:

- **Captain:** "Captain" and "x / 15 members" pills, **Invite players** (disabled and reading "Team is full (15/15)" when full) and **Transfer captaincy** (hidden when the captain is alone), the join requests with their messages and decline (X) and approve buttons, the pending invites (each with an X to cancel), the members (each with a remove button), then **Leave team** and **Delete team**.
- **Member:** a "Player" pill, the members and **Leave team**.
- **Invited:** "{captain} invited you to this team", **Accept invite** (disabled when full) and **Decline**.
- **Request sent:** a "Your request" card with the message and **Cancel request**.
- **Any other player:** **Request to join** (disabled when full), which opens the Request to join screen (an optional message, at most 150 characters).
- **Venue owner:** the same team, read-only, with no buttons.

Destructive or important actions ask first, in a dialog with the spec's exact wording (for example "Remove Tanvir Ahmed from Dhanmondi Strikers?"). A captain with other members who taps **Leave team** is told to transfer captaincy first, and the dialog's button opens Transfer captaincy; a captain alone gets "Leave and delete …?". After leaving or deleting, the screen goes back. Every button that sends a request shows a spinner while it runs. After an action the team reloads. If the backend replies 404 (gone) or 409 (the team changed, for example it filled up), an alert says "Something changed" with the backend's message, and the screen reloads. If the team itself is gone, the screen says "This team no longer exists." and goes back. The shared pieces (loading a team, these alerts, the message limit) live in `src/screens/Team/teamCommon.js`.

**Transfer captaincy** (`TransferCaptaincyScreen.js`) lists the members except the captain; picking one asks "Make {name} captain?" and sends `POST /teams/:teamId/transfer`. **Edit team** (captains, above Leave and Delete) opens the same form as Create team, filled in with the current name and description; saving sends `PATCH /teams/:teamId` and goes back to Team detail, which reloads. **Invite players** opens the screen described under "Team invites" above.

### Join requests

A player can ask to join a team; the captain approves or declines (feature 1, [features/team-membership.md](features/team-membership.md)). Team detail's **Request to join** opens the screen that sends it; the captain approves on Team detail. Every one of these actions is for player accounts only (venue owners and the admin get 403).

1. **Ask:** `POST /teams/:teamId/requests` with an optional `message` to the captain (text, spaces at both ends removed, at most 150 characters counted like team names; blank means no message). It adds a `TeamMember` row with status `pending`, origin `request` and the message, and replies 201. It's refused with 409 if the player is already in the team ("You're already in this team."), has already asked ("You've already asked to join this team.") or the team is full ("Team is full (15/15)."). **If the captain has already invited the player, asking accepts the invite instead** (both sides agreed): 200 `{ message: 'Joined team successfully', joined: true }`.
2. **Cancel:** the player deletes their own request with `DELETE /teams/:teamId/requests/me` (404 "Join request not found" if there's none).
3. **Approve:** the captain calls `POST /teams/:teamId/requests/:userId/approve`. The row becomes `accepted`, `acceptedAt` is set and the message is cleared. A full team gets 409 "Team is full (15/15)." and the request stays pending.
4. **Decline:** `POST /teams/:teamId/requests/:userId/reject` deletes the row, message included. The player can ask again later.

Only the captain may approve or decline (403 "Only the team captain can approve or reject join requests."). A request that's gone (cancelled, already handled) gets 404 "Join request not found", so a screen showing old data finds out and can reload.

**Players can't approve their own requests.** The old `POST /teams/:teamId/join` endpoint was removed in Phase 1 because a join request looked exactly like an invite, so a player could "accept" their own request. Now every row records its origin, and the invite routes (accept, reject, `GET /players/invites`) only ever look at `origin: invite` rows.

**Two at once can't break the 15-member limit.** Every action that changes a team's members runs in one database transaction whose first step locks the team's row (`lockTeam` in `src/utils/membership.js`, a `SELECT … FOR UPDATE`). If two approvals arrive at the same moment, the second waits until the first has finished, then counts 15 members and is refused. The lock is released when the transaction ends.

---

## 8. Configuration

The backend reads its settings from **environment variables**: named values set outside the code, so secrets aren't written into the source. They go in a file called `backend/.env`, which git ignores. `backend/.env.example` lists every variable with a comment and a fake value: copy it to `.env` and fill it in.

| Variable | What it's for | Rule checked at startup |
|---|---|---|
| `DATABASE_URL` | Where the PostgreSQL database is and how to log in to it (used by Prisma) | Required, starts with `postgresql://` or `postgres://` |
| `JWT_SECRET` | The secret used to sign and check login tokens | Required, at least 32 characters, and not the placeholder from `.env.example` |
| `EMAIL_USER` | The Gmail address the backend sends email from | Required, contains "@" |
| `EMAIL_PASS` | The password for that Gmail account | Required |
| `BACKEND_PUBLIC_URL` | The backend's public address (the ngrok URL), used to build links in emails | Required, an `http://` or `https://` address (a slash at the end is removed) |
| `PORT` | Optional. The port the server listens on | A whole number from 1 to 65535, 4000 if not set |
| `ADMIN_EMAIL` | Only used by `scripts/createAdmin.js`: the admin account's email | Not checked by the server |
| `ADMIN_PASSWORD` | Only used by `scripts/createAdmin.js`: the admin account's password | Not checked by the server |
| `TEST_BASE_URL` | Optional, tests only: the server the tests talk to | Not checked by the server |

**The server checks its settings when it starts ("fail fast").** The very first thing `server.js` loads is `src/config.js`. It loads `backend/.env` (with the `dotenv` library) and checks every setting against the rules above. Spaces at the start and end of a value are removed first, and a blank value counts as missing. `config.js` finds `backend/.env` from its own location, so it works whichever folder the server is started from. If there's no `.env` file at all, that's fine as long as the settings come from somewhere else: real hosting usually supplies them directly, and settings supplied that way win over the file. If anything is wrong, the server refuses to start and prints one clear message listing every problem, for example:

```
Server can't start: these settings in backend/.env are missing or invalid:
  - JWT_SECRET: must be at least 32 characters
  - EMAIL_USER: missing
See backend/.env.example.
```

It names the setting and the reason but never prints the value, because several settings are secrets. Without this check, a missing setting would only show up later, for example as a crash the first time an email is sent. The rules themselves live in `src/config/loadConfig.js`, a function that only checks values and returns the result, so `tests/config.test.js` can test it without starting the server. `tests/config-env-file.test.js` checks where `.env` is found. The rest of the backend reads settings from the checked `config` object, never straight from the environment.

It has to be the first import because of how modern JavaScript modules load: every `import` runs before the code below it, and some files read settings while they load (the email sender in `authController.js` is set up immediately). Before this check existed, the settings were actually loaded by accident: Prisma 6 reads `.env` by itself when it's imported.

The admin account comes from `node scripts/createAdmin.js`, run in `backend/`. It reads `ADMIN_EMAIL` (lowercased and trimmed, like every email) and `ADMIN_PASSWORD`, refuses to run if either is missing or the password fails the registration strength rule, and never prints the password. If an admin with that email exists, it changes that account's password, which is how you change the admin password. Otherwise it creates the admin. It won't turn an existing player or owner account into an admin, and it won't create a second admin, because the app has one admin account.

The mobile app has no config file. Its backend address lives in `IndoorFootballApp/src/api/api.js`.

---

## 9. Where to find things

| If you want to change… | Look in… |
|---|---|
| Which backend address the app uses | `IndoorFootballApp/src/api/api.js` |
| A screen's look or behaviour | `IndoorFootballApp/src/screens/<Area>/<Name>Screen.js` |
| Which screens a role can reach | `IndoorFootballApp/src/navigation/<Role>Navigator.js` (Player, Owner, Admin; shared tab settings in `tabs.js`, the shared Explore tab in `ExploreStack.js`, the team screens in `teamScreens.js`), or `AuthStack.js` when logged out |
| What happens on login or logout in the app | `IndoorFootballApp/src/contexts/AuthContext.js` |
| How the token is saved on the phone | `IndoorFootballApp/src/utils/storage.js` |
| A backend address (URL path) | `backend/src/routes/<area>Routes.js` |
| What a backend action actually does | `backend/src/controllers/<area>Controller.js` |
| The login check, admin check or player-only check | `backend/src/middleware/auth.js` |
| The rate limits (how many tries, how long) | `backend/src/middleware/rateLimits.js` |
| What clients see when something goes wrong | `backend/src/middleware/errorHandler.js` |
| Security headers (helmet) or the trust proxy setting | `backend/src/server.js` |
| Registration rules (required fields, lengths, phone, position, Terms) | `backend/src/validation/authSchemas.js` (`registerSchema`) and the shared profile fields in `backend/src/validation/profileFields.js`, plus the register screens |
| The password strength rule (registration, reset and the admin script) | `backend/src/utils/password.js` |
| How emails are lowercased and trimmed | `backend/src/utils/email.js` |
| What deleting a user or a team removes | `backend/src/utils/deletion.js` |
| Team name and description rules | `backend/src/validation/teamSchemas.js` (`createTeamSchema`) |
| How a request is checked before its controller runs | `backend/src/middleware/validate.js` |
| Who may see which user fields | `backend/src/utils/visibility.js` |
| The text of the verification or reset emails | `backend/src/utils/emailTemplates.js` |
| How emails are sent (Gmail, the sender, which addresses are skipped) | `backend/src/utils/mailer.js` |
| The Terms of Use and Privacy Policy text | `backend/src/routes/legalRoutes.js` (the page layout is `legalPage` in `backend/src/utils/pages.js`) |
| The database tables | `backend/prisma/schema.prisma`, then create a migration |
| Environment variables | `backend/.env` (never commit it) |
| The rules a setting must follow at startup | `backend/src/config/loadConfig.js` |

## 10. Technical reference

The detailed reference for whoever changes the code (Claude Code included). It moved here from CLAUDE.md on 2026-11-22, word for word, so CLAUDE.md can stay short; sections 1–9 explain the same system in plain English. When the code changes, update both the plain-English sections and this one.

### 10.1 Repository housekeeping

**Line endings:** the root `.gitattributes` stores and checks out text files with LF (overriding `core.autocrlf`), keeps `*.bat`/`*.cmd` CRLF, keeps `gradlew` and `*.sh` LF, and marks images, fonts, jars and keystores binary. Prettier 2.x expects LF. The root `.gitignore` ignores `node_modules/`, `.env` and `.env.*` (except `.env.example`), and database dumps (`backup/`, `*.backup`, `*.dump`, `*.bak`, `*.sql.gz`, `*.sql.zip`) in every folder. Plain `*.sql` is deliberately not ignored, so `backend/prisma/migrations/**/migration.sql` stays tracked. Never commit a database dump; `backup/app_db.backup` was untracked on 2026-11-20 but is still in git history until the Phase 0 purge.

### 10.2 Backend tooling, settings and tests

- **Install scripts (npm 11+):** npm only runs dependency install scripts that are approved in the `allowScripts` field of `backend/package.json`. Approved: `bcrypt` (builds its native code) and the Prisma packages (`prisma`, `@prisma/client`, `@prisma/engines`). While uninstalling packages, npm 11.16 may print a warning that these four aren't covered; `npm approve-scripts --allow-scripts-pending` is the reliable check. Approvals are pinned to exact versions, so after upgrading one of these, or adding a package with an install script, run `npm approve-scripts --allow-scripts-pending` to list what needs a decision. Don't approve anything without asking. The mobile app currently has nothing pending.
- **createAdmin.js** lowercases and trims `ADMIN_EMAIL` (`normalizeEmail`). It refuses to run if `ADMIN_EMAIL` or `ADMIN_PASSWORD` is missing or the password is weak, and never prints the password. It updates an existing admin with that email, and refuses to promote a non-admin account or to create a second admin.

Required `backend/.env` variables (see `backend/.env.example`): `DATABASE_URL` (must start with `postgresql://` or `postgres://`), `JWT_SECRET` (at least 32 characters, and not the placeholder from `.env.example`), `EMAIL_USER` (must contain "@"), `EMAIL_PASS` (Gmail SMTP via nodemailer), `BACKEND_PUBLIC_URL` (an `http://` or `https://` URL, used to build the email verify and reset links; a trailing slash is removed), and optionally `PORT` (1–65535, default 4000). Blank or whitespace-only counts as missing. The server checks all of these at startup and refuses to start (exit code 1) with one message listing every bad setting by name and reason, never its value. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only needed when running `scripts/createAdmin.js`, and `TEST_BASE_URL` only by the tests; none of the three is checked by the server.

**Settings (`src/config.js`, `src/config/loadConfig.js`):** `loadConfig(env)` is a pure function (no dotenv, no `process.exit`) that returns a frozen `{ port, jwtSecret, emailUser, emailPass, backendPublicUrl }` or throws a `ConfigError` whose `problems` list every bad setting. Values are trimmed (spaces at both ends removed) before they're checked and used. `JWT_SECRET` equal to `EXAMPLE_JWT_SECRET` (the `.env.example` placeholder; `tests/config.test.js` checks the two match) is refused. `config.js` loads `backend/.env` from a path based on its own location (`import.meta.url`), so the server finds it whichever folder it's started from; a missing `.env` file is not an error by itself (real hosting supplies settings directly), and settings already in the environment win over the file. It then calls `loadConfig` with `process.env`, and on a `ConfigError` prints the problems and exits with code 1 (no stack trace). `server.js` imports `config.js` first: ES module imports all run before the importing file's body, and `authController.js` builds its nodemailer transporter at import time. (Before this, `.env` was in fact loaded by importing `@prisma/client`, which Prisma 6 does by itself; later Prisma versions don't.) `config.js` is the only file in `src/` that reads `process.env`; everything else imports `config`. `DATABASE_URL` is checked but not in the config object, because Prisma reads it from the environment itself. Never print a setting's value, in errors, logs or tests.

- **Tests:** backend tests use Node's built-in test runner (`node:test`) and `fetch`, with no extra dependencies. They send real HTTP requests to the running local server and use Prisma directly to set up data. Each test creates its own throwaway user (`test-<uuid>@example.com`) and deletes it in `t.after()`. Shared setup lives in `tests/helpers.js`. `tests/config.test.js` and `tests/config-env-file.test.js` are the exceptions: they don't import `helpers.js` and need neither the server nor the database. `config.test.js` tests `loadConfig` directly. `config-env-file.test.js` imports `src/config.js` in child processes: from another folder (it needs the real `backend/.env`, and checks no value is printed), and from a throwaway copy in `tests/.tmp-config-*` with no `.env` next to it (deleted afterwards). Test files run one at a time (`--test-concurrency=1`) because they share the server and database. `src/utils/mailer.js` never sends mail to `@example.com` addresses (it logs a line instead), so test runs send no real email. `tests/mailer.test.js` runs the real verification and reset emails through nodemailer with a `streamTransport` (builds the message in memory, sends nothing) and made-up settings; it needs neither the server nor the database. Sending to a `.invalid` address fails at once (that domain can never receive mail), which tests use to make sending fail on purpose. Never change existing users in tests: that keeps each test independent of whatever else is in the database (it isn't about protecting the data; see "How to work with me"). Tokens put straight into the database must be stored as `sha256Hex(token)` (from `tests/helpers.js`), with the plain token sent in the request, like a real email link. Because the server trusts one proxy, `postJson`/`postForm`/`getWithIp` send a random made-up `X-Forwarded-For` address per request, so the suite never trips the rate limits; `tests/rate-limits.test.js` passes a fixed address to hit them. To test that a multi-step delete rolls back, `tests/admin-delete.test.js` passes `deleteUserAndData`/`deleteTeamAndMembers` a wrapped Prisma client that throws at one step inside the real transaction (`failAt`).

### 10.3 App tooling

- `npm run lint` runs ESLint with the `@react-native` config only; it doesn't check formatting. `npx prettier --check src App.js` is the Prettier 2.8.8 formatting check (`.prettierrc.js`), run separately.
- `npm test` is Jest with the react-native preset: `jest.setup.js` mocks AsyncStorage and react-native-safe-area-context with their packages' own mocks, `jest.config.js` `transformIgnorePatterns` adds `@react-navigation` and `react-native-*` packages, and `moduleNameMapper` sends `lucide-react-native/icons/*` to Lucide's CommonJS build.
- `npm run android` is the main target; iOS also needs `bundle install && bundle exec pod install` in `ios/`.
- The app talks to the backend through a hardcoded ngrok URL in `src/api/api.js` (React Native doesn't inject `process.env.API_URL`). Update it when the tunnel changes.

### 10.4 Backend (technical)

`src/server.js` mounts six routers: `/auth`, `/players`, `/owners`, `/teams`, `/admin`, `/legal`. Each route file in `src/routes/` maps to a controller with the same name in `src/controllers/`, except `legalRoutes.js`, which has no controller.
- **Terms and Privacy pages** (feature 2, spec D1 and P17): `GET /legal/terms` and `GET /legal/privacy` (`src/routes/legalRoutes.js`), no login and no rate limit, HTML built once at start-up by `legalPage({ title, note, sections })` in `src/utils/pages.js`. **Placeholder text** that says only what PRODUCT.md decides, with "This is a draft…" at the top; the real text is written in Phase 5. The sign-up forms and Settings link to them (tasks F2.2–F2.4).
- **Auth middleware** (`src/middleware/auth.js`): login (`authController.login`) signs (with `signLoginToken` in `src/utils/tokens.js`, shared with change password) an HS256 JWT with claims `{ id, userId, role, email, tv }`, valid for 30 days (`LOGIN_TOKEN_LIFETIME_SECONDS` in `src/utils/tokens.js`); `tv` is the account's `tokenVersion`. `verifyToken` (async) requires the header to be exactly `Bearer <token>` (Bearer case-insensitive, one space, no spaces in the token), verifies with `algorithms: ['HS256']`, then looks up the user by `id` and replies 401 "Invalid token" if the user is gone, the token has no integer `tv`, or `tv` isn't the current `tokenVersion` (a missing header is 401 "No token"). `req.user` (`{ id, userId, role, email }`) is built from the database row, never from the token's claims, so role and email changes apply at once. A database error is thrown and reaches the error handler (500), not a 401. `resetPassword` and `changePassword` increment `tokenVersion` in the same update as the new password, which logs the account out on every device; suspension must do the same when it's built (moderation feature). `isAdmin` guards every `/admin` route. `playersOnly` (403 for OWNER and ADMIN) guards every team action: create, invite, accept, reject, the join request routes, remove member, cancel invite, leave, transfer, edit and delete. Other role and captain checks happen inside the controllers (for example `team.captainId !== req.user.id`).
- **Errors:** controllers pass failures on with `next(err)` (Express 5 also forwards errors thrown in async handlers). `src/middleware/errorHandler.js`, mounted last in `server.js`, logs the error and replies only `{ "error": "Something went wrong" }` (500) or `{ "error": "Invalid request body" }` (400 for unreadable bodies). Never put `error.message`, stacks or Prisma details in a response.
- **Security middleware** (in `server.js`): `app.set('trust proxy', 1)` because the backend sits behind exactly one proxy (ngrok), so `req.ip` is the visitor's address; don't raise it. `helmet()` with its default content security policy (server-rendered pages must not use inline scripts or styles). Rate limits in `src/middleware/rateLimits.js`, replying 429, tuned for shared mobile IPs (DECISIONS.md 2026-11-19): login counts only failed attempts (`skipSuccessfulRequests`; `requestWasSuccessful` also treats the 403 "please verify" as success, since the password was right), 10/15 min per IP + email and 50/15 min per IP; register 20/hour per IP; forgot and resend-verification each 5/hour per IP + email and 20/hour per IP; reset POST 10/15 min per IP; reset page and verify link GETs 30/15 min per IP each (HTML replies); change password counts only failures (any reply of 400 or more), 10/15 min per account (`account:<user id>`, after `verifyToken`) and 50/15 min per IP. Keys always go through express-rate-limit's `ipKeyGenerator` (IPv6 grouped by /56); emails are lowercased and trimmed. Counters are in memory and reset on restart.
- **Prisma**: the server has one shared client, `prisma` from `src/db.js`, imported by every controller. Nothing else in `src/` may call `new PrismaClient()` (each client opens its own connection pool). `src/utils/deletion.js` and `visibility.js` take the client as a parameter. `scripts/createAdmin.js` and `tests/helpers.js` are separate programs with one client each. Delete rules (migration `20261120171221_membership_data`): `PlayerProfile` and `OwnerProfile` cascade with their `User`; `TeamMember` cascades with its `Team` and with its `User`; `Team.captain` is `Restrict`, so the database refuses to delete a user who still captains a team (Postgres code 23001, which Prisma passes on without a `P` code) until the team is handed over or deleted. Cascade is only a safety net: deletes still remove dependents explicitly, in order (`TeamMember` rows, then the user's captained teams and their members, then profiles, then the `User`), until the account deletion feature reworks this. All of it goes through `src/utils/deletion.js` (`deleteUserAndData(db, userId)`, `deleteTeamAndMembers(db, teamId)`), which runs every step in one interactive `$transaction` and returns false when the row doesn't exist. `deleteTeamAndMembers` (the admin route) takes the team lock first; `removeTeamRows(tx, teamId)` is the same delete as a step inside a caller's transaction that already holds the lock (the captain's delete and the last member leaving). Any new multi-step write must also use a transaction. Admin delete routes are `/admin/users/:id` (`deleteUser`: PLAYER and OWNER accounts), `/admin/indoors/:id` (`deleteIndoor`: OWNER accounts only, anything else 404 "Venue not found") and `/admin/teams/:id`. Both account routes share `deleteAccount` in `adminController.js`, which refuses with 403 when the target is the admin's own account or any ADMIN account.
- **Route ordering matters**: in `playerRoutes.js`, `/me`, `/invites` and `/requests` must stay above `/:id`; in `teamRoutes.js`, `GET /me` must stay above `GET /:teamId`.
- **Team reads** (feature 1, `docs/features/team-membership.md`): `GET /teams/:teamId` (any logged-in user) is shaped by `toTeamDetail`: `memberCount`, `maxMembers` (`MAX_TEAM_MEMBERS`), `viewerState` (`captain`/`member`/`invited`/`requested`/`none`; venue owners and the admin are always `none`), `members` (accepted, captain first, then earliest `acceptedAt`, ties to the lower id), `joinRequests` (oldest first, with `message`) and `pendingInvites` (newest first) only for the captain and the ADMIN, `myRequest` (`{ createdAt, message }`) only for the requester. `GET /teams` and `/teams/me` use `toTeamListItem` (`pendingInvites` holds invites only); `/teams/me` adds `memberCount`, `maxMembers` and, for the captain, `joinRequestCount`. `GET /players/requests` (`playersOnly`): the viewer's pending join requests with their message and the team's counts. `GET /players/invites` lists `origin: invite` rows only. `GET /players` puts each player's public position in `playerProfile`. **The join request message is seen only by the team's captain, the requester and the admin**: every query omits it (`MEMBERSHIP_FIELDS_NOT_IN_REPLIES`) and only those replies add it back through `toMembershipReply(row, { withMessage: true })`.
- **Remove member vs cancel invite:** `DELETE /teams/:teamId/members/:userId` removes accepted members only (a pending row gets 404 "Player not found in this team."); `DELETE /teams/:teamId/invites/:userId` cancels a pending invite (captain; 403 "Only the team captain can cancel invites.", 404 "Invite not found", 200 "Invite cancelled"). Join requests are declined with the request routes, never deleted through either.
- **Leave, transfer, edit** (`playersOnly`, under the team lock): `POST /teams/:teamId/leave` (404 "You're not a member of this team." unless accepted; the captain gets 409 "Transfer captaincy before leaving the team." while other members exist, and as the only member deletes the team with all its rows: 200 `{ message: 'Team deleted', teamDeleted: true }`; a member: 200 `{ message: 'You left the team.', teamDeleted: false }`). `POST /teams/:teamId/transfer` (`transferSchema` = `inviteSchema`; captain only, 403 "Only the team captain can transfer captaincy."; to yourself 400 "You're already the captain."; the target must be an accepted member, else 404 "Player not found in this team."; one update of `captainId`, the old captain stays a member; 200 `{ message: 'Captaincy transferred', captainId }`). `PATCH /teams/:teamId` (`updateTeamSchema` = `createTeamSchema`, so a missing description becomes null; captain only, 403 "Only the team captain can edit this team."; replies with the `toTeamDetail` shape). `DELETE /teams/:teamId` keeps its replies.
- **Join requests** (`playersOnly`): `POST /teams/:teamId/requests` (`joinRequestSchema`: optional `message`, text, trimmed, at most 150 code points (`JOIN_REQUEST_MESSAGE_MAX`), blank stored as null; 201 with `{ id, teamId, userId, status, createdAt, message }`; 409 "You're already in this team." / "You've already asked to join this team." / `TEAM_FULL_MESSAGE`; a pending invite is accepted instead, 200 `{ message: 'Joined team successfully', joined: true }`), `DELETE /teams/:teamId/requests/me` (200 "Request cancelled", 404 "Join request not found"), `POST /teams/:teamId/requests/:userId/approve` (captain; `accepted`, `acceptedAt` now, `message` null; 409 when full) and `.../reject` (captain; deletes the row, 200 "Request declined"). Non-captain 403 "Only the team captain can approve or reject join requests.".
- **The team lock and the limit:** every write to a team's membership rows or captain runs inside `withLockedTeam` (`teamController.js`): one interactive `$transaction` whose first step is `lockTeam(tx, teamId)` (`src/utils/membership.js`: `SELECT id, "captainId" FROM "Team" WHERE id = … FOR UPDATE` with Prisma's tagged `$queryRaw`, never `$queryRawUnsafe`; null means 404 "Team not found"). Writes to one team therefore run one after the other, so the 15-member check (`countMembers` against `MAX_TEAM_MEMBERS`) can't be raced past: `tests/team-limit.test.js` fires 2 and 5 approvals at once. New membership writes must use it too. Status codes for team actions: 400 bad input, 403 wrong role or not the captain, 404 gone, 409 the current state doesn't allow it.
- **`GET /auth/me`** (`verifyToken`): the caller's own `{ id, name, email, role, verified }` through `toVisibleUser`; 401 if the token's user no longer exists. Used by the app at start-up.
- **Registration flow**: `POST /auth/register` creates the `User` and its role-specific profile in one nested create, then emails a verification link (valid 24 hours). Login is refused until `verified` is true. `POST /auth/resend-verification` sends a new link to an unverified account (the login screen shows a button for it after the 403). Password reset sends a link (valid 1 hour) to a server-rendered HTML form at `/auth/reset-password-page`, which POSTs to `/auth/reset`. That is why `express.urlencoded` is enabled, with `extended: false` so every form value is plain text (a repeated field becomes an array), never a nested object: `token[not]=x` is a field literally named `token[not]`.
- **Tokens are stored hashed**: the email link carries the random token; `User.verifyToken` and `User.resetToken` hold only `hashToken(token)` (SHA-256 hex). Always store and look up the hash, require the expiry (`verifyTokenExpires` / `resetTokenExpires`) to be in the future, and clear both token and expiry once used. Check `isWellFormedToken` before any lookup of a token from a URL. Reset and resend have a 5-minute per-account cooldown (`sentRecently`), with an unchanged reply.
- **Change password** (feature 2, spec d endpoint 6): `POST /auth/change-password` (`verifyToken`, `changePasswordLimiters`, `changePasswordSchema` in `authSchemas.js`, `changePassword` in `authController.js`; any role). Schema, in stages: both `currentPassword` and `newPassword` non-empty text ("Current password and new password are required"), the strength rule and 72 bytes for the new one, then new ≠ current (`SAME_PASSWORD`). A wrong current password is **400 "Current password is incorrect", never 401** (the app logs out on any 401 that carried a token). Success is one `update` whose `where` also requires the stored hash still to be the one just checked (P2025 → the same 400), setting the new hash, `tokenVersion + 1` and clearing `resetToken`/`resetTokenExpires`; the reply is `{ message: 'Password changed', token }` with a fresh token from `signLoginToken`, sent **before** `sendPasswordChangedEmail` runs (a failed send is only logged).
- **Player Edit profile** (feature 2, `docs/features/profiles-and-registration.md`): `PATCH /players/me` (`verifyToken`, then `onlyRole('PLAYER', 'Players only')` from `src/middleware/auth.js`, which runs before `validate` so a venue owner or the admin always gets 403, then `updatePlayerProfileSchema` in `src/validation/playerSchemas.js`). Every field each time (spec P11): `name` ("Name is required", 2–50), `phone` ("Phone number is required", the mobile rule), `position` ("Position is required", the list), `height`, `weight` (as before), `area` (`area()` in `profileFields.js`: trimmed, inner whitespace runs made one space, blank or missing null, 2–40 code points, "Area must be text" / "Area must be between 2 and 40 characters"); a missing, null or "" optional field clears it. One `updateMany` on the profile (404 "Player profile not found" if none), then the reply is the `GET /players/me` shape (`loadOwnPlayerProfile`).
- **Venue owner edit** (feature 2, spec D2): `PATCH /owners/me` (`verifyToken`, `onlyRole('OWNER', 'Owners only')`, then `updateVenueSchema` in `src/validation/ownerSchemas.js`). Every field each time: `indoorName` ("Venue name is required", 2–60), then optional `phone` (`optionalPhone()`: blank or spaces null, else the mobile rule; venue phones are mobile only), `address` (at most 200), `website` (at most 200, then `isWebLink` from `src/utils/links.js`: a pattern, not `new URL`: `http://` or `https://` in any case, a host of letter/digit/`-`/`_` labels joined by dots, an optional port up to 65535 and an optional path, no spaces, no `user@`; else "Website must start with http:// or https://"; the app's `src/utils/links.js` is the same function with the same test cases, DECISIONS.md 2026-11-22), `description` (at most 500). The optional texts are trimmed and blank becomes null (`trimmedOptionalText`, spec P13). One `updateMany` (404 "Owner profile not found"), then the `GET /owners/me` shape (`loadOwnOwnerProfile`). The app checks websites with the same `isWebLink` before sending and before every `Linking.openURL`.
- **Profile visibility (`src/utils/visibility.js`)**: the one place for "who may see what" (PRODUCT.md, "Profile visibility"). Every endpoint that returns user or profile data must go through it, including new ones. Never hand-filter fields in a controller.
  - `toVisibleUser(user, viewer)`: yourself or ADMIN get everything except secrets; others get only id, role, createdAt, name and the public profile.
  - `toPublicPlayer`: name and position; height, weight and `area` only if set (Area is public, PRODUCT.md "Profile visibility"); phone only with `canSeePhone`; never email. `GET /players` and the team member lists (`GET /teams`, `/teams/me`, `/teams/:teamId`) select `area`.
  - `toPublicVenue`: the business listing is public; the owner's login email only with `canSeeEmail`.
  - `withoutSecrets`: strips password, verify/reset tokens and their expiry times at any depth (used on admin replies).
  - `findAcceptedTeammateIds(prisma, viewerId)`: one query per request; no endpoint returns other players' phones yet.
  - Responses keep their field names; hidden fields are just left out.
- **Registration email failure**: if the verification email fails to send, register still replies 201 with a message pointing to "Resend verification email", and logs the error. A successful password reset also clears any leftover `verifyToken`/`verifyTokenExpires`.
- **Every endpoint that reads a body or query declares a zod schema in `src/validation/`, and its controller reads only `req.valid`.** Reason: unchecked values must never reach Prisma, because objects like `{"not": ""}` get treated as query operators, and wrong types crash Prisma into 500s. Schemas live in one file per router (`authSchemas.js`, `teamSchemas.js`; shared helpers in `common.js`: `charCount` counts code points, `byteCount`, `inStages` runs schemas in order so a request with several problems gets the same first message as before, `requiredText`; the profile fields shared by registration and the edit endpoints live in `profileFields.js`). Routes run `validate({ body, query })` from `src/middleware/validate.js` after the rate limiters and auth checks. It puts the parsed, cleaned values on `req.valid.body` / `req.valid.query` (never reassign `req.query`: it's read-only in Express 5) and replies 400 `{ "error": "<first problem's message>" }`. Options: `message` (one fixed reply for any problem; login uses `INVALID_LOGIN`) and `onInvalid(req, res, message)` (a different reply: `/auth/reset` uses `sendResetFailure`, which gives the browser form HTML pages with "Try again" where it helps; the verify and reset-page links use their HTML pages). Unknown fields are stripped, not rejected (the app sends extras such as `profileData.name` for players and a top-level `name` for owners). Messages are short and human because the app shows `error` in an alert; tests and the app rely on the existing ones, so don't reword them. Conventions and limits: DECISIONS.md 2026-11-20 "Input validation conventions and limits". The only `req.body` read outside a schema is `sendResetFailure` peeking at the raw token to build the "Try again" link (only if `isWellFormedToken`), and `rateLimits.js` keys on `normalizeEmail(req.body?.email)`.
- **Ids from URL params are not in the schemas:** every one goes through `parseId` (`src/utils/ids.js`: positive integer within Int range, else null → 400). Never use `Number(...)` or `parseInt(...)` on a URL id. Because validation middleware runs before the controller, a request with both a bad body and a bad URL id gets the body's message.
- **Emails are normalised in one place:** `normalizeEmail` (`src/utils/email.js`) trims and lowercases, and returns null for non-strings or blanks. Register, login, forgot-password, resend-verification, the rate-limit keys, the mailer's example.com check and `createAdmin.js` all use it. Any new place that reads an email must too. Existing stored emails were checked on 2026-11-20: all lowercase, no clashes.
- **Request schemas in `src/validation/`** (see the zod bullet above) and **shared helpers in `src/utils/`:** `mailer.js` (account emails through nodemailer 10 and Gmail SMTP: `createMailer(transporter, { fromAddress, backendPublicUrl })` returns `sendMail` (skips @example.com, rejects .invalid), `sendVerificationEmail`, `sendResetEmail` and `sendPasswordChangedEmail` (no link in it); the server's instance is `mailer`; `checkMailConnection()` logs the Gmail login result once at startup, called from `authController.js`; creating the transporter makes no connection), `email.js` (`normalizeEmail`, see above), `membership.js` (`MEMBERSHIP_FIELDS_NOT_IN_REPLIES`: `origin`, `acceptedAt` and `message`, left out of every reply with Prisma's `omit`; a reply that may show a join request's message adds it back only for the captain, the requester and the admin; `toMembershipReply` strips the same fields from rows loaded in full; `MAX_TEAM_MEMBERS` (15) and `TEAM_FULL_MESSAGE`; `isMember`, `isPendingInvite`, `isPendingRequest` name the kinds of row), `deletion.js` (transactional deletes, see Prisma above), `ids.js` (`parseId`), `links.js` (`isWebLink`, the website check), `password.js` (the one strength rule, used by register, reset and `createAdmin.js`), `visibility.js` (see above), `html.js` (`escapeHtml`: use it for every value inserted into HTML, in emails or server-rendered pages), `tokens.js` (generates verify/reset tokens, checks their format, `hashToken`, link lifetimes, the email cooldown, and `signLoginToken(user)`, the one place login tokens are signed), `emailTemplates.js` (email HTML), `pages.js` (`messagePage` for server-rendered pages, `legalPage` for the Terms and Privacy pages, and `isFormRequest`: `/auth/reset` answers HTML to the browser form and JSON to JSON requests). `GET /auth/verify` always answers with HTML pages (it's opened from an email).
- **Login replies** are the same for an unknown email and a wrong password ("Invalid email or password", 400). "Please verify your email" (403) is only returned after the password is correct. An unknown email is still compared against a fixed dummy bcrypt hash, so both cases take about the same time.

### 10.5 Data model (`prisma/schema.prisma`, technical)
- `User` has an optional `PlayerProfile` (name, phone, `position`, optional height/weight and `area`) or `OwnerProfile` (indoorName, then optional phone, address, description and website), chosen by `role`. Migration `20261121204305_profiles_registration` (hand-edited, converts and renames in place): `position` is the `Position` enum (`Goalkeeper`, `Defender`, `Midfielder`, `Forward`, `Any`, spelled as the app shows them; old free text was mapped, everything unmatched to `Any`); `PlayerProfile.address` was renamed to `area` (the player's general area, never a full address); `OwnerProfile.phone` and `address` are nullable since the short owner sign-up; `User.termsAcceptedAt` (nullable) is when the user ticked the Terms box at sign-up, null for older accounts and the script-made admin. The display name returned at login comes from `playerProfile.name` or `ownerProfile.indoorName`.
- `User.tokenVersion` (Int, default 0, added by migration `20261120133554_add_token_version`): login tokens carry it, and increasing it cancels all of the account's tokens (logout on every device). Only these events increase it: password reset, password change while logged in, and suspension (DECISIONS.md 2026-11-20, "Which events log out every device"; suspension comes with the moderation feature).
- **"Owner" only means a venue owner.** `Role.OWNER` is an indoor venue owner. The team side is called **captain** everywhere (schema, API, app): `Team.captainId` (relation `captain`; on `User`, `captainedTeams`, relation name "CaptainedTeams", with an index on `captainId`) is the *player* who captains the team, the creator unless captaincy is transferred. It is the only record of the captain (DECISIONS.md 2026-11-18): `TeamMember` has no `role` column (migration `20261120161908_captain_id` renamed `ownerId` in place and dropped `TeamMember.role`). The captain is also an accepted `TeamMember` of their team, created with the team in `createTeam`. Captain-only actions (invite, remove player, delete team) compare `team.captainId` with `req.user.id`. A captaincy change must be a single update of `captainId` (`POST /teams/:teamId/transfer`, below). Team replies carry `captainId`; the invites reply (`GET /players/invites`) and the admin teams list carry `team.captain` / `captain`.
- `TeamMember` fields (migration `20261120171221_membership_data`): `status` is the `MembershipStatus` enum (`pending`, `accepted`; lowercase so replies and the app keep the same text; default `pending`); rejecting an invite deletes the row. `origin` is the required `MembershipOrigin` enum: `invite`, `request` (join request, created by `POST /teams/:teamId/requests`) or `creator` (the captain's own row, written by `createTeam`). `createdAt` (formerly `joinedAt`) is when the invite, request or team was created, not when the player joined. `acceptedAt` (nullable) is set when the row becomes accepted: `createTeam` sets it for the captain, `acceptInvite` sets it on accept; existing accepted rows got their old `joinedAt`. `message` (nullable text, migration `20261121120000_join_request_message`) is a join request's optional message to the captain; null on every other row. **Longest-standing member** = earliest `acceptedAt`, ties to the lower `id` (for the captain handover in account deletion). Index on `(userId, status)`. Replies keep `createdAt` but never `origin` or `acceptedAt`, and `message` only for the captain, the requester and the admin (`membership.js`). Player stats (`GET /players/:id`) still return a `joinedAt`, but that's the account's `createdAt`, not a membership date. Rows are unique on `(teamId, userId)`. **Pending rows are not membership:** `GET /teams` and `/teams/me` return only accepted rows in `members`, and add `pendingInvites` (invites only, never join requests) only when the viewer is that team's `captainId` (shaped by `toTeamListItem` in `teamController.js`; non-captains don't get the field at all). `/players/:id` `totalTeams` and the admin `memberCount` count accepted rows only. Pending rows come from invites (`origin: invite`) and join requests (`origin: request`). The old `POST /teams/:teamId/join` was removed in Phase 1 (it let players accept their own join requests); invite accept and reject, and `GET /players/invites`, act only on `origin: invite` rows and return 404 otherwise, so a player can never accept their own request.
- `POST /teams/create` input is checked by `createTeamSchema` (`src/validation/teamSchemas.js`): name required, text, trimmed, 2–40 characters; description optional, text if given, at most 200 characters after trimming, blank stored as null. Lengths count code points, so Bangla text isn't over-counted. Names needn't be unique. `POST /teams/:teamId/invite` takes `userId` as a positive whole number (`inviteSchema`; the text "5" is refused), at most `MAX_DB_INT` (2147483647, exported from `src/utils/ids.js`, the same limit as `parseId`). Any id from a body that reaches Prisma needs that same limit. Invite order of checks, under the team lock: captain (403) → full (409 `TEAM_FULL_MESSAGE`) → the invitee is an existing PLAYER (404 "Player not found") → a pending join request from them is approved instead (200 `{ message: 'Request approved', joined: true }`, message cleared) → any other row 400 "Player is already invited or in the team." → 201 with the new invite. Accepting an invite is refused with 409 when the team is full (the invite stays pending).
- Registration input is checked by `registerSchema` (`src/validation/authSchemas.js`; the password strength rule itself stays in `src/utils/password.js`; profile fields come from `src/validation/profileFields.js`, shared with the profile edit schemas). The short sign-up forms (PRODUCT.md, "Registration"; `docs/features/profiles-and-registration.md`). Email: normalised, a valid address, at most 254 characters. Password: the strength rule and at most 72 bytes (bcrypt ignores the rest; counted in UTF-8 bytes). Role PLAYER or OWNER. PLAYER: `name` (top level) 2–50 characters, trimmed; `profileData.phone` a Bangladeshi mobile number (`MOBILE_NUMBER`, `^01[3-9]\d{8}$`, after trimming the ends; else `PHONE_RULE_MESSAGE`); `profileData.position` exactly one of `POSITIONS` (else `POSITION_MESSAGE`); missing phone or position: "PLAYER profile requires phone and position". OWNER: `profileData.indoorName` 2–60 characters, trimmed (missing: "Venue name is required"). Both: `acceptedTerms` exactly `true` (else `TERMS_REQUIRED`, "Please accept the Terms of Use and Privacy Policy"), the last key of each role's object so other problems are reported first. Height, weight, address and the venue's phone, address, description and website are no longer read (stripped). Register sets `termsAcceptedAt` to now. Character limits count code points. "Email already registered" is checked in the controller, after all of these. The app sends `acceptedTerms` only as the Terms box's own value (never fake the Terms on either side).

### 10.6 Mobile app (technical)
- `App.js` wraps `SafeAreaProvider` (react-native-safe-area-context, for the `Screen` component) around `ThemeProvider`, which wraps a `ThemedStatusBar` (always `light-content`, background `colors.bg`, whatever the phone's light/dark setting) and `AuthProvider` (`src/contexts/AuthContext.js`) around `AppNavigator`.
- **Theme module (`src/theme/`, DESIGN.md sections 2–5):** `palette.js` (the only hex values), `colors.js` (meanings: bg, surface, border, text, textMuted, accent, onAccent, accentSoft, tabBar, tabIdle, danger, badge, onBadge, avatarBg, avatarText, shadow, scrim), `typography.js` (`fonts` and text styles display, title, cardTitle, section, body, bodyStrong, bodySmall, meta, pill, tabLabel, tabLabelActive, button, buttonSecondary, badge), `spacing.js` (scale xxs 4 … xxxl 28, layout tokens, `touchTarget` 44), `radius.js` (card 14, button 10, small 6 for the checkbox box, round 999), `shadows.js` (`floating`, with iOS shadow props and Android `elevation`), `icons.js` (`icon`: size 24, sizeSmall 16, strokeWidth 1.8), `sizes.js` (`sizes`: field 48, button 46, avatarSmall 38, avatarLarge 44, badge 18, dot 8, border 1, dialogMaxWidth 400, used as minimums for anything holding text, and logo 72 for the Login ball; `opacity`: disabled 0.45, pressed 0.8), `index.js` (the one `theme` object) and `ThemeProvider.js` (`ThemeProvider`, `useTheme()`; throws outside the provider). `ThemeProvider.js` imports `index.js`, never the reverse. Screens read the theme only through `useTheme()` and use only `colors` meanings, never `palette`. Prefer the layout tokens (`screenPadding`, `cardPadding`, `listGap`, `detailGap`, `cardGap`) and use the size scale only for one-off gaps. Dark only, no switching. `__tests__/theme.test.js` checks every token value against DESIGN.md, that every colour meaning exists in the palette, and the contrast rules (computed in the test, no package).
- **Shared components (`src/components/ui/`, DESIGN.md section 6):** screens are built from these, imported from `src/components/ui/index.js`: `Text` (`variant` = typography token, `color` = colour meaning), `Screen` (`scroll`, `keyboardAware`, `edges`, default top, `scrollRef` (with `scroll`, a ref to the ScrollView); needs the root `SafeAreaProvider`), `Button` (primary/secondary/danger, `icon`, `fullWidth`, `disabled`, `loading`: label kept but invisible under the spinner so the size never changes, presses blocked both by `disabled` and in the handler, `accessibilityState.busy`), `IconButton` (approve/reject/plain, 44×44, warns in dev without `accessibilityLabel`), `Card` (optional `onPress`), `Pill` (strong/soft), `Badge` (`badgeLabel`: nothing below 1, "99+" above 99), `Avatar` (`getInitials`: the first whole character of the first two words that start with a Unicode letter (`\p{L}`), uppercase; words starting with an emoji, flag, number or symbol are skipped; "?" if none. Whole characters come from `Intl.Segmenter` when the engine has it, else a fallback that keeps `\p{M}` marks and joins across a virama or ZWJ; `INITIALS_METHOD` says which, shown in the gallery. The `\p{…}` patterns are built with `new RegExp('…', 'u')` because the app's Babel preset (`@babel/plugin-transform-unicode-regex`) fails on `\p{…}` in a regex literal ("Expected atom"); Hermes supports Unicode property escapes (its compiler accepts `\p{L}`/`\p{M}` and rejects unknown names). Initials capped at 1.3× font scale), `ListRow` (`last` hides its bottom `Divider`; feature 2 adds `icon`, one of our Icon names shown in `textMuted` instead of the Avatar for rows that aren't people, and `hint`, a third `meta`/`textMuted` line), `TabBar` (React Navigation custom `tabBar`: icon from the `tabBarIconName` option, `title` label, `tabBarBadge`; emits `tabPress` with React Navigation's own `data.behavior` so the current tab's stack pops to top, then dispatches navigate to the tab; `tabLongPress`; tabs ≥ 44 tall with role `tab` and selected state; bottom inset from React Navigation or the safe area; hidden while the Android keyboard is open), `ScreenHeader` (greeting or `back`, `display` title, `action`), `BackLink`, `SectionHeader`, `TextLink`, `NoticeLine`, `Divider`, `EmptyState`, `ConfirmDialog` (Modal; back and outside tap cancel except while `loading`; `destructive` uses the danger Button; floating shadow, scrim), `Checkbox` (feature 2: a 24×24 box, corner `radius.small`, in a 44×44 target, role `checkbox` with checked state, the label beside it read with it, `children` under the label stay separately tappable (the Terms links), an `error` line with the warning icon, `disabled`), `SuggestionField` (feature 2, the Area field: a `TextField` plus an inline list of up to 5 rows under it, each ≥ 44 with the `area` icon, labelled "Suggestion: {name}"; shown only while focused and `getSuggestions(value)` returns something; tapping a row calls `onChangeText(name)`; `disabled` shows none; other props go to `TextField`), `OptionGroup` (feature 2, the position picker: label, chips in a wrapping row, each ≥ 44, chosen = accent/onAccent; a `radiogroup` of `radio`s with selected state; options as text or `{ value, label }`; `error`, `disabled`) and `TextField` (focus/error borders, warning icon with the error, helper, `secure` show/hide IconButton, `disabled`; label as the input's accessibilityLabel, error or helper as its hint; no lineHeight on the TextInput). Every component takes an optional `style` for layout only. They use tokens only: `__tests__/components-composite.test.js` scans every file in the folder and fails on a raw hex/rgb/hsl colour, a hand-set `fontFamily` or a font name. In Jest, find Pressables by role and a function `style` (`findByType(Pressable)` doesn't match). **UI gallery:** `src/screens/Dev/UIGalleryScreen.js` shows every component and two mock-ups of the design PNGs; `AuthStack` `require`s it only inside `__DEV__` and registers `UIGallery` only then, and `LoginScreen` shows its "UI gallery" link only when `__DEV__`. A release bundle (`npx react-native bundle --dev false`) contains none of it, because Metro inlines `__DEV__` and drops the dead branch before collecting dependencies; checked on 2026-11-21.
- **Icons (`src/components/ui/Icon.js`, DESIGN.md section 7):** `<Icon name size color accessibilityLabel />`, the only file that imports Lucide (`lucide-react-native` 1.70.0, drawn by `react-native-svg` 15.16.1, a native module: rebuild after changing it). Screens never import Lucide; they use our names (`ICON_NAMES`; the table is in DESIGN.md section 7). Each Lucide icon is imported from its own file (`lucide-react-native/icons/<kebab-name>`), because Metro doesn't drop unused code and the package's main entry would bundle every icon; to add one, import it and add one line to the `ICONS` map. Defaults: `size` from `icon.size`, `color` from `colors.text`; stroke width always `icon.strokeWidth`. The glyph sits in a `View`: with `accessibilityLabel` it's `accessible`, role `image`, `importantForAccessibility` `yes`; without one it's hidden (`no-hide-descendants`, `accessibilityElementsHidden`). An unknown name renders `null` and `console.warn`s once per name, only when `__DEV__`. Under Jest the `react-native` export condition picks Lucide's `.mjs` files, so `jest.config.js` `moduleNameMapper` points `lucide-react-native/icons/*` at `dist/cjs/icons/*.js`. Existing screens still use Ionicons (`react-native-vector-icons`) until their restyle; removing it is the last item of ROADMAP Step 4.
- **Fonts:** static `.ttf` files in `assets/fonts/` (`BarlowCondensed-Bold`, `Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`, from Google Fonts, with `OFL-*.txt` licenses), listed in `react-native.config.js` and copied by hand into `android/app/src/main/assets/fonts/` (no `react-native-asset` run; iOS isn't linked yet). The file name is the `fontFamily` (also each font's PostScript name, for iOS later). Android picks a custom font's weight by file, so text styles set `fontFamily` per weight and never `fontWeight`; headings include `textTransform: 'uppercase'` and their letter spacing. Adding fonts needs a rebuild (`npm run android`).
- `AppNavigator` gives `NavigationContainer` a theme built from tokens on top of React Navigation's `DarkTheme` (primary accent, background bg, card surface, text, border; fonts left at React Navigation's defaults). Existing screens keep their old hand-written light styles until each restyle task. **Android window:** `AppTheme` (`android/app/src/main/res/values/styles.xml`) sets `windowBackground` and `statusBarColor` to `@color/app_background` (`res/values/colors.xml`, `#0E1116`, which must match `palette.nearBlack` / `colors.bg`; native files can't read the JS tokens) and `windowLightStatusBar` false, so no white window shows before the first screen. Its parent stays `Theme.AppCompat.DayNight.NoActionBar` on purpose: the parent also sets Android's default text, input and alert colours. Since feature 2 rebuilt the sign-up screens no screen uses a plain `TextInput`, but the old screens (admin, settings, profile, lists) haven't been checked for text that relies on those defaults, so the switch waits until they're restyled. The navigation bar isn't set. Switching the parent to always-dark is a ROADMAP item for after the restyles. `AppNavigator` switches on `user.role` between `AuthStack`, `PlayerNavigator`, `OwnerNavigator` and `AdminNavigator`.
- **Role navigators are bottom tabs with a native stack per tab** (PRODUCT.md, "App structure and navigation"), so pushed screens keep the tab bar. All three spread `tabNavigatorProps` from `src/navigation/tabs.js`: our `TabBar` as the custom `tabBar`, `backBehavior: 'firstRoute'` (Android back on another tab's first screen goes to the first tab; on the first tab's first screen it leaves the app) and no tab-level header. Each `Tab.Screen` sets `title` and `tabBarIconName` (one of our Icon names); `tabBarBadge` shows a Badge. Tab route names end in `Tab`:
  - **Player** (`PlayerNavigator.js`): `MyTeamsTab` (MyTeams and CreateTeam, plus the team screens), `ExploreTab` (`ExploreStack`), `NotificationsTab` (Invites, interim, plus the team screens), `ProfileTab` (PlayerProfile, EditProfile, Settings and ChangePassword, all without a stack header: PlayerProfile's own `ScreenHeader` has the Settings gear `IconButton` → `Settings`).
  - **Owner** (`OwnerNavigator.js`): `MyVenueTab` (`MyVenue`, the listing, and `EditVenue`), `ExploreTab` (`ExploreStack`), `NotificationsTab` (OwnerNotifications, interim empty state), `ProfileTab` (OwnerSettings, interim until profile editing).
  - **Admin** (`AdminNavigator.js`): `DashboardTab` (AdminDashboard), `ReportsTab` (AdminReports, interim empty state), `VenuesTab` (ManageIndoors), `UsersTab` (ManageUsers), `TeamsTab` (ManageTeams).
  - `ExploreStack.js` exports `PlayerExploreStack` and `OwnerExploreStack` (the same stack, `readOnly` for owners): the interim `screens/Shared/ExploreScreen` (three ListRows) → `Teams`, `Players`, `Indoors`, plus the team screens. A team in `TeamsListScreen` opens `TeamDetail` with `{ teamId }`. Owners see it read-only (TeamsListScreen hides Create Team for them, Team detail shows no buttons).
  - **The team screens** (`src/navigation/teamScreens.js`): `teamScreens(Stack, { readOnly })` returns one `Stack.Group` with `TeamDetail`, `RequestToJoin`, `TransferCaptaincy`, `EditTeam` and `InvitePlayers` (readOnly: `TeamDetail` only). It's spread into the player's My Teams and Notifications stacks and both Explore stacks, because a screen can only navigate inside its own stack. The new screens hide the stack header (`headerShown: false`) and draw their own `BackLink`; Team detail's label names the route underneath (`MyTeams` → "My Teams", `Teams` → "All Teams", `Invites` → "Invites", else "Back").
  - A screen can only `navigate` to routes in its own stack (or a parent); jumping to another tab uses the nested form: TeamsListScreen's Create Team does `navigate('MyTeamsTab', { screen: 'CreateTeam', initial: false })` (My Teams stays under it), OwnerSettings' "Profile" does `navigate('MyVenueTab', { screen: 'MyVenue' })`. Header buttons get `navigation` from the screen's options function, not `useNavigation()` (in a native-stack header it doesn't find the screen's navigator). Old screens keep their own headers (stack header shown or hidden as before). `__tests__/navigation.test.js` renders each role's navigator with a fake API and checks tabs, a pushed screen, the cross-tab Create Team and Android back (via the container ref's `goBack`/`canGoBack`).
- **Sign-up helpers (feature 2):** `src/utils/phone.js` (`cleanPhone`: removes spaces and dashes, then a leading `+88` or `88` only when `01` follows, so a number that isn't a Bangladeshi mobile is never turned into one; `isMobileNumber` with the backend's `MOBILE_NUMBER`; `PHONE_RULE_MESSAGE`; the field keeps what was typed, only the checked and sent value is tidied), `src/utils/password.js` (the backend's `isStrongPassword` and 72-byte limit repeated, `newPasswordProblem`, `PASSWORD_HELPER` listing the only symbols the backend counts, `!@#$%^&*(),.?":{}|<>`: a dash or underscore isn't one; keep in sync with `backend/src/utils/password.js`), `src/constants/positions.js` (`POSITIONS`, as the backend's enum), `src/constants/areas.js` (`AREAS`, the spec's P6 starter list, and `suggestAreas(text)`: case and outer spaces ignored, names starting with the text first, then names containing it, each A–Z, at most `MAX_SUGGESTIONS` (5), none for empty text or a name typed in full) `src/utils/links.js` (`isWebLink`, the backend's website rule as the same pattern (React Native's `URL` doesn't really parse links, so it's not used), and `WEBSITE_MESSAGE`; keep in sync with `backend/src/utils/links.js`; `IndoorsListScreen` opens a website only when it passes, otherwise shows it as plain text) and `src/screens/Auth/signUpCommon.js` (each field's first problem with the backend's messages where it has one, `checkPlayerSignUp`, `checkOwnerSignUp`).
- **Auth screens (feature 2, `docs/features/profiles-and-registration.md` section e; `AuthStack` hides the stack header for the rebuilt ones):** `LoginScreen` (ball logo at `sizes.logo`, "ConnectArena" and the slogan; Email and Password `TextField`s with "Email is required"/"Password is required" before sending; a "Forgot password?" `TextLink`; Log in with `loading`; after the 403 a `NoticeLine` and a secondary "Resend verification email" with `loading`, hidden again when the email changes; "New here?" + "Create an account" → `RoleSelection`; the dev-only "UI gallery" link), `RoleSelectionScreen` (back "Log in", two `Card`s → `PlayerRegister` / `OwnerRegister`) and `ForgotPasswordScreen` (`POST /auth/forgot` with the trimmed email; on success the form is replaced by `RESET_SENT_TEXT` and "Back to log in", no alert; a refusal alerts "Not sent" with the backend's message). Every submit has a `useRef` guard (`busy`) as well as the loading Button, so two taps in the same instant send one request.
- **Sign-up screens (feature 2):** `PlayerRegisterScreen` (Name, Email, Phone with the tidy-up, Position `OptionGroup`, Password with `PASSWORD_HELPER`, Confirm password, `TermsAgreement`, Create account with `loading`) and `OwnerRegisterScreen` (a line saying the listing comes later; Venue name, Email, Password, Confirm, `TermsAgreement`, Create account). Both run `checkPlayerSignUp`/`checkOwnerSignUp` first (errors under the fields; changing a field clears its error; then `useScrollToFirstError(order)` from `signUpCommon.js` scrolls the `Screen`'s `scrollRef` up to the first field with a problem, minus `spacing.xl`, using the positions each field's wrapping `View` reports through `onLayoutOf(key)`; `firstErrorOffset` is the pure rule) and keep the button enabled while Terms is unticked (P20). They send `register({ …, profileData, acceptedTerms: form.agreed })` with the trimmed name and email and `cleanPhone`'s number; a refusal alerts "Sign-up failed" with the backend's message. Success calls `showCheckEmail(navigation, email, reply)`, which `reset`s the stack to `Login` → `CheckEmail` with `{ email, sendFailed }` (`sendFailed(reply)` matches the backend's exact `SEND_FAILED_MESSAGE`, since the API has no flag for it). `signUpCommon.js` also holds `TermsAgreement` (a `Checkbox` with "I agree to the Terms of Use and Privacy Policy." and two `TextLink`s under it) and `openLegalPage(page)` (`Linking.openURL(`${API_URL}/legal/<page>`)`; `api.js` exports `API_URL`; a failure alerts "Couldn't open the page"). `CheckEmailScreen` ("We've sent a link to {email}…" or `SEND_FAILED_TEXT`; Resend email (secondary, `loading`) calls `resendVerification(email)` and shows the reply as a line under it, an error in an alert; Back to log in and the back link `navigate('Login')`). `AuthContext.register` passes `acceptedTerms` through untouched and throws an `Error` with the backend's message (or a connection message). `AuthStack` sets `headerShown: false` for every screen.
- **Player profile screens (feature 2):** `PlayerProfileScreen` (no stack header; `ScreenHeader` "Profile" with the gear; loads `GET /players/me` on every focus and on pull to refresh (`RefreshControl` in a `ScrollView` inside a non-scrolling `Screen`); a failed first load shows `TeamLoadState` with "Couldn't load your profile." and Try again, a failed reload keeps the content; a `Card` with the large `Avatar`, the name, the position `Pill` and the area with a small `area` icon; a "Details" `Card` of icon `ListRow`s (Position, Area, Height "172 cm", Weight, Phone with `PHONE_HINT`, Email with `EMAIL_HINT`), empty optional ones showing `NOT_ADDED`; Edit profile (secondary) → `EditProfile`). `EditProfileScreen` (loads `GET /players/me` itself, so Settings can open it too; Name, Phone, Position `OptionGroup`, Area `SuggestionField` with `suggestAreas` and `AREA_HELPER`, Height and Weight with `decimal-pad`, Email disabled with `EMAIL_LOCKED`; `checkProfileEdit` in `src/screens/Player/profileChecks.js` (sign-up's name, phone and position checks, `tidyArea` and 2–40 code points, `readMeasurement`: empty null, a comma as the decimal point, the backend's number and range messages) builds the body with every field (`cleanPhone`'s number, the tidied area or null); errors under the fields with `useScrollToFirstError`; `PATCH /players/me`, then `setUser` with the reply's name and `goBack`; a refusal alerts "Not saved" with the backend's message; a `busy` ref against double taps; no discard dialog).
- **Venue owner screens (feature 2, `src/screens/Owner/`):** `MyVenueScreen` (no stack header; `ScreenHeader` "My Venue"; loads `GET /owners/me` on every focus and on pull to refresh, like `PlayerProfileScreen`; a failed first load shows "Couldn't load your venue." with Try again; the venue name in `title`, then a "Listing" `Card` of icon `ListRow`s: Phone (`phone`), Address (`area`), Website (`website`), Description (`description`), each `NOT_ADDED` when empty; the website is a `TextLink` opening `openWebsite` only when `isWebLink` passes, otherwise plain text; a primary **Edit venue** `Button` → `EditVenue`). `EditVenueScreen` (loads `GET /owners/me`; Venue name, Phone (optional, `cleanPhone` incl. `+88`), Address (optional, multiline), Website (optional, `url` keyboard, helper "Starts with https://"), Description (optional, multiline, the helper is the live count `descriptionCount`, "120 / 500 characters", counted trimmed in code points; going over is allowed and caught on Save); `checkVenueEdit` in `venueChecks.js` (the backend's `updateVenueSchema` rules and messages; body with every field each time, trimmed, empty optional fields `null`); Save changes (`loading` + `busy` ref) `PATCH /owners/me`, then `setUser` with the new name (an owner's app name is the venue name) and `goBack`; a refusal alerts "Not saved" with the backend's message; the back link reads "Settings" when opened with `{ from: 'Settings' }`, else "My Venue"; no discard dialog).
- **Settings and Change password (feature 2, `src/screens/Shared/`):** `SettingsScreen` (back "Profile", a `Card` of icon `ListRow`s with a `forward` chevron: Edit profile → `EditProfile`, Change password → `ChangePassword`, Terms of Use and Privacy Policy → `openLegalPage`; a danger "Log out" `Button` with a `ConfirmDialog` "Log out?" that calls `logout()`; the old About and Support rows are gone; players only for now, venue owners get it in task F2.4). `ChangePasswordScreen` (Current password, a "Forgot your current password?" `TextLink`, New password with `PASSWORD_HELPER`, Confirm new password; `checkPasswordChange` ("Current password is required", "New password is required", `newPasswordProblem`, `SAME_PASSWORD`, `confirmProblem`); `AuthContext.changePassword(current, next)` posts `/auth/change-password` and `saveToken`s the reply's fresh token before returning; then one alert "Password changed" / `CHANGED_MESSAGE` and `goBack`; a 400 `WRONG_CURRENT` shows under Current password, never an alert or a logout; any other refusal (for example the 429) alerts "Not changed"; the Forgot link opens a `ConfirmDialog` "Send a reset link?" whose "Send link" (`loading`) posts `/auth/forgot` with `user.email`, then shows `resetSentText(email)` under the link). The old "Change Password" button that emailed a reset link went with `PlayerSettingsScreen` (deleted); the owner's `OwnerSettingsScreen` keeps it until F2.4.
- `src/api/api.js` is a shared axios instance that attaches the JWT from AsyncStorage (`src/utils/storage.js`, key `jwt`). Its response interceptor calls the handler registered with `setSessionExpiredHandler` when a request that carried a token gets **401** (never for 403, never for `/auth/login`), and only if that token is the one saved now (`getToken()`; P30): a request sent with the old token just before a password change saved the fresh one is ignored, and so is any 401 once no token is saved. `__tests__/api-session.test.js` calls the interceptor's error handler directly. `AuthContext` registers it: remove the token, clear `user`, alert "Your session has expired. Please log in again." once (a ref stops repeats; reset on login).
- **App start** (`AuthContext.restoreSession`): with a saved token, `AppNavigator` shows `StartupLoading` while `GET /auth/me` runs (15 s timeout). Success sets `user`; 401 removes the token; anything else sets `serverUnreachable` and shows `ServerUnreachable` with Retry (`retryRestoreSession`), keeping the token, plus a Log out link (`logout()`, which also clears `serverUnreachable`). Both views (`src/screens/Auth/StartupScreen.js`) render outside `NavigationContainer`, straight on the dark Android window, so they paint `colors.bg` and `colors.text` themselves through `useTheme()` (spinner in `colors.accent`); they keep the built-in spinner and the native Retry button until the shared components exist. `logout()` always removes the token.
- **Team detail** (`src/screens/Team/TeamDetailScreen.js`, feature 1, `docs/features/team-membership.md`): params `{ teamId }`; loads `GET /teams/:teamId` on focus through `useTeam` (`src/screens/Team/teamCommon.js`: 404 → alert "Team not found" / "This team no longer exists." and `goBack`; a failed first load shows "Couldn't load this team." with Try again; a failed reload keeps the content). It renders by `viewerState`; visitor buttons only for `user.role === 'PLAYER'`. Actions run one at a time (`busy`), then reload; `showActionError` alerts "Something changed" plus the backend's `error` on 404/409 and reloads, else "Error". Disabled-when-full buttons read `Team is full (${memberCount}/${maxMembers})`. Confirmation dialogs (one `ConfirmDialog`, worded by `dialogFor(kind, team, row)` with the spec's exact text): leave, transferFirst (a captain with members; its button navigates to TransferCaptaincy, sends nothing), leaveAndDelete, remove, delete, declineRequest, cancelInvite ("Keep invite"). Leave, leave-and-delete and delete `goBack` on success; the others reload. In tests, a dialog's confirm button can share its opener's label ("Leave team", "Delete team"): press the last match. Edit team (captain) navigates to `EditTeam` with `{ teamId, teamName, description }`. Invite players navigates to `InvitePlayers` with `{ teamId, teamName }`. **Team form** (`TeamFormScreen.js`): one screen for two routes, `CreateTeam` (My Teams stack, no params; `POST /teams/create`, then `navigation.replace('TeamDetail', { teamId })`) and `EditTeam` (team screens group; `PATCH /teams/:teamId` with both fields, then `goBack`; a 404 alerts and goes back). `checkTeamForm(name, description)` repeats `createTeamSchema`'s limits in code points with the backend's messages, shown as TextField errors before sending; keep the two in sync. `RequestToJoinScreen` (`{ teamId, teamName }`) trims the message to `MESSAGE_MAX` (150) code points with `limitChars`, because TextInput's `maxLength` counts UTF-16 units. `TransferCaptaincyScreen` (`{ teamId, teamName }`) loads the team itself. **My Teams** (`MyTeamsScreen.js`, no stack header): loads `GET /teams/me` and `GET /players/requests` together on focus (the `focus` listener also fires on first open) and on pull to refresh (`RefreshControl` in a `FlatList`); a failed first load shows "Couldn't load your teams." with Try again (`TeamLoadState`'s `errorMessage`). Team cards (Card → `TeamDetail` with `{ teamId }`): Avatar, name, `${memberCount} / ${maxMembers} members`, Captain (strong) or Player (soft) pill, two-line description, and for the captain with `joinRequestCount > 0` a NoticeLine "N join request(s) waiting for you"; no delete. A "Requests sent" card (only when there are any) lists each request with "Waiting for the captain", its message and Cancel (`DELETE /teams/:teamId/requests/me`, no dialog). Empty state only when there are no teams and no requests: "You're not in a team yet.", Create team (→ `CreateTeam`) and a "Find a team" TextLink (→ `ExploreTab` / `Teams`, `initial: false`). **Invites** (`src/screens/Player/InvitesScreen.js`, the interim Notifications tab, no stack header): `GET /players/invites` on focus and on pull to refresh; one Card per invite (→ `TeamDetail` with `{ teamId }`) with the team name, "{captain} invited you · x / y members", and Accept (`POST /teams/:teamId/accept`; disabled with "Team is full (x/y)" when full) and Decline (`POST /teams/:teamId/reject`) side by side, both with loading; 404/409 → `showActionError` and reload; empty: "No invites right now."; failed first load: "Couldn't load your invites." with Try again. **Invite players** (`InvitePlayersScreen.js`, `{ teamId, teamName }`): loads `GET /teams/:teamId` through `useTeam` and `GET /players` on focus; lists players except the captain, `members`, `pendingInvites` and `joinRequests`, filtered by name on the phone; an invite marks the row "Invited" (or "Joined" when the reply has `joined: true`) without leaving or reloading; a 400, 404 or 409 alerts "Something changed" and reloads both; full team: "Team is full (x/y)" and every Invite disabled. `TeamsListScreen` shows "+ Create Team" only to `PLAYER`s, and the captain's name from the team's `members` (the captain is always an accepted member). UI text calls the team creator "Captain"; "owner" in the app means a venue owner.

Known bugs and security issues are tracked in `docs/ROADMAP.md`, not here.
