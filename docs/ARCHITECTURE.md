# How Connect Arena Works

A beginner-friendly tour of the app as it exists today. Everything here was checked against the source code. When this file and the code disagree, the code wins: fix this file.

Known bugs and missing features are not explained here. They're tracked in [ROADMAP.md](ROADMAP.md).

> **Naming:** the app shows "ConnectArena" on its login screen. The code and the Android project still use the name `IndoorFootballApp`.

---

## 1. The big picture

Connect Arena is a mobile app for indoor football (futsal). Players build teams, venue owners list their indoor fields, and an admin looks after everything.

The project has two parts that live side by side:

- `IndoorFootballApp/`: the **mobile app** people install on their phone.
- `backend/`: the **server** the app talks to. It stores all the data in a database.

### The three roles

Every account has exactly one role, chosen when the account is created.

| Role | Who it is | What they can do today |
|---|---|---|
| **Player** | Someone who plays | Register, log in, view their profile, browse all teams, create a team, invite players to their team, remove players from their team, delete their team, accept or reject invites, browse all players and all venues |
| **Owner** | Someone who runs an indoor venue | Register, log in, view their venue profile, browse all teams and all registered venues |
| **Admin** | The person running the app | See counts (users, players, owners, teams), list and delete users, list and delete teams, list venues |

Admin accounts can't be created from the app. They're made with a script (see [section 8](#8-configuration)). Deleting a venue from the admin screen currently fails. See [ROADMAP.md](ROADMAP.md), Phase 2.

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
- **SMTP** is the standard way programs send email. The backend logs in to a Gmail account to send mail. Mail to `@example.com` addresses is never sent, only logged. That domain is reserved and can't receive mail, and the automated tests use it for their throwaway users.

Right now the backend and database run on the developer's own computer. Phones reach them only through the ngrok address.

---

## 3. A request's journey: a player creates a team

Here's what happens, step by step, when a player creates a team.

**On the phone**

1. The player opens **All Teams** and taps **+ Create Team**.
   File: `IndoorFootballApp/src/screens/Team/TeamsListScreen.js`. It asks the navigator to show the `CreateTeam` screen.
2. They type a name and description and tap the button.
   File: `src/screens/Team/CreateTeamScreen.js`. The `onCreate` function checks that the name isn't empty, then calls `api.post('/teams/create', { name, description })`.
3. Before the request leaves the phone, the shared API helper adds the login token.
   File: `src/api/api.js`. An **interceptor** (a function that runs on every request) reads the token from storage (`src/utils/storage.js`) and adds the header `Authorization: Bearer <token>`.
4. The request travels over HTTPS to the ngrok address, which forwards it to the backend on port 4000.

**On the server**

5. `backend/src/server.js` receives it. `express.json()` turns the JSON body into a JavaScript object. The `/teams` prefix sends it to the teams router.
6. `backend/src/routes/teamRoutes.js` matches `POST /create` and runs two functions in order: `verifyToken`, then `createTeam`.
7. `backend/src/middleware/auth.js`: `verifyToken` checks the token is genuine and not expired. If it's fine, the user's id and role go into `req.user`. If not, the request stops with a 401 ("not logged in") error.
8. `backend/src/controllers/teamController.js`: `createTeam` uses Prisma to save the team. In one step it creates the `Team` row and a `TeamMember` row that makes the creator the team's captain (`role: 'captain'`, `status: 'accepted'`).
9. Prisma turns that into SQL and PostgreSQL stores both rows.

**Back to the phone**

10. The server replies with status 201 ("created") and the new team as JSON.
11. `CreateTeamScreen` shows a "Team Created" alert and goes back. All Teams reloads its list every time it comes back into view, so the new team appears.

If anything fails, the server replies with an error message and the screen shows it in an alert.

---

## 4. Backend

The backend is an **Express** app. Express is a small Node.js library for building web servers: you tell it "when a request comes in for this address, run this function". The code uses modern `import`/`export` syntax (ES modules).

### Folder layout

```
backend/
├── src/
│   ├── server.js        starts the server and connects the routers
│   ├── routes/          which address goes to which function
│   ├── controllers/     the functions that do the work
│   ├── middleware/
│   │   ├── auth.js          login, admin and player-only checks
│   │   ├── rateLimits.js    limits on repeated login, register and password-reset requests
│   │   └── errorHandler.js  turns any unhandled error into a short generic reply
│   └── utils/           shared helpers: the password rule, HTML escaping, token format, email templates
├── prisma/
│   ├── schema.prisma    the database tables, described in code
│   └── migrations/      the history of changes to the tables
├── scripts/
│   └── createAdmin.js   creates an admin account
├── tests/               automated tests (run with `npm test` while the server is running)
└── testFlow.js          an old end-to-end test script
```

`testFlow.js` is out of date and fails. See [ROADMAP.md](ROADMAP.md), Phase 2.

Three terms used in this layout:

- **Route:** a rule linking an address and method (like `POST /teams/create`) to the code that handles it.
- **Controller:** the function that does the real work for a route: it reads the request, talks to the database and sends a reply.
- **Middleware:** a function that runs *before* the controller, for example to check the user is logged in. It can let the request continue or stop it.

### The five routers

`server.js` connects each address prefix to a router file. Each router file uses the controller with the same name.

| Prefix | Route file | What it handles |
|---|---|---|
| `/auth` | `authRoutes.js` | Register, log in, verify email, forgot/reset password (no login needed) |
| `/players` | `playerRoutes.js` | My player profile, my pending invites, list all players, a player's stats |
| `/owners` | `ownerRoutes.js` | My owner profile, list all registered venues |
| `/teams` | `teamRoutes.js` | Create, list, my teams, invite, accept, reject, remove member, delete team |
| `/admin` | `adminRoutes.js` | Stats, list/delete users, list/delete teams, list/delete venues (admins only) |

There's also `GET /`, which replies "API running" so you can check the server is up.

Route order matters in `playerRoutes.js`: `/me` and `/invites` come before `/:id`. Otherwise Express would treat the word "me" as a player id.

### How login works

The backend uses a **JWT** (JSON Web Token): a signed piece of text that proves who you are, a bit like a stamped wristband at an event.

1. The app sends email and password to `POST /auth/login`.
2. The controller looks up the user and compares the password with the stored **hash** using **bcrypt**. A hash is a scrambled one-way version of the password, so the real password is never stored. bcrypt is the library that creates and checks these hashes. If the email doesn't exist, it still compares against a fixed dummy hash, so an unknown email takes as long as a wrong password and the timing gives nothing away. Only after the password matches does it check that the account is verified.
3. If everything matches, the server creates a JWT containing the user's id, role and email, signed with the secret `JWT_SECRET`. It's valid for 7 days.
4. The reply contains the token plus basic user info (id, name, email, role).

From then on, the app sends the token with every request, and `verifyToken` checks it.

### How permissions work

There are four layers of checks:

- **Logged in?** `verifyToken` runs on every route except `/auth`.
- **Admin?** The `isAdmin` middleware runs on every `/admin` route. It rejects anyone whose token role isn't `ADMIN`.
- **Player?** The `playersOnly` middleware runs on creating a team, inviting, accepting and rejecting. Venue owner and admin accounts get a 403 saying only player accounts can create or join teams.
- **Everything else** is checked inside the controllers. For example, `/players/me` refuses non-players, and inviting, removing or deleting in a team is refused unless you created that team.

Known security problems in these checks: see [ROADMAP.md](ROADMAP.md), Phase 1.

### Protection against abuse and leaks

- **Security headers (helmet).** `server.js` uses the `helmet` library, which adds standard protective headers to every reply. One of them is a content security policy, a rule list telling browsers what a page may load or do. The defaults work for the reset-password page, because its form posts back to the same site and it uses no inline scripts or styles.
- **Rate limits (express-rate-limit).** Too many requests get a 429 "too many attempts" reply. This stops password guessing and email spamming. In Bangladesh many phones on a mobile network can share one public address, so most limits count per address *and* email rather than per address alone (see DECISIONS.md, 2026-11-19):

  | Route | Limit |
  |---|---|
  | Login | Only **failed** attempts count: 10 per 15 minutes for one address + email, and at most 50 per 15 minutes for one address across all emails |
  | Register | 20 per hour per address |
  | Forgot password | 5 per hour for one address + email, and at most 20 per hour per address |
  | Reset (form submit) | 10 per 15 minutes per address |
  | Reset page and verify link (opened in a browser) | 30 per 15 minutes per address each |

  Emails are compared lowercased and trimmed. For IPv6, the whole /56 network counts as one address, because one connection usually owns a range of IPv6 addresses. Browser pages get a readable "Too many attempts" page instead of JSON. The counters are kept in memory, so they reset when the server restarts.
- **Trust proxy.** The backend is reached through ngrok, which passes each visitor's real address in the `X-Forwarded-For` header. `server.js` sets `trust proxy` to 1 (trust exactly one proxy), so Express reads the visitor's address from there. Without it, every visitor would look like ngrok and share one rate-limit counter. Trusting more than one hop would let visitors fake their address.
- **No internal details in errors.** When something fails, controllers pass the error to `errorHandler.js`. It logs the real error on the server and replies only "Something went wrong" (500), or "Invalid request body" (400) when the request body can't be read. Error messages, stack traces and database details never reach the client.

---

## 5. Database

The data lives in PostgreSQL. The backend talks to it through **Prisma**, an **ORM** (Object-Relational Mapper): a library that lets you read and write database rows with JavaScript code instead of writing SQL by hand.

The tables are described in `backend/prisma/schema.prisma`. Changes to that file reach the real database through **migrations**: small saved SQL scripts, one per change, applied in order so every copy of the database ends up with the same tables. They live in `backend/prisma/migrations/`.

### The tables in plain words

- **User:** one row per account. Holds the email, the hashed password, the role (`PLAYER`, `OWNER` or `ADMIN`), whether the email is verified, and temporary tokens for email verification and password reset.
- **PlayerProfile:** extra details for a player: name, phone, playing position, and optional height, weight and address. Each player has exactly one.
- **OwnerProfile:** extra details for a venue owner: indoor (venue) name, phone, address, and optional description and website. Each owner has exactly one.
- **Team:** a team's name, optional description, who created it (`ownerId`), and when.
- **TeamMember:** links a user to a team. It has a `role` (`captain` or `player`) and a `status`: `pending` means invited but not yet in, and `accepted` means in the team. A user can appear only once per team.

Admins have a User row but no profile.

### How they relate

```
                 ┌────────────────┐
     ┌── 0..1 ── │      User      │ ── 0..1 ──┐
     │           └───┬────────┬───┘           │
     ▼               │        │               ▼
PlayerProfile        │        │         OwnerProfile
                     │ owns   │ is a member through
                     ▼        ▼
                  ┌──────┐  ┌────────────┐
                  │ Team │◀─│ TeamMember │
                  └──────┘  └────────────┘
```

- A user has either a PlayerProfile or an OwnerProfile, depending on their role.
- A user can create (own) many teams.
- A team has many TeamMember rows, and a user can be a member of many teams.

The database doesn't delete linked rows automatically. When the code deletes a team or a user, it first deletes the linked rows by hand (members, then teams, then profiles, then the user).

### Two meanings of "owner"

This trips people up, so it's worth saying clearly:

1. **Owner the role** (`Role.OWNER`): a venue owner, a type of account.
2. **Team owner** (`Team.ownerId`): the *player* who created a team. They're also its captain.

When the code says "only the team owner can invite players", it means the team creator (a player), not a venue owner.

---

## 6. Mobile app

### Folder layout

```
IndoorFootballApp/
├── App.js               entry point: wraps everything in the login state
├── index.js             registers the app with React Native
├── src/
│   ├── api/api.js       shared helper for talking to the backend
│   ├── contexts/        AuthContext.js: who is logged in
│   ├── navigation/      which screens exist for each role
│   ├── screens/         one file per screen, grouped by area
│   │   (Auth, Player, Owner, Team, Admin)
│   └── utils/storage.js saves and reads the login token
├── android/             the native Android project
└── ios/                 the native iOS project
```

Some screen files aren't used by any navigator. See [ROADMAP.md](ROADMAP.md), Phase 2.

### How navigation switches by role

A **navigator** is the part of the app that decides which screen is showing and lets you move between screens. The app uses React Navigation and two kinds of navigator:

- A **stack navigator** works like a pile of cards: opening a screen puts it on top, and going back removes it.
- A **tab navigator** shows a bar at the bottom with icons you tap to switch screens.

The login state lives in a **context** (`AuthContext.js`). A React context is a value that any screen can read without passing it around by hand. It holds the current `user`, plus `login`, `logout` and `register` functions.

`src/navigation/AppNavigator.js` reads `user` from the context and picks a whole set of screens:

```
no user logged in  → AuthStack        (Login, role choice, Register, Forgot password)
user.role PLAYER   → PlayerNavigator
user.role OWNER    → OwnerNavigator
user.role ADMIN    → AdminStack       (Dashboard, Manage Users/Teams/Indoors)
```

Player and Owner use the same pattern: a stack whose first screen is a tab bar with **Profile** and **Settings**. The Profile screen has buttons that push other screens onto the stack. Players get Teams, My Teams, Players, Invites and Indoors. Owners get Teams and Indoors.

Because the screen set swaps as soon as `user` changes, logging in or out instantly moves you to the right part of the app.

### How the app talks to the backend

All requests go through `src/api/api.js`. It's a shared **axios** client (axios is a library for making web requests) with:

- the backend address. This is a hardcoded ngrok URL. The `process.env.API_URL` it checks first is never set in a React Native build.
- the interceptor that adds `Authorization: Bearer <token>` to every request when a token is saved.

### How the login token is stored

`src/utils/storage.js` saves the token in **AsyncStorage**, the phone's simple built-in key-value storage for the app, under the key `jwt`. Logging in saves it, and logging out removes it.

The user's details (name, role) are kept only in memory, so closing the app logs you out. See [ROADMAP.md](ROADMAP.md), Phase 2.

---

## 7. Key flows

### Registration and email verification

1. On the Login screen, the user taps **Signup**, picks Player or Owner, and fills in the form (`PlayerRegisterScreen.js` or `OwnerRegisterScreen.js`). The screen checks required fields, an 11-digit phone number, height and weight ranges (players only) and that the two passwords match. It doesn't check password strength; the backend does that.
2. The app sends `POST /auth/register` with email, password, role and the profile details.
3. The backend checks that the email is text, then the role, password strength (at least 8 characters with upper case, lower case, a number and a symbol), that the email is new, and the profile fields (phone, height and weight ranges).
4. It saves the User and their profile in a single step, with `verified` set to false and a random verification token.
5. It emails a link to `BACKEND_PUBLIC_URL/auth/verify?token=…` through Gmail.
6. Clicking the link opens the backend in a browser. If the token is missing, isn't a single piece of text, or doesn't match anyone, it shows an "Invalid or expired link" page. Otherwise it marks the user verified and shows an "Email verified" page telling them they can now log in in the app.

Known problems in this flow: see [ROADMAP.md](ROADMAP.md), Phases 1 and 2.

### Login

1. `LoginScreen.js` calls `login()` from `AuthContext`, which sends `POST /auth/login`.
2. The backend refuses a missing or non-text email or password. An unknown email and a wrong password get exactly the same reply ("Invalid email or password"), so nobody can use the login screen to find out who has an account. Only after the password is confirmed correct does an unverified account get told to verify its email first. Otherwise it replies with a JWT and the user's details (see [section 4](#how-login-works)).
3. `AuthContext` saves the token and sets `user`. `AppNavigator` then switches to that role's screens.

### Password reset

1. The user enters their email on **Forgot Password**, or taps **Change Password** in Settings. The app sends `POST /auth/forgot`.
2. A missing or non-text email is refused. If the email exists, the backend saves a random reset token that expires in 1 hour and emails a link to `BACKEND_PUBLIC_URL/auth/reset-password-page?token=…`. The reply is the same whether or not the email exists.
3. The link opens a small web form served by the backend. It only shows the form if the token looks like one the backend makes (64 lowercase hex characters); anything else gets an "Invalid or expired link" page. The form submits the new password to `POST /auth/reset`.
4. The backend refuses a token that isn't plain text, and a new password that fails the same strength rule as registration. Otherwise it finds the user with that unexpired token, saves the new password hash, clears the token and marks the account verified.
5. Because the form is used in a browser, the replies are simple web pages, not raw JSON: "Password changed" on success; for a weak password, the rule plus a "Try again" link back to the form; for a bad or expired link, a message to request a new reset from the app. Requests sent as JSON still get JSON replies.

Known security problems in this flow: see [ROADMAP.md](ROADMAP.md), Phase 1.

### Team invites

1. A team owner opens their team (**My Teams** → team → **Add Member**) and picks a player (`AddMemberScreen.js`).
2. The app sends `POST /teams/:teamId/invite`. The backend checks that the sender is a player account, that the player id is a positive whole number, that the sender created the team, that the invited person exists and is a player (otherwise 404 "Player not found"), and that they aren't already listed. It then adds a `TeamMember` row with status `pending`.
3. The invited player sees it in **Invites** (`InvitesScreen.js`, which calls `GET /players/invites`).
4. **Accept** (`POST /teams/:teamId/accept`) changes the status to `accepted`. **Reject** (`POST /teams/:teamId/reject`) deletes the row. Both only work on a `pending` row. If there's no pending invite for that player and team, they reply 404 "Invite not found".

The team owner can also remove a member (`DELETE /teams/:teamId/members/:userId`) or delete the whole team (`DELETE /teams/:teamId`).

### Join requests

There's currently no way to ask to join a team. The old `POST /teams/:teamId/join` endpoint was removed because it was a security hole: it created a `pending` row for the person asking, and since a join request looked exactly like an invite, that player could then "accept" it and join any team without the captain's approval. No screen used it. The join-request flow will be rebuilt in Phase 4, once the data can tell invites and join requests apart. See [ROADMAP.md](ROADMAP.md), Phase 4.

---

## 8. Configuration

The backend reads its settings from **environment variables**: named values set outside the code, so secrets aren't written into the source. They go in a file called `backend/.env`, which git ignores. The `dotenv` library loads that file at startup.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Where the PostgreSQL database is and how to log in to it (used by Prisma) |
| `JWT_SECRET` | The secret used to sign and check login tokens |
| `EMAIL_USER` | The Gmail address the backend sends email from |
| `EMAIL_PASS` | The password for that Gmail account |
| `BACKEND_PUBLIC_URL` | The backend's public address (the ngrok URL), used to build links in emails |
| `PORT` | Optional. The port the server listens on (4000 if not set) |
| `ADMIN_EMAIL` | Only used by `scripts/createAdmin.js`: the admin account's email |
| `ADMIN_PASSWORD` | Only used by `scripts/createAdmin.js`: the admin account's password |

The admin account comes from `node scripts/createAdmin.js`, run in `backend/`. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`, refuses to run if either is missing or the password fails the registration strength rule, and never prints the password. If an admin with that email exists, it changes that account's password, which is how you change the admin password. Otherwise it creates the admin. It won't turn an existing player or owner account into an admin, and it won't create a second admin, because the app has one admin account.

The mobile app has no config file. Its backend address lives in `IndoorFootballApp/src/api/api.js`.

---

## 9. Where to find things

| If you want to change… | Look in… |
|---|---|
| Which backend address the app uses | `IndoorFootballApp/src/api/api.js` |
| A screen's look or behaviour | `IndoorFootballApp/src/screens/<Area>/<Name>Screen.js` |
| Which screens a role can reach | `IndoorFootballApp/src/navigation/<Role>Navigator.js` (or `AdminStack.js`, `AuthStack.js`) |
| What happens on login or logout in the app | `IndoorFootballApp/src/contexts/AuthContext.js` |
| How the token is saved on the phone | `IndoorFootballApp/src/utils/storage.js` |
| A backend address (URL path) | `backend/src/routes/<area>Routes.js` |
| What a backend action actually does | `backend/src/controllers/<area>Controller.js` |
| The login check, admin check or player-only check | `backend/src/middleware/auth.js` |
| The rate limits (how many tries, how long) | `backend/src/middleware/rateLimits.js` |
| What clients see when something goes wrong | `backend/src/middleware/errorHandler.js` |
| Security headers (helmet) or the trust proxy setting | `backend/src/server.js` |
| Registration rules (phone, height, weight) | `backend/src/controllers/authController.js` (`register`), plus the register screens |
| The password strength rule (registration, reset and the admin script) | `backend/src/utils/password.js` |
| The text of the verification or reset emails | `backend/src/utils/emailTemplates.js` |
| The database tables | `backend/prisma/schema.prisma`, then create a migration |
| Environment variables | `backend/.env` (never commit it) |
