# ConnectArena

A football community app for indoor football (futsal) players in Bangladesh. Players build profiles, form and join teams, and discover indoor venues; venue owners list their venue; an admin looks after everything. Android first.

The repository has two separate projects side by side:

- `backend/`: the server (Node.js, Express, Prisma, PostgreSQL)
- `IndoorFootballApp/`: the mobile app (React Native)

Each has its own `package.json`. Always run `npm` commands inside one of these folders, never in the repository root.

## Prerequisites

- **Node.js 20 or newer** (developed with Node 24) and **npm 11 or newer**. The backend needs Node 20 because its email library (nodemailer 10) does; `backend/package.json` says so in `"engines"`, and npm warns during `npm install` if your Node is older.
- **PostgreSQL** running locally, with an empty database for the app
- **Android Studio** with the Android SDK (API 36) and an emulator, or an Android phone with USB debugging
- **JDK 17** (the version React Native recommends; set `JAVA_HOME` to it)
- **ngrok**, so the app can reach the backend running on your PC
- A **Gmail account with an App Password**, for sending verification and reset emails

React Native's [environment setup guide](https://reactnative.dev/docs/set-up-your-environment) covers Android Studio, the SDK and the JDK in detail.

## Backend setup

From `backend/`:

1. Copy `.env.example` to `.env` and fill in every value (the comments in the file explain each one). `JWT_SECRET` must be at least 32 characters; the file shows a command that makes one. Never commit `.env`.
2. Install dependencies:
   ```bash
   npm install
   ```
   npm 11 only runs dependency install scripts that are approved in the `allowScripts` field of `backend/package.json` (currently `bcrypt` and the Prisma packages). After upgrading one of those, or adding a package with an install script, run `npm approve-scripts --allow-scripts-pending` to see what needs a decision, and only approve packages you trust.
3. Generate the database client and create the database tables:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
4. Create the admin account (set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` first). Running it again with the same email changes the admin's password.
   ```bash
   node scripts/createAdmin.js
   ```
   Optional, **development only and temporary** (local database only): `node scripts/seedDevAccounts.js` creates four test accounts for the app's "Quick login" buttons, which only development builds show on the Login screen: Player A (`aa` / `aa`), Player B (`ab` / `ab`), a venue owner with a live venue (`bb` / `bb`) and a second, test-only admin (`ad` / `ad`). It refuses to run unless `DATABASE_URL` points to `localhost` or `127.0.0.1`. Running it again resets them; `--fresh` also removes their teams, memberships and notifications; `--remove` deletes them. Create your real admin (step 4) first: `createAdmin.js` won't create a second admin while `ad` exists.
5. Start the server (it restarts when code changes, but not for changes in `tests/`; port 4000 by default):
   ```bash
   npm run dev
   ```
   If it stops at once with "Server can't start: these settings in backend/.env are missing or invalid", fix the settings it lists in `.env` (see `.env.example` for the rules), then start it again. It restarts on code changes but not on `.env` changes, so restart it yourself after editing `.env`.
   If it says "Port 4000 is already in use. Is another server running?", another copy of the backend (or another program) already has that port. Stop it (Ctrl+C in its terminal), or set a different `PORT` in `.env`.

   To check it from a browser, open <http://localhost:4000/legal/terms>: it shows the (draft) ConnectArena Terms of Use page. The Privacy Policy is at `/legal/privacy`. Both work without logging in, and also through the ngrok address below.

## Connecting the app to the backend (ngrok)

The phone or emulator reaches your PC's backend through an ngrok tunnel:

```bash
ngrok http 4000
```

ngrok prints a public `https://…` address. Put it in two places:

- `BACKEND_PUBLIC_URL` in `backend/.env` (used in email links), then restart the backend
- `API_URL` in `IndoorFootballApp/src/api/api.js`, the address the app calls

The address is hardcoded in `api.js` for now. Making it configurable per build is planned for Phase 5 of the roadmap. Update both places whenever the tunnel address changes.

## App setup

From `IndoorFootballApp/`:

```bash
npm install
npm start            # starts Metro (the JavaScript bundler); leave it running
npm run android      # in a second terminal: builds and installs the app on the emulator or phone
```

## Running the tests

Backend (from `backend/`): the tests send real requests to the running server and use the local database, creating and deleting their own throwaway users.

```bash
npm run dev          # in one terminal
npm test             # in another
```

App (from `IndoorFootballApp/`):

```bash
npm test                          # Jest
npm run lint                      # ESLint
npx prettier --check src App.js   # formatting
```

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md): what the app should do, release scope and business rules
- [docs/ROADMAP.md](docs/ROADMAP.md): the plan and task tracker
- [docs/DECISIONS.md](docs/DECISIONS.md): decisions and the reasons behind them
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app works, in plain English
- [docs/TECHNICAL.md](docs/TECHNICAL.md): the technical reference (conventions, endpoints, data model, tests, tooling)
- [docs/DESIGN.md](docs/DESIGN.md): the visual design system
- [CLAUDE.md](CLAUDE.md): working rules, commands and the easy-to-break conventions for Claude Code (the detail is in [docs/TECHNICAL.md](docs/TECHNICAL.md))
