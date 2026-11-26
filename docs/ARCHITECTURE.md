# How ConnectArena Works

A beginner-friendly tour of the app as it exists today: the big picture, the main parts and the key flows, explained simply. The exact details (every endpoint, message, limit, helper and convention) are in the technical reference, [TECHNICAL.md](TECHNICAL.md); this tour links there instead of repeating them. Everything here was checked against the source code. When this file and the code disagree, the code wins: fix this file.

What the app *should* do is in [PRODUCT.md](PRODUCT.md). Known bugs and missing features are tracked in [ROADMAP.md](ROADMAP.md).

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
| **Player** | Someone who plays | Sign up, log in, see and edit their profile, change their password, delete their account; create a team, edit or delete it, invite players, remove members, hand over the captaincy, leave a team; accept or decline invites; ask to join a team (and cancel), and as captain approve or decline requests; see what needs their action and their updates on the Notifications screen; browse all teams, players and venues |
| **Owner** | Someone who runs an indoor venue | Sign up, log in, fill in and edit their venue listing, see their account, change their password, delete their account; see updates about their venue; browse all teams (read-only), players and venues |
| **Admin** | The person running the app | See counts (users, players, owners, admins, teams), list and delete users, teams and venues (deleting a venue deletes the owner's account; before deleting an account, the dialog says what happens to its teams and venue). Review venues: approve them, leave a note for the owner, move a live venue back to review. The admin screens can't delete the admin's own account or any admin account |

Admin accounts can't be created from the app. They're made with a script (see [section 8](#8-configuration)).

Still missing: the badge on the Notifications tab, reports and blocking, venue review and search. See [ROADMAP.md](ROADMAP.md), Phase 4.

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
 │  backend/, port 4000 │  email  │  verification, reset │
 │  Express + Prisma    │         │  and notice emails   │
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
- **SMTP** is the standard way programs send email. The backend logs in to a Gmail account to send mail, using the **nodemailer** library. Mail to `@example.com` addresses is never sent, only logged: that domain is reserved and can't receive mail, and the automated tests use it for their throwaway users.

Right now the backend and database run on the developer's own computer. Phones reach them only through the ngrok address.

---

## 3. A request's journey: a player creates a team

Here's what happens, step by step, when a player creates a team.

**On the phone**

1. The player taps **Create team** on **My Teams**, which opens the team form.
2. They type a name, optionally an area (where the team usually plays; common areas are suggested as they type) and a description, and tap **Create team**. The form (`src/screens/Team/TeamFormScreen.js`) first checks the same limits the backend will check, and shows any problem under the field. Then it calls `api.post('/teams/create', { name, description, area })`.
3. Before the request leaves the phone, the shared API helper (`src/api/api.js`) adds the login token. An **interceptor** (a function that runs on every request) reads the token from the phone's storage and adds the header `Authorization: Bearer <token>`.
4. The request travels over HTTPS to the ngrok address, which forwards it to the backend on port 4000.

**On the server**

5. `backend/src/server.js` receives it, turns the JSON body into a JavaScript object, and the `/teams` prefix sends it to the teams router.
6. `backend/src/routes/teamRoutes.js` matches `POST /create` and runs four functions in order: `verifyToken` (is this a real, current login?), `playersOnly` (is it a player account?), `validate` (is the input acceptable?), then `createTeam` (do the work).
7. If the login is missing or bad, the request stops with 401 ("not logged in"). A venue owner or admin stops with 403 ("not allowed").
8. If the name, description or area breaks a rule, the reply is 400 with one clear message, such as "Team name must be between 2 and 40 characters", and `createTeam` never runs.
9. `createTeam` (in `backend/src/controllers/teamController.js`) uses Prisma to save, in one step, the new team with the creator as its **captain**, and the captain's own membership row, so the captain is also a member.
10. Prisma turns that into SQL and PostgreSQL stores both rows.

**Back to the phone**

11. The server replies with status 201 ("created") and the new team.
12. The form is replaced by the new team's **Team detail** page (so Back goes to My Teams). My Teams reloads whenever it comes back into view, so the new team appears there too.

If anything fails, the server replies with an error message and the screen shows it. The exact rules for this endpoint: [TECHNICAL.md 6.4](TECHNICAL.md#64-teams).

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
│   ├── db.js            the one shared database connection (Prisma client) for the whole server
│   ├── routes/          which address goes to which function
│   ├── controllers/     the functions that do the work
│   ├── middleware/
│   │   ├── auth.js          the login check and the role checks (admin, player-only, one role)
│   │   ├── rateLimits.js    limits on repeated attempts (login, sign-up, emails, password changes)
│   │   ├── validate.js      checks a request against its rules before the controller runs
│   │   └── errorHandler.js  turns any unhandled error into a short generic reply
│   ├── validation/      the rules for each request (zod schemas): one file per router, plus shared pieces
│   └── utils/           shared helpers: the password rule, who may see what, emails, deleting users and
│                        teams, team membership, website links, checking ids, HTML escaping, tokens,
│                        email templates and sending, server-rendered pages
├── prisma/
│   ├── schema.prisma    the database tables, described in code
│   └── migrations/      the history of changes to the tables
├── scripts/
│   └── createAdmin.js   creates the admin account
└── tests/               automated tests (run with `npm test` while the server is running)
```

Three terms used in this layout:

- **Route:** a rule linking an address and method (like `POST /teams/create`) to the code that handles it.
- **Controller:** the function that does the real work for a route: it reads the request, talks to the database and sends a reply.
- **Middleware:** a function that runs *before* the controller, for example to check the user is logged in. It can let the request continue or stop it.

### The seven routers

`server.js` connects each address prefix to a router file. Each router file uses the controller with the same name (the `/legal` pages are fixed text, so they need none). The full list of endpoints is in [TECHNICAL.md section 6](TECHNICAL.md#6-endpoints).

| Prefix | What it handles |
|---|---|
| `/auth` | Sign up, verify the email, log in, resend the verification email, forgot and reset password (no login needed); who is logged in, and change password (login needed) |
| `/players` | My player profile and editing it, my invites, my join requests, the player list (search by name, filter by area and position), one player's public profile with their teams |
| `/owners` | My venue profile and editing the listing; the list of live venues (search by name, filter by area) and one venue's details |
| `/teams` | Create, the team list (search by name, filter by area), one team, edit, delete, invites and the search for players to invite, join requests, removing members, leaving, handing over the captaincy |
| `/notifications` | Everything the Notifications screen shows (what needs your action, and the newest updates), the number for its badge, and marking updates as read (players and venue owners only) |
| `/legal` | The Terms of Use and Privacy Policy pages (placeholder text until launch) |
| `/admin` | Counts (including how many venues wait for review), and listing and deleting users, teams and venues; reviewing venues: approve, note, move back to review (admin only) |

There's also `GET /`, which replies "API running" so you can check the server is up.

**Route order matters.** `/players/me` must come before `/players/:id` in the route file, otherwise Express would treat the word "me" as a player id. The same goes for `/teams/me`.

### How login works

The backend uses a **JWT** (JSON Web Token): a signed piece of text that proves who you are, a bit like a stamped wristband at an event.

1. The app sends email and password to `POST /auth/login`.
2. The backend looks up the user and compares the password with the stored **hash** using **bcrypt**. A hash is a scrambled one-way version of the password, so the real password is never stored. An unknown email gets exactly the same reply as a wrong password, and takes as long, so the login screen can't be used to find out who has an account. Only after the password matches does it check that the email is verified.
3. If everything matches, the server creates a token containing the user's id, role and the account's **token version**, signed with a secret only the server knows. It lasts **30 days**, so people on phones don't have to log in every week.
4. The app saves the token and sends it with every request. The backend checks it each time: it must be genuine, not expired, and its version must match the account's current version. The user's role is read fresh from the database each time, so a change takes effect at once.

**Logging out every phone at once.** A token is like a wristband with a number written on it. The account keeps the current number. When the password is reset (the "Forgot password" email) or changed while logged in, the number goes up by one. Every wristband with the old number stops working, so every phone that was logged in is logged out, including one that might belong to whoever learned the old password. A password change while logged in also hands the phone that made it a new wristband straight away, so that phone stays logged in. Later, a suspension by the admin will do the same (DECISIONS.md, "Which events log out every device"). Normal **Log out** only deletes the token on that one phone.

Details (token contents, which routes need a login, the exact checks): [TECHNICAL.md 5.1](TECHNICAL.md#51-login-tokens-and-verifytoken).

### How permissions work

Every request passes a few layers of checks:

- **Logged in?** Every route needs a valid login token, except signing up, logging in, the email links, the password-reset pages, the legal pages and `GET /`.
- **Admin?** Every `/admin` route is for the admin only.
- **Player?** Every team action (creating, joining, inviting, leaving and so on) is for player accounts only: venue owners and the admin get 403 "only player accounts can create or join teams".
- **The right role?** Editing a player profile is for players, editing a venue listing for venue owners. The wrong role always gets 403, whatever it sends.
- **The captain?** Team actions like inviting, removing a member or deleting the team are refused unless you're that team's current captain.

The exact list of which check guards which route: [TECHNICAL.md 5.2](TECHNICAL.md#52-role-checks). Known security problems: [ROADMAP.md](ROADMAP.md), Phase 1.

### Who can see what (profile visibility)

The backend decides which fields each person may see, following "Profile visibility" in [PRODUCT.md](PRODUCT.md). Hiding fields only in the app isn't enough, because anyone can read what the backend sends. The rules live in one file, `src/utils/visibility.js`, and every endpoint that returns user or profile data passes it through that file.

| What | Who sees it |
|---|---|
| Everything about an account | The user themselves and the admin |
| A player's name, position, and height, weight and area (each only if set) | Any logged-in user. The area is a general area like "Dhanmondi 27", never a full address |
| A player's phone | Only accepted teammates. The backend sends it with a player's profile (`GET /players/:id`), and Player detail shows it with a line saying why, tap to call |
| Email | Only the user themselves and the admin |
| A venue listing (name, area, address, phone, website, opening hours, pricing info, description) | Any logged-in user, once the admin has approved it: it's a business listing. The owner's login email, the review status and the admin's note stay hidden |
| Password hashes and email-link tokens | Nobody, ever |

Hidden fields are simply left out of the reply. The helpers: [TECHNICAL.md 4.6](TECHNICAL.md#46-profile-visibility).

**Who can be found.** A second small file, `src/utils/discovery.js`, decides which players show up in a list or a search at all: player accounts with a profile whose email is verified, and never the person who is looking. The player list and the search a captain uses to invite players both ask it, so the two always agree. Blocked and suspended players will be left out in the same place (moderation feature).

### How requests are checked (validation)

Anyone can send the backend anything, not only the app: a missing field, a number where text belongs, a list, an object, or text thousands of characters long. Two things go wrong if that reaches the database unchecked. An object like `{"not": ""}` can be read by Prisma as a *query instruction* instead of a value, which once allowed an account takeover. And a wrong type makes Prisma fail, which shows up as a 500 "Something went wrong".

So every request that sends data is checked **before** its controller runs. The rules are written as **schemas** with the **zod** library (one file per router in `src/validation/`). A schema says, field by field, what's allowed: "name: text, trimmed, 2 to 50 characters". If something is wrong, the reply is 400 with **one** short message, the first problem found, and the app shows it. If everything is fine, the cleaned values go to the controller, which uses only those. Fields the rules don't mention are simply dropped.

Text limits count characters the way people see them, so a Bangla name isn't counted as longer than it looks. How it works in code: [TECHNICAL.md 4.2](TECHNICAL.md#42-validation-zod).

### Protection against abuse and leaks

- **Security headers.** The `helmet` library adds standard protective headers to every reply, including a rule list telling browsers what a page may load.
- **Rate limits.** Too many attempts get a 429 "too many attempts" reply, which stops password guessing and email spamming. For example, 10 failed logins in 15 minutes for one email from one address. In Bangladesh many phones on a mobile network share one public address, so most limits count per address *and* email rather than per address alone (DECISIONS.md, 2026-11-19). The full table: [TECHNICAL.md 5.3](TECHNICAL.md#53-abuse-protection).
- **Email cooldown.** A reset or verification email isn't sent again to the same account within 5 minutes, however many times someone asks.
- **Email-link tokens are stored scrambled.** The links in verification and reset emails carry a long random token. The database keeps only a fingerprint of it (a **SHA-256 hash**), so if the database ever leaked, the stored values couldn't be used as working links.
- **The real visitor address.** The backend is reached through ngrok, which passes on each visitor's real address. The server is told to trust exactly one proxy, so it reads that address correctly. Otherwise every visitor would look like ngrok and share one rate-limit counter.
- **No internal details in errors.** When something fails, the server logs the real error and replies only "Something went wrong". Error messages, stack traces and database details never reach the app.
- **Ids in addresses are checked.** An id in an address (like the `5` in `/teams/5/invite`) must be a positive whole number small enough for the database, or the reply is 400.

---

## 5. Database

The data lives in PostgreSQL. The backend talks to it through **Prisma**, an **ORM** (Object-Relational Mapper): a library that lets you read and write database rows with JavaScript code instead of writing SQL by hand. (One list is the exception: the teams in Explore are read with one hand-written SQL query, because their order, teams with a free spot first, is something Prisma can't sort by. Whatever a person types into the search is always sent to the database separately from the SQL text, so it can only ever be text to look for.) The whole server shares **one** Prisma client (in `backend/src/db.js`), because each client keeps its own pool of open connections and databases limit how many you get.

The tables are described in `backend/prisma/schema.prisma`. Changes to that file reach the real database through **migrations**: small saved SQL scripts, one per change, applied in order so every copy of the database ends up with the same tables. They live in `backend/prisma/migrations/`.

### The tables in plain words

- **User:** one row per account: the email, the hashed password, the role (player, owner or admin), whether the email is verified, the temporary email-link tokens (scrambled), the **token version** (see "How login works") and when the user accepted the Terms at sign-up.
- **PlayerProfile:** a player's name, phone, position (one of Goalkeeper, Defender, Midfielder, Forward or Any), and optional height, weight and **area** (their neighbourhood, never a full address). Each player has exactly one.
- **OwnerProfile:** a venue owner's venue name, and optional phone, address, area, website, description, opening hours and pricing info. A new owner signs up with only the venue name and fills in the rest later. It also records whether an admin has approved the venue (and when), and the admin's note to the owner while it waits for review. Each owner has exactly one.
- **Team:** a team's name, optional description, optional **area** (where it usually plays, like "Mirpur"), its **captain** and when it was created. The creator becomes the captain. The captain is recorded in one place only, so a team can never have two captains or none.
- **TeamMember:** links a player to a team. Its **status** is either *pending* (invited, or asked to join, but not in yet) or *accepted* (in the team). It also records how it started (an invite, a join request, or the captain's own row), when it was created, when the player actually joined, and a join request's optional message to the captain. Only accepted rows count as membership.
- **Notification:** one update for one user ("You were removed from Alpha FC"): what happened, the names as they were at that moment, and whether it has been read. One helper adds these rows and keeps each user's newest 50 (see "Updates" below). The team actions, the deletions and the admin's venue decisions create them, and the app shows them on the Notifications screen.

Admins have a User row but no profile. Every field, enum and migration: [TECHNICAL.md section 7](TECHNICAL.md#7-data-model).

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
- A user can captain many teams.
- A team has many TeamMember rows, and a player can be a member of many teams.
- A user can have many Notification rows (not drawn above). They only note the ids of the team and player they mention, so those can be deleted freely.

**Deleting safely.** The database has delete rules as a safety net: deleting a user also deletes their profile, memberships and notifications, and deleting a team deletes its memberships (this is called **cascade**). But it **refuses** to delete a user who is still captain of a team, so a team is never left without a captain. The code doesn't rely on cascade: it deletes the linked rows itself, in order, inside one **transaction**. A transaction means the database either does every step or, if one fails, undoes the ones already done, so nothing is ever left half-deleted. All of this lives in one file, `src/utils/deletion.js`.

**Deleting a user.** A captain's teams don't disappear with them: each team is handed to its longest-standing member, with its pending invites and requests, and is only deleted when nobody else is in it. The same function first works out a **plan** of what will happen to each team; the preview shows that plan and the delete carries it out. While it runs, every team the user has anything to do with is locked, and so is the user, so nobody can make them captain halfway through. In the same step it tells the people it affects: each new captain, the players with an invite or request to a deleted team, and the captains of the user's other teams ("A member left your team …", without a name). The user's own updates go, and so do the updates other people keep that name them, so their name doesn't stay behind. The admin's delete buttons use it, and so does deleting your own account (see [Deleting your account](#deleting-your-account)), which also asks for the password. If a team changed since the preview, nothing is deleted and the new outcome is shown first. Afterwards a short notice email, with no link, goes to the account's address (if it was ever verified); an email that fails never undoes the deletion.

**Updates.** Everything that tells a user something goes through one function, `createUpdates` in `src/utils/notifications.js`. It runs inside the same transaction as the action itself, so a failed action never leaves an update behind and a successful one always has its update. It never tells people about their own action, and it removes whatever is beyond a user's newest 50 in the same step. While it works it locks the rows of the people it tells, so two actions telling the same person at once can't leave 51.

**The team lock.** Every change to a team's members (invite, accept, approve, leave, hand over the captaincy…) first locks that team's row, so two changes to the same team run one after the other. That's what makes the 15-member limit safe: two approvals at the same moment can't both squeeze in.

### Two meanings of "owner"

This used to trip people up. "Owner" now means only one thing:

1. **Owner the role**: a venue owner, a type of account.
2. The *player* who runs a team is the **captain**, everywhere: in the database, the API and the app. The code used to call this the "team owner"; that's gone.

When the code says "only the team captain can invite players", it means the team's captain (a player), not a venue owner.

---

## 6. Mobile app

### Folder layout

```
IndoorFootballApp/
├── App.js               entry point: wraps everything in the theme and the login state,
│                        and sets the status bar (always white icons)
├── index.js             registers the app with React Native
├── __tests__/           Jest tests, one file per area (components, screens, navigation, checks)
├── assets/fonts/        Barlow Condensed and Inter font files, with their licenses
├── assets/icons/        PNG images (the ball logo on the Login screen)
├── src/
│   ├── api/api.js       shared helper for talking to the backend
│   ├── components/ui/   shared building blocks screens are made from (see "Shared components")
│   ├── constants/       fixed lists: the positions and the area suggestions
│   ├── contexts/        AuthContext.js: who is logged in
│   ├── hooks/           useBusyAction.js: stops a button sending its request twice
│   │                    usePagedList.js: a list that loads in pages, with its search
│   │                    useTryAgain.js: Try again always shows its spinner for a moment
│   ├── navigation/      which screens exist for each role
│   ├── screens/         one file per screen, grouped by area (Auth, Player, Owner, Team, Venue,
│   │                    Admin, Shared for Explore, Settings and Change password, Dev for the
│   │                    UI gallery),
│   │                    plus a few helper files next to the screens that use them
│   ├── theme/           the look: colours, fonts, sizes (see "The theme")
│   └── utils/           saving the login token, and checks repeated from the backend
│                        (phone numbers, passwords, website links)
├── android/             the native Android project
└── ios/                 the native iOS project
```

### The theme (colours, fonts and sizes in one place)

The app's look lives in one folder, `src/theme/`, as named values called **tokens**: `colors.accent` is the lime green, `spacing.screenPadding` is the space at the sides of a screen, `typography.display` is the big screen-title text style. Screens use these names instead of writing colours or sizes themselves, so changing the look later means editing the theme folder, not every screen. The full design is in [DESIGN.md](DESIGN.md).

- **Two colour layers.** One file holds the actual colours with plain names (`lime`, `nearBlack`); another gives them meanings (`accent`, `bg`, `danger`). Screens only use the meanings.
- **Text styles** bundle a font, size, line height and letter spacing. Headings are always uppercase. Each font weight is its own font file, because Android picks a custom font's weight by file.
- **Spacing, corner roundness, sizes and shadows** have their own token files too.
- A screen reads the theme with `const { colors, spacing } = useTheme();`. There's only one theme (dark), but because screens ask for it this way, a light theme could be added later without editing them.

The status bar always shows white icons on the dark background, and Android's own window behind the app is dark too, so no white flash shows while the app starts. The token files and their values: [TECHNICAL.md 8.1–8.2](TECHNICAL.md#82-theme).

**Not every screen uses the new look yet.** Two admin screens (Users and Teams) still have their old light styles and icons; they're restyled later (ROADMAP Step 4). Everything players and venue owners see is built in the new design.

### Shared components

Screens are built from ready-made pieces in `src/components/ui/`, so each piece looks the same everywhere and is styled in one place. A screen imports them from one place: `import { Screen, Text, Button } from '../../components/ui';`.

- **Layout and text:** `Screen` (the dark background, side padding, room for the status bar, optional scrolling), `Text`, `ScreenHeader`, `SectionHeader`, `Divider`, `TabBar` (the bottom tab bar), `SectionTabs` (switches between the sections of one screen, like Explore's).
- **Actions:** `Button` (main, secondary or danger; with a `loading` state that shows a spinner and ignores taps while a request runs), `IconButton`, `TextLink`, `BackLink`.
- **Content:** `Card`, `ListRow`, `Avatar` (initials in a circle), `Pill`, `Badge`, `NoticeLine` ("● 2 join requests waiting for you"), `EmptyState`, `Icon`.
- **Forms and questions:** `TextField`, `Checkbox` (the Terms box at sign-up), `OptionGroup` (pick one of a few choices, like the position), `SuggestionField` (suggests common values as you type, like areas; any other text is still allowed), `ConfirmDialog` ("Delete this team?" with Cancel and Confirm).

They take their colours, fonts and sizes only from the theme, and a test fails if a file in the folder contains a colour code or a font name, so that rule can't slip. What each one takes: [TECHNICAL.md 8.3](TECHNICAL.md#83-shared-components).

**UI gallery (development only).** In a development build, the Login screen has a small "UI gallery" link that opens a screen showing every component in its states. Release builds don't contain it at all.

### Icons

Icons come from **Lucide**, a free set of line icons. Screens never use Lucide directly: they use our own `Icon` component with our own names, for example `<Icon name="teams" />`, and `src/components/ui/Icon.js` is the one file that knows which Lucide icon each name means. If the icon set ever changes, only that file changes. The list of names is in [DESIGN.md](DESIGN.md) section 7. An icon that means something on its own (an icon-only button) gets a label so screen readers can announce it.

### How navigation switches by role

A **navigator** is the part of the app that decides which screen is showing and lets you move between screens. The app uses React Navigation and two kinds of navigator:

- A **stack navigator** works like a pile of cards: opening a screen puts it on top, and going back removes it.
- A **tab navigator** shows a bar at the bottom with icons you tap to switch screens.

The login state lives in a **context** (`AuthContext.js`). A React context is a value that any screen can read without passing it around by hand. It holds the current `user` and the functions to log in, log out, sign up, change the password and delete the account.

`src/navigation/AppNavigator.js` reads `user` from the context and picks a whole set of screens:

```
no user logged in  → AuthStack        (Login, role choice, Player/Owner sign-up, Check your email, Forgot password)
user.role PLAYER   → PlayerNavigator  tabs: My Teams · Explore · Notifications · Profile
user.role OWNER    → OwnerNavigator   tabs: My Venue · Explore · Notifications · Profile
user.role ADMIN    → AdminNavigator   tabs: Dashboard · Reports · Venues · Users · Teams
```

Because the screen set swaps as soon as `user` changes, logging in or out instantly moves you to the right part of the app.

Each logged-in role gets a **bottom tab bar**, and **each tab has its own stack**. So when you open a team from My Teams, Team detail is put on top of the My Teams stack and the tab bar stays visible. Each tab remembers where you were, and tapping the tab you're already on takes you back to its first screen.

What each tab holds today:
- **Player:** My Teams (your teams and join requests → Team detail → invite players, hand over the captaincy, edit team, or tap a person to open their Player detail; create team), Explore, Notifications (what needs your action and your updates; see [Notifications](#notifications)), Profile (your details with Edit profile, and a gear that opens Settings: Edit profile, Change password, the Terms of Use and Privacy Policy pages, Log out and Delete account).
- **Venue owner:** My Venue (the listing, with Edit venue), Explore (teams read-only, players and venues), Notifications (updates about your venue), Profile (the account: venue name, "Venue owner" and email, a link to My Venue, and the gear to Settings, where **Edit venue** replaces Edit profile).
- **Admin:** Dashboard (how many venues are waiting for review, which opens the Venues tab, and the totals), Reports (for now just "Reports arrive with moderation."), Venues (the venue review, see "Venue review"), Users and Teams (the old management screens).
- **Explore** (players and owners) is one screen with three sections, Teams, Players and Venues (see "Explore").

These "for now" screens are placeholders that later features replace (PRODUCT.md, "App structure and navigation"). A screen can only open screens in its own stack, so the team screens are added to every stack that can open a team. Route names and stacks: [TECHNICAL.md 8.5](TECHNICAL.md#85-navigation).

**Android back button:** inside a tab it goes back one screen in that tab. On the first screen of any other tab, it goes to the first tab. On the first tab's first screen, it leaves the app.

### How the app talks to the backend

All requests go through `src/api/api.js`, a shared **axios** client (axios is a library for making web requests). It holds the backend address, which is a hardcoded ngrok URL, adds the login token to every request, and notices when a reply says the login is no longer valid (see below).

The login token is saved in **AsyncStorage**, the phone's simple built-in storage for the app (`src/utils/storage.js`). The user's details are kept in memory, and the token stays saved until you log out, so closing the app doesn't log you out.

### App start: restoring the login

1. The app looks for a saved token. With none, the login screen shows.
2. With a token, a plain loading view shows while the app asks the backend who the token belongs to (`GET /auth/me`).
3. If that works, the app opens on the right screens for the role.
4. If the backend says the token is no good (401), it's removed and the login screen shows.
5. Any other failure (no connection, the ngrok tunnel down, a server error, taking too long) keeps the token and shows **"Can't reach the server"** with a **Retry** button. Being offline never logs you out by itself, but a small **Log out** link under Retry removes the saved token.

### Expired or invalid login while using the app

When a request that carried the token gets a 401 (for example the token's 30 days are up, or the password was changed or reset on another phone), the app removes the saved token, switches to the login screen and shows "Your session has expired. Please log in again." once. One exception: right after a password change, the app has just saved a fresh token, so a 401 for a request sent a moment earlier with the old token is ignored, and the phone that changed the password stays logged in. Another: while this phone is deleting its own account, "Your session has expired" isn't shown, because "Your account was deleted." is on its way. Details: [TECHNICAL.md 8.6](TECHNICAL.md#86-talking-to-the-backend-the-login-and-the-session).

---

## 7. Key flows

Each flow below says what the person sees and what happens behind it. The exact rules, messages and replies are in [TECHNICAL.md section 6](TECHNICAL.md#6-endpoints) (endpoints) and [section 8.8](TECHNICAL.md#88-screens) (screens).

**Two habits every rebuilt screen shares:** problems found before sending show under the field they belong to (and long forms scroll up to the first one). And on every screen, a button that sends a request shows a spinner while it runs and ignores a second tap, even two taps in the same instant: they all use one shared helper, `useBusyAction`.

### Registration and email verification

1. On the Login screen, the user taps **Create an account**, picks **I'm a player** or **I run a venue**, and fills in the short form. A player gives their name, email, phone, position (picked from five buttons) and a password twice; a venue owner gives only the venue name, email and a password twice. Both tick the **Terms** box; its two links open the Terms of Use and Privacy Policy pages in the phone's browser.
2. The form checks every field with the backend's own rules first. The phone number is tidied (spaces, dashes and a leading +88 removed, so "+880 1712-345678" is sent as "01712345678"). Create account stays tappable when the Terms box is unticked and then shows the error under the box.
3. The app sends `POST /auth/register`. The backend checks everything again, in a fixed order so the first problem's message comes back, and refuses an email that's already registered.
4. It saves the new account (not yet verified) with its profile, and emails a verification link through Gmail. The link works for 24 hours. If the email can't be sent, the account still exists and the app says so.
5. The app shows **Check your email**, with **Resend email** and **Back to log in**.
6. Clicking the link opens the backend in a browser, which marks the account verified and shows "Email verified": the user can now log in. An old or broken link shows "Invalid or expired link", with a hint to ask for a new email from the app.

### Login

1. The user types their email and password and taps **Log in** (`POST /auth/login`).
2. A wrong password and an unknown email get the same "Invalid email or password". With the right password but an unverified email, the screen says "Your email isn't verified yet" and shows a **Resend verification email** button.
3. On success the app saves the token and switches to that role's screens.

### Resending the verification email

The **Resend verification email** button (on Login and on Check your email) asks the backend for a new link. If the account exists and isn't verified yet, a new link is emailed (not more than once every 5 minutes) and the old one stops working. The reply is always the same, whether or not the account exists, so it gives nothing away.

### Password reset (forgot password)

1. The user taps **Forgot password?** on Login and enters their email (or, when logged in, taps **Forgot your current password?** on Change password, which uses the account's own email). The screen then says a link has been sent if the email has an account. The reply is the same whether or not it does.
2. If the account exists, the backend emails a link that works for 1 hour.
3. The link opens a small web page served by the backend, where the user types a new password (with the same strength rule as sign-up).
4. Saving it changes the password, logs out every phone (the token version goes up), and marks the email as verified, since the reset proved it works.

### Changing the password while logged in

1. **Profile → Settings → Change password** (players and venue owners). The user types their current password and the new one twice; the screen checks them first.
2. The backend checks the current password. If it's wrong, the error shows under that field. That reply is deliberately not a 401, because the app treats every 401 as "your session has expired" and a typo shouldn't log anyone out.
3. On success the backend saves the new password, logs out every *other* phone, and sends this phone a fresh token, which the app saves at once. The app shows "Password changed: You're still logged in on this phone. Any other phones have been logged out."
4. The backend also emails a short notice: the password was changed, and if it wasn't you, use Forgot password. The email has no link in it (links in "your account changed" emails are what phishing copies).

### Deleting your account

1. **Profile → Settings → Delete account** (players and venue owners; the last and only red button). The screen first asks the backend what will happen, and shows it: what goes, and for a captain what happens to each team ("Dhanmondi Strikers will be handed to Rahim").
2. The user types their password, taps **Delete account** and confirms once more. The app sends the password and a code that stands for the outcomes it showed.
3. A wrong password shows under the field, and the user stays logged in. If a team changed in the meantime, nothing is deleted: the app says so and shows the new outcome.
4. On success the account is gone, the app forgets the login and shows the Login screen with "Your account was deleted." Any other phone is logged out on its next request. What the backend does is under "Deleting a user" in [section 5](#5-database).

The admin deletes an account the same way, from the **Users** tab or a venue's review screen, without a password: the dialog opens once the same preview has loaded, lists the same outcomes ("Mirpur Mavericks will be deleted (they're the only member)"), and shows the new ones if something changed meanwhile.

### Editing a player profile

The **Profile** tab shows the player's name, position, area, height, weight, phone and email. Anything not filled in says "Not added", and the phone and email say who can see them. **Edit profile** changes them: while typing an area, common areas are suggested; the phone is tidied like at sign-up; height and weight are optional. The app sends every field each time (`PATCH /players/me`), and the new name shows everywhere straight away. The email can't be changed yet.

### Venue review (admin)

A new venue starts as **Pending review**: players can't find it yet. The admin sees the waiting venues first and approves one only when its address, area and phone are filled in and its owner has verified their email; the backend refuses otherwise and says what's missing. While a venue waits, the admin can leave the owner a short note ("Please add the road number"), which the owner sees on My Venue. Approving makes the venue live at once and clears the note. A live venue can be moved back to review, with a note saying why: it disappears from discovery until the admin approves it again. Approving and moving back each create an update for the owner, in the same step (nothing shows it yet). In the app, the admin's **Dashboard** shows how many venues are waiting, and tapping it opens the **Venues** tab: the waiting venues first (each saying what's missing, or "Complete", and whether the owner has verified their email), then the live ones. Each opens a review screen with the whole listing. There, **Approve** stays greyed out, with the reason under it, until the venue is complete and its owner verified; the note has its own field and Save button; a live venue has **Move back to review**, which asks for the note and then for a confirmation. If the venue changed in the meantime (the owner emptied a field, say), the backend refuses, the app says "Something changed" with the reason and reloads. The owner sees the status, the note and the checklist on My Venue.

### Finding a venue

**Explore → Venues** lists the live venues from A to Z, one card each with the name, the area and the opening hours. There's a search by name and an area filter (with the same suggestions as everywhere else). The app doesn't filter the list itself: it asks the backend (`GET /owners`), which does the matching, ignoring capitals and matching part of the text. It works like Explore's other two sections (see "Explore").

Tapping a venue opens **Venue detail**: the listing without empty rows. Tapping the phone opens the phone's dialler, and the website opens in the browser only if it's a real `http://` or `https://` link. If the venue has gone (deleted, or the admin moved it back to review), the screen says "This venue isn't available any more." Venue owners see the same screens as players; a pending venue never shows up, not even its owner's.

### Editing a venue listing

**My Venue** shows the venue name with its status, "Live" or "Pending review". While the venue is pending it also shows the admin's note (if there is one) and a checklist of the three things it needs before it can go live (address, area and phone, each "Added" or "Missing"); the backend sends that list, so the app never decides on its own what "complete" means. Then the listing: phone, address, area, website, opening hours, pricing info and description, with "Not added" for anything empty. The website is a tappable link only if it's a real `http://` or `https://` address. **Edit venue** (from My Venue, or Profile → Settings) changes them: only the venue name is required, the area suggests the same neighbourhood names as a player's Area, the phone must be a Bangladeshi mobile number if given, the website must start with `http://` or `https://`, opening hours and pricing info are short notes (up to 120 characters, a second line allowed), and the description shows a live count up to 500 characters. The app sends every field each time (`PATCH /owners/me`). Once the admin has approved a venue it stays live when the owner edits it, but the address, area and phone can't be emptied any more: an approved venue must always be complete. Edit venue then stops calling those three "optional" and, if one is emptied, says so under the field ("A live venue needs a phone number") before sending; the backend checks again. The app and the backend check websites with the very same rule, and the app never opens a link that fails it. The owner's **Profile** tab shows the account itself (venue name, "Venue owner", email) and links to My Venue.

### Team invites

1. A captain opens their team and taps **Invite players**. The screen lists the players who aren't already in the team, invited or asking to join, with the same search and filters as Explore → Players (name, area and position), a page at a time; the backend does the searching, so the app never downloads every player. Tapping **Invite** turns that row's button into "Invited" and the captain can go on inviting; tapping the player's name opens their page. The title and the member count stay at the top, and when the team is full every Invite is greyed out.
2. The invited player sees the invite on the **Notifications** tab, under "Needs your action": the team name, who invited them and how full the team is, with **Accept** and **Decline**. Tapping the card opens the team first.
3. Accepting makes them a member, unless the team is full (15 members). Declining removes the invite.
4. If the player had already asked to join, the captain's invite simply approves their request, because both sides agreed.

The captain can also cancel an invite, remove a member or delete the team, each after a confirmation.

### Join requests

1. A player opens a team (from Explore → Teams) and taps **Request to join**, with an optional message to the captain (up to 150 characters).
2. The request shows on the player's **My Teams** under "Requests sent", where they can cancel it.
3. The captain sees "2 join requests waiting for you" on My Teams, and the requests with their messages on Team detail and on the Notifications tab, where they approve or decline each one (the same rows and the same "Decline …'s request?" question in both places). A full team can't approve more.
4. If the captain had already invited the player, asking to join simply accepts the invite.

The message is private: only the captain, the player who sent it and the admin ever see it. A player can never approve their own request: every membership row records whether it began as an invite or a request, and only invites can be accepted by the player.

### The Team detail screen

Team detail shows one team as the viewer sees it: its name, its area (if it has one) and description, and the people in it, each with their position and area ("Goalkeeper · Mirpur 10"). The backend tells the app where the viewer stands:

- **Captain:** invite players, hand over the captaincy, the join requests, the pending invites, the members (each removable), edit team, leave team and delete team.
- **Member:** the members and **Leave team**.
- **Invited:** **Accept invite** and **Decline**.
- **Request sent:** their request and **Cancel request**.
- **Any other player:** **Request to join**.
- **Venue owner:** the same team, read-only.

Destructive or important actions ask first, in a dialog that says exactly what will happen ("Remove Tanvir Ahmed from Dhanmondi Strikers?"). A captain with other members has to hand over the captaincy before leaving; a captain who's alone deletes the team by leaving. If the team changed in the meantime (for example it filled up), the screen says "Something changed" and reloads. Tapping anyone in the team (a member, a join request or an invite) opens their **Player detail**. If the team has been deleted, the screen says "This team isn't available any more." with a Back button, wherever it was opened from (for example an old update on the Notifications tab); Invite players and Transfer captaincy simply go back to it. **Edit team** opens the same form as Create team, filled in. A captain whose team has no area yet sees "No area yet." with an **Add area** link to that form, because a team without an area can't be found with the area filter.

### Notifications

One **Notifications** screen for players and venue owners (the admin has none), loaded each time it comes into view, on pull to refresh, and when the app comes back to the front while it's open.

- **Needs your action** (players only): your invites, with **Accept** and **Decline**, and, if you're a captain, one card per team with its join requests, approve and decline. These are the same pending invites and requests as everywhere else, so answering one here or on Team detail is the same thing. If something changed meanwhile (the invite was cancelled, the team filled up, you handed the team over), the screen says "Something changed" and reloads.
- **Updates**, newest first: what happened to you ("Your request to join Alpha FC was approved."), when ("5 min ago", "Yesterday", "12 Nov"), and for a venue moved back to review, the admin's note. The sentences come from the backend, so the app shows them as they are. Tapping one opens the team, the player or, for venue updates, My Venue; a deleted team says it isn't available any more.
- **Read and unread:** an update that hadn't been seen has a "New" pill. As soon as the screen shows it, the app tells the backend it's read (up to the newest one shown, so an update that arrives a moment later stays unread). The pill stays while you're on the screen, also after a refresh or an action, and goes once you leave it for another screen or tab; putting the app in the background doesn't count as leaving.

### Explore

Explore is one screen for players and venue owners, with three sections: **Teams**, **Players** and **Venues**. The title and the section tabs stay at the top. Each section has its own search and filters, and keeps them, its rows and its place in the list while you look at another section.

- **Teams:** search by name, filter by area. Teams with a free spot come first; full teams come last, marked "Full". Your own teams, invites and requests are marked too ("Captain", "Player", "Invited", "Request sent").
- **Players:** search by name, filter by area and by position. All three combine.
- **Venues:** see "Finding a venue".

The app never downloads a whole list. It asks the backend for a page of 20, and for the next page when you near the end. All the matching happens on the backend. A request isn't sent on every keystroke: the app waits until typing has paused for 0.4 seconds (tapping a suggestion or a position searches straight away). If an older answer arrives late, it's thrown away. Opening a team and coming back doesn't load the list again, so you stay where you were; pulling down refreshes it. If a search can't reach the backend, the list says so with **Try again**, rather than showing rows that don't match the search. All this lives in one place, the `usePagedList` hook, which the three sections and Invite players share.

Venue owners see the same three sections, read-only.

### The Player detail screen

Player detail is one player's public page (`GET /players/:id`): their name, position and area, their height and weight if they added them, and the teams they're in, each opening Team detail. The backend adds the phone only when the viewer is an accepted teammate; then the app shows it with "You can see this because you're teammates." and tapping it opens the dialler. A captain also gets an **Invite to my team** card: one row per team they captain, with an **Invite** button, or the reason there isn't one (already a member, already invited, asked to join, or the team is full). The backend works those reasons out, so the app never guesses. Opening your own page shows it as others see it, with a line saying so. Team detail and Player detail open each other on top of the current screen, so Back always returns one step, however long the chain.

---

## 8. Configuration

The backend reads its settings from **environment variables**: named values set outside the code, so secrets aren't written into the source. They go in a file called `backend/.env`, which git ignores and is never committed. `backend/.env.example` lists every variable with a comment and a fake value: copy it to `.env` and fill it in.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Where the PostgreSQL database is and how to log in to it |
| `JWT_SECRET` | The secret used to sign and check login tokens |
| `EMAIL_USER`, `EMAIL_PASS` | The Gmail account the backend sends email from |
| `BACKEND_PUBLIC_URL` | The backend's public address (the ngrok URL), used to build the links in emails |
| `PORT` | Optional: the port the server listens on (4000 if not set) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Only for the admin script below |
| `TEST_BASE_URL` | Optional, only for the tests |

**The server checks its settings when it starts ("fail fast").** If a setting is missing or wrong, the server refuses to start and prints one clear message listing every problem, for example:

```
Server can't start: these settings in backend/.env are missing or invalid:
  - JWT_SECRET: must be at least 32 characters
  - EMAIL_USER: missing
See backend/.env.example.
```

It names the setting and the reason but never prints the value, because several settings are secrets. Without this check, a missing setting would only show up later, for example as a crash the first time an email is sent. The rule for each setting: [TECHNICAL.md section 2](TECHNICAL.md#2-backend-settings).

**The admin account** comes from `node scripts/createAdmin.js`, run in `backend/`. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` and creates the admin, or, if the admin already exists, changes its password (that's how you change the admin password). It never prints the password, and there's only ever one admin.

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
| The app's copies of the backend's checks | `IndoorFootballApp/src/utils/` (phone, password, links) and the `*Checks.js` / `signUpCommon.js` files next to the screens |
| The look (colours, fonts, sizes) | `IndoorFootballApp/src/theme/`, and the design in `docs/DESIGN.md` |
| A backend address (URL path) | `backend/src/routes/<area>Routes.js` |
| What a backend action actually does | `backend/src/controllers/<area>Controller.js` |
| The login check and the role checks | `backend/src/middleware/auth.js` |
| The rate limits (how many tries, how long) | `backend/src/middleware/rateLimits.js` |
| What clients see when something goes wrong | `backend/src/middleware/errorHandler.js` |
| Security headers or the trust proxy setting | `backend/src/server.js` |
| The rules a request must follow | `backend/src/validation/` (one file per router; shared profile fields in `profileFields.js`) |
| The password strength rule | `backend/src/utils/password.js` |
| The website rule | `backend/src/utils/links.js` (and the app's copy in `IndoorFootballApp/src/utils/links.js`) |
| How emails are lowercased and trimmed | `backend/src/utils/email.js` |
| What deleting a user or a team removes | `backend/src/utils/deletion.js` |
| Who may see which user fields | `backend/src/utils/visibility.js` |
| The text of the emails | `backend/src/utils/emailTemplates.js` |
| How emails are sent | `backend/src/utils/mailer.js` |
| The Terms of Use and Privacy Policy text | `backend/src/routes/legalRoutes.js` |
| The database tables | `backend/prisma/schema.prisma`, then create a migration |
| Environment variables | `backend/.env` (never commit it) |
| The rules a setting must follow at startup | `backend/src/config/loadConfig.js` |
| Any technical detail | [TECHNICAL.md](TECHNICAL.md) |
