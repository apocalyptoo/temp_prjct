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

`server.js` connects each address prefix to a router file. Each router file uses the controller with the same name.

| Prefix | Route file | What it handles |
|---|---|---|
| `/auth` | `authRoutes.js` | Register, log in, verify email, forgot/reset password (no login needed), `GET /auth/me`: who is logged in, and `POST /auth/change-password` (both need a token) |
| `/players` | `playerRoutes.js` | My player profile and Edit profile (`PATCH /players/me`), my pending invites, my pending join requests, list all players, a player's stats |
| `/owners` | `ownerRoutes.js` | My owner profile and editing my venue listing (`PATCH /owners/me`), list all registered venues |
| `/teams` | `teamRoutes.js` | Create, list, my teams, one team, edit team, invite, cancel invite, accept, reject, join requests (ask, cancel, approve, decline), remove member, leave, transfer captaincy, delete team |
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
- **Forms and questions:** `TextField` (label, error message, password show/hide), `ConfirmDialog` ("Delete this team?" with Cancel and Confirm).

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
no user logged in  → AuthStack        (Login, role choice, Player/Owner register, Forgot password)
user.role PLAYER   → PlayerNavigator  tabs: My Teams · Explore · Notifications · Profile
user.role OWNER    → OwnerNavigator   tabs: My Venue · Explore · Notifications · Profile
user.role ADMIN    → AdminNavigator   tabs: Dashboard · Reports · Venues · Users · Teams
```

Each logged-in role gets a **bottom tab bar** (our own `TabBar` component), and **each tab has its own stack**. So when you open a team from My Teams, Team detail is put on top of the My Teams stack and the tab bar stays visible. Each tab remembers where you were: switching to Explore and back keeps you on Team detail. Tapping the tab you're already on takes you back to that tab's first screen.

What each tab holds today:
- **Player:** My Teams (your teams → team detail → invite players, transfer captaincy, edit team, request to join; create team), Explore, Notifications (for now the Invites screen, which opens Team detail), Profile (with a gear button in the header that opens Settings).
- **Venue owner:** My Venue (the owner profile, which shows the venue listing), Explore (read-only for owners), Notifications (for now just "No notifications yet."), Profile (for now the Settings screen).
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

When any request that carried the token gets a 401 (for example the token's 30 days are up, or the password was reset on another phone, which logs out every phone), the response interceptor in `api.js` tells `AuthContext`. It removes the saved token, clears `user` (so the app swaps to the login screen) and shows an alert: "Your session has expired. Please log in again." If several requests fail at once, the alert shows only once. **Log out** in Settings or on the admin dashboard also removes the saved token.

---

## 7. Key flows

### Registration and email verification

1. On the Login screen, the user taps **Signup**, picks Player or Owner, and fills in the form (`PlayerRegisterScreen.js` or `OwnerRegisterScreen.js`). _Until task F2.2 rebuilds these screens, sign-up from the app fails: the old screens don't send the Terms of Use agreement the backend now requires, and the backend never assumes it._
2. The app sends `POST /auth/register` with email, password, role, the short profile details and `acceptedTerms: true` (the ticked Terms box).
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
6. Clicking the link opens the backend in a browser. If the token isn't shaped like one the backend makes (64 lowercase hex characters), it shows an "Invalid or expired link" page without touching the database. It shows the same page if no user has that token's hash, or if the link is more than 24 hours old, with a hint to request a new email from the app's login screen. Otherwise it marks the user verified, clears the token and its expiry, and shows an "Email verified" page telling them they can now log in in the app.

### Editing a player profile

A player changes their details with `PATCH /players/me` (the Edit profile screen arrives with task F2.3).

1. The app sends every field each time: name, phone, position, height, weight and area. An optional field that's left out, empty or null is cleared.
2. Only player accounts may do this: anyone else gets 403 "Players only", checked before the fields are.
3. `updatePlayerProfileSchema` (`src/validation/playerSchemas.js`) checks the fields with the same rules as sign-up (`src/validation/profileFields.js`): a name of 2–50 characters, a Bangladeshi mobile number, a position from the list, height 100–250 cm and weight 30–200 kg (numbers, optional), and an area. The area is tidied first (spaces at both ends removed, and every run of spaces inside made one space) and must then be 2–40 characters; the letters stay as typed.
4. The profile is updated in one step, and the reply is the player's own profile, the same as `GET /players/me`. The new name shows straight away in `GET /auth/me` and in team lists. The email can't be changed here (not in v1.0).

### Editing a venue listing

A venue owner fills in or changes their listing with `PATCH /owners/me` (the Edit venue screen arrives with task F2.4). A new owner signs up with only the venue name, so this is where the rest of the listing comes from.

1. The app sends every field each time: venue name, phone, address, website and description. Only the venue name is required; an optional field that's left out, empty, only spaces or null is cleared.
2. Only venue owner accounts may do this: anyone else gets 403 "Owners only", checked before the fields are.
3. `updateVenueSchema` (`src/validation/ownerSchemas.js`) checks the fields: a venue name of 2–60 characters; a phone, if given, that's a Bangladeshi mobile number (no landlines in v1.0); an address of at most 200 characters; a website of at most 200 characters that is a real `http://` or `https://` link (`isWebLink` in `src/utils/links.js`: so "www.arena.com" or "javascript:…" are refused); and a description of at most 500. Spaces at both ends of each text are removed.
4. The listing is updated in one step, and the reply is the owner's own profile, the same as `GET /owners/me`. The venue lists show the new details straight away.

### Resending the verification email

1. If someone logs in with the right password before verifying, login replies "Please verify your email" (403). `LoginScreen.js` then shows a **Resend verification email** button.
2. The button calls `resendVerification()` in `AuthContext`, which sends `POST /auth/resend-verification` with the email. A missing, non-text or blank email is refused; otherwise it's lowercased and trimmed before the lookup.
3. If that account exists and isn't verified, the backend makes a new token (only its hash is saved, valid for 24 hours, replacing the old link) and emails a new link. It doesn't do this if it already sent one in the last 5 minutes.
4. The reply is always the same ("If that account needs verifying, we've sent a new email."), whether or not the account exists or is already verified, so it gives nothing away. The app shows that reply.

Known problems in this flow: see [ROADMAP.md](ROADMAP.md), Phases 1 and 2.

### Login

1. `LoginScreen.js` calls `login()` from `AuthContext`, which sends `POST /auth/login`.
2. The backend refuses a missing or non-text email or password, and a blank email. The email is lowercased and trimmed before the lookup, so capitals or stray spaces don't matter. An unknown email and a wrong password get exactly the same reply ("Invalid email or password"), so nobody can use the login screen to find out who has an account. Only after the password is confirmed correct does an unverified account get told to verify its email first. Otherwise it replies with a JWT and the user's details (see [section 4](#how-login-works)).
3. `AuthContext` saves the token and sets `user`. `AppNavigator` then switches to that role's screens.

### Password reset

1. The user enters their email on **Forgot Password**, or taps **Change Password** in Settings. The app sends `POST /auth/forgot`.
2. A missing, non-text or blank email is refused; otherwise it's lowercased and trimmed. If the email exists, the backend saves the hash of a new random reset token, which expires in 1 hour, and emails a link containing the token to `BACKEND_PUBLIC_URL/auth/reset-password-page?token=…`. If it already sent a reset email to that account in the last 5 minutes, it sends nothing new. The reply is the same in every case, whether or not the email exists.
3. The link opens a small web form served by the backend. It only shows the form if the token looks like one the backend makes (64 lowercase hex characters); anything else gets an "Invalid or expired link" page. The form submits the new password to `POST /auth/reset`.
4. The backend refuses a token that isn't plain text, and a new password that fails the same strength rule as registration. Otherwise it hashes the token, finds the user with that hash and an unexpired link, saves the new password hash, clears the token and its expiry, and marks the account verified. The reset proves the email works, so it also clears any leftover verification link.
5. Because the form is used in a browser, the replies are simple web pages, not raw JSON: "Password changed" on success; for a weak password, the rule plus a "Try again" link back to the form; for a bad or expired link, a message to request a new reset from the app. Requests sent as JSON still get JSON replies.

Known security problems in this flow: see [ROADMAP.md](ROADMAP.md), Phase 1.

### Changing the password while logged in

`POST /auth/change-password` (the Change password screen arrives with task F2.3). Any logged-in account can use it.

1. The app sends the current password and the new one.
2. `changePasswordSchema` checks that both are there, that the new one follows the same strength rule as sign-up (and is at most 72 bytes), and that it isn't the same as the current one.
3. The controller compares the current password with the stored hash. If it's wrong, the reply is 400 "Current password is incorrect". It's deliberately not 401: the app treats a 401 as "your session has expired" and logs out, and a typo shouldn't do that. Wrong attempts are rate-limited (see "Protection against abuse and leaks").
4. In one database update, it saves the new password's hash, raises the token version by one (so every other phone is logged out) and cancels any password reset link that was still waiting. The update only applies if the stored password hasn't changed since step 3, so two changes at the same moment can't both succeed.
5. The reply is `{ "message": "Password changed", "token": "…" }`: a fresh login token with the new version number. The app saves it, so this phone stays logged in.
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
| The database tables | `backend/prisma/schema.prisma`, then create a migration |
| Environment variables | `backend/.env` (never commit it) |
| The rules a setting must follow at startup | `backend/src/config/loadConfig.js` |
