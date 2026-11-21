# Feature 2: Profiles and registration (spec)

Phase 4, Step 3. Task F2.0, written 2026-11-22. **Status: approved 2026-11-22** (DECISIONS.md, "Profiles and registration feature spec approved"). **Backend built 2026-11-22** (task F2.1); screens still to come in F2.2–F2.4.

**How to read the markers:**
- **[Dn, approved]**: a default from the task brief, confirmed by the owner on 2026-11-22.
- **[Pn, approved]**: a design choice proposed by Claude Code, with its one-line reason, approved by the owner on 2026-11-22. All are listed in section k.
- **Qn**: a question or contradiction found while writing the spec. The owner answered them on 2026-11-22; the answers are in section j and built into the sections above.
- Everything else comes from PRODUCT.md, DECISIONS.md, or the owner's four decisions of 2026-11-22 (DECISIONS.md, "Profiles and registration details").

---

## a. What it covers

The four Profiles and registration items in ROADMAP Step 3, plus two items that moved into this feature:

1. **Shorter registration and the position list.** Short player and venue owner sign-up forms, the position picker, venue phone and address optional, and position stored as a fixed list (with the existing values mapped).
2. **"Area" replaces the player address**, with suggestions as the player types.
3. **Profile editing** for players (Edit profile) and venue owners (their existing venue fields, **[D2, approved]**), plus a proper owner Profile tab.
4. **Change password while logged in.**
5. **The Terms of Use and Privacy Policy checkbox** on both sign-up forms. It moved here from the moderation feature (owner's decision, 2026-11-22), because both forms are rebuilt here. Includes the Terms and Privacy pages it links to (**[D1, approved]**).
6. **The website check** (http/https only), on the backend and before the app opens a link (**[D3, approved]**). It moved here from the venues feature, because the venue edit form is built here.

Also rebuilt in the new design as part of the same flow: **Login, Role selection and Forgot password** (**[D4, approved]**), and **Settings** with the rows that exist in v1.0 so far.

Not covered: the venue's area, opening hours, pricing info, admin approval, the missing-fields checklist and venue search (feature 3, venues); Player detail and the Explore sections (Explore feature); Blocked players (moderation), Contact support (Phase 5 support email) and Delete account (account deletion feature), which later features add to Settings; changing the email (not in v1.0).

## b. Rules

The rules are in PRODUCT.md and are not copied here:
- [Registration](../PRODUCT.md#registration-v10): the short forms, the position list, the Terms checkbox.
- [Profiles](../PRODUCT.md#profiles-v10): Area, phone numbers, email (new section, from the owner's decisions of 2026-11-22).
- [Login sessions](../PRODUCT.md#login-sessions-v10): a password change logs out every other device.
- [Profile visibility](../PRODUCT.md#profile-visibility-v10): Area is public to logged-in users; phone only to accepted teammates; email only to yourself and the admin.
- [Venue owners](../PRODUCT.md#venue-owners-v10): the listing fields and the http/https website rule.
- [Administration and moderation → Terms of Use](../PRODUCT.md#administration-and-moderation-v10).

Details PRODUCT.md doesn't settle, as used in this spec:

- **[P1, approved] Position values.** Stored as a database enum `Position` whose values are exactly the words people see: `Goalkeeper`, `Defender`, `Midfielder`, `Forward`, `Any`. The API sends and accepts those exact words (with that capitalisation). Proposed by Claude Code. Reason: the app shows them as they are, and one spelling everywhere means no translation code.
- **[P3, approved] Area length.** After tidying (below), 2–40 characters, counted in code points like every other limit. Blank means no area (stored as null). Proposed by Claude Code. Reason: area names are short ("Uttara Sector 10" is 16 characters); 40 leaves room without allowing a full address, and 2 stops one-letter entries.
- **[P4, approved] Area tidying.** Spaces at both ends are removed, and every run of spaces, tabs or line breaks inside becomes one space. The letters stay as typed (no automatic capitals). Proposed by Claude Code. Reason: "spaces tidied" (decided) made exact; changing the case could spoil names like "DOHS".
- **[P5, approved] Where the suggestion list lives.** In the app only (`src/constants/areas.js`), with no endpoint. Suggestions appear from the first typed character, match anywhere in the name ignoring upper/lower case ("pur" finds Mirpur and Mohammadpur), show at most 5, and hide once the text equals a suggestion. Tapping one fills the field. Any other text is allowed. Proposed by Claude Code. Reason: the backend doesn't need the list (filtering works on the stored text), and an app list needs no request and works offline. Trade-off: changing the list needs an app update. The same list is reused for venue areas in feature 3 (decided).
- **[P6, approved] The starter list** (Q6): Dhaka areas: Adabor, Aftabnagar, Agargaon, Badda, Banani, Banasree, Baridhara, Bashundhara, Cantonment, Demra, Dhanmondi, Farmgate, Gulshan, Hazaribagh, Jatrabari, Kafrul, Kalabagan, Keraniganj, Khilgaon, Khilkhet, Lalbagh, Lalmatia, Malibagh, Mirpur, Mohakhali, Mohammadpur, Motijheel, Niketan, Nikunja, Old Dhaka, Pallabi, Rampura, Savar, Shahbagh, Shantinagar, Shyamoli, Tejgaon, Uttara, Wari. Nearby: Gazipur, Narayanganj, Tongi. Other cities: Barishal, Chattogram, Cumilla, Khulna, Mymensingh, Rajshahi, Rangpur, Sylhet. Proposed by Claude Code. Reason: the app's first users are in and around Dhaka; city names cover everyone else.
- **Filtering by area** (Explore and venues, built in those features) uses Prisma's `contains` with `mode: 'insensitive'` on the stored text, so "dhanmondi" finds "Dhanmondi 27" (decided; recorded here so those features build it this way).
- **[P8, approved] Phone numbers in the app.** The app removes spaces and dashes before checking and sending ("01712-345 678" becomes "01712345678"). The backend accepts only the 11 digits (it trims spaces at both ends, nothing else), so every stored number has the same clean form. Proposed by Claude Code. Reason: people often type numbers in groups; the stored format stays one simple pattern.
- **The phone rule** (decided): `01`, then a digit from 3 to 9, then 8 more digits: `^01[3-9]\d{8}$`. Player phones always; venue phones whenever one is given (the venue phone is optional). **Venue phones are mobile only too** (Q1): no landlines in v1.0.
- **Email** (decided): shown read-only on the player's Edit profile and on the owner's Profile tab, with "Email can't be changed yet."
- **[P12, approved] Players can change their name** on Edit profile, with the sign-up rules (2–50 characters, trimmed). Proposed by Claude Code. Reason: typos happen, and PRODUCT.md's "profile editing" doesn't exclude the name.
- **[P7, approved] Recording Terms acceptance.** `User.termsAcceptedAt` (date and time, nullable) is set to the moment of registration. Existing accounts keep null, meaning "registered before the checkbox existed", and aren't asked to accept in v1.0. The admin account (made by the script) is null too. Proposed by Claude Code. Reason: there are no real users yet (every account is test data, DECISIONS.md 2026-11-20), so a re-acceptance screen would only serve test accounts. A version field can be added when the real terms text exists (Phase 5).

## c. Data changes

One migration, `profiles_registration`. **The migration still needs the owner's approval when it's created in the backend task (F2.1)**, after the five phone numbers are fixed (Q2).

| Change | Details | Existing data |
|---|---|---|
| **Position enum** | New enum `Position { Goalkeeper Defender Midfielder Forward Any }`. `PlayerProfile.position` is converted in place (`ALTER COLUMN … TYPE "Position" USING CASE …`), still required. | Mapped as below. The full mapping is shown to the owner again, from the data at that moment, before the migration runs (PRODUCT.md). |
| **Address → area** | `PlayerProfile.address` renamed to `area` in place (`RENAME COLUMN`), so values are kept. Still optional. | On 2026-11-22 no player has an address. Any value longer than 40 characters at migration time is listed to the owner first. |
| **Venue phone and address optional** | `OwnerProfile.phone` and `OwnerProfile.address` become nullable (`DROP NOT NULL`). | Unchanged. |
| **Terms acceptance** | `User.termsAcceptedAt DateTime?` (P7). | Null for every existing account. |

Nothing else changes in the database. The phone rule and the website rule are checks on input, not database constraints. The five stored phones that don't match are fixed before the migration (Q2), so every stored phone matches from the start.

**Position mapping.** PRODUCT.md decided the rule: obvious matches (ignoring case and spaces at both ends) map to their value, everything else to Any. **[P2, approved]** The "obvious match" words, proposed by Claude Code:

| Maps to | Text that counts as an obvious match |
|---|---|
| Goalkeeper | goalkeeper, keeper, goalie, gk |
| Defender | defender, defence, defense, def, back, cb, fixo |
| Midfielder | midfielder, midfield, mid, cm, ala, winger |
| Forward | forward, fwd, striker, st, att, attack, attacker, pivot |
| Any | any, and everything else |

Reason: covers common English abbreviations and the futsal terms in the mockups (ala and winger play on the flank, the pivot is the target player at the front). The values in the test database on 2026-11-22 map like this:

| Stored today | Accounts | Becomes |
|---|---|---|
| Any | 15 | Any |
| Forward | 1 | Forward |
| Goalkeeper | 1 | Goalkeeper |
| Defender | 1 | Defender |
| Mid | 1 | Midfielder |
| ATT | 1 | Forward |
| att | 1 | Forward |
| gk | 1 | Goalkeeper |

**Phones that don't match the new rule** (read on 2026-11-22): 4 player accounts (user ids 5, 35, 761, 6210) and 1 venue owner (user id 1684). Each is an 11-digit number starting with `12`. **Decided (Q2):** at the start of F2.1, Claude Code changes each to a valid made-up mobile number (`017…`) in the local database and says which rows changed.

## d. API

### d.1 Shared rules

- **Validation:** every body goes through a zod schema; controllers read only `req.valid`. Shared profile pieces (player name, phone, position, area, height, weight, venue name, venue address, website, description) move into one file, `src/validation/profileFields.js`, used by the register schema in `authSchemas.js` and by the new `playerSchemas.js` and `ownerSchemas.js` (one schema file per router, as today). Unknown fields are stripped, not refused (DECISIONS.md 2026-11-20).
- **Messages:** one short message per reply, as today. The messages that change because their rules changed are listed in d.3 (Q7: a message that describes a changed rule is replaced; every other existing message keeps its words, DECISIONS.md 2026-11-20).
- **Visibility:** every user or profile in a reply goes through `src/utils/visibility.js`. `toPublicPlayer` gains `area` (only when set), as PRODUCT.md "Profile visibility" says; the comment there about the hidden address is removed.
- **[P13, approved] Optional text is trimmed on the edit endpoints.** Description, website and venue address are stored without spaces at both ends, and blank becomes null. Proposed by Claude Code. Reason: today's `optionalText` keeps stray spaces as sent; an edit form makes them more likely (a space after a pasted website breaks the link).
- **Status codes** as in feature 1: 400 bad input, 403 wrong role, 404 gone, 429 too many attempts. **Never 401 for a wrong current password** (see endpoint 6).

### d.2 Endpoints at a glance

| | Method and path | Who | Status |
|---|---|---|---|
| 1 | `POST /auth/register` | anyone (rate-limited as today) | changed: short forms, Terms, phone rule, position list |
| 2 | `GET /players/me` | player | changed: `area` replaces `address`; position from the list |
| 3 | `PATCH /players/me` | player | new: Edit profile |
| 4 | `GET /owners/me` | venue owner | changed: phone and address may be null |
| 5 | `PATCH /owners/me` | venue owner | new: edit the venue listing **[D2, approved]** |
| 6 | `POST /auth/change-password` | any logged-in user | new |
| 7 | `GET /legal/terms`, `GET /legal/privacy` | anyone (web pages) | new **[D1, approved]** |
| 8 | `GET /players`, `GET /teams/:teamId`, `GET /teams/me` | any logged-in user | changed: players' public `area` |
| 9 | `GET /owners`, `GET /admin/indoors` | as today | unchanged code; phone and address may now be null |

`GET /auth/me` doesn't change; after an edit it returns the new name.

**[P11, approved] The edit endpoints are `PATCH /players/me` and `PATCH /owners/me`, and they take every field each time** (like Edit team, feature 1's P7). Proposed by Claude Code. Reason: one schema per form and no partial-update rules; the edit screens always have every value. Leaving an optional field out (or sending null or "") clears it.

**[P10, approved] The register request keeps today's shape** (players' name at the top level, the rest in `profileData`; the venue name in `profileData.indoorName`), plus one new field, `acceptedTerms`. Fields the short forms no longer have are simply ignored. Proposed by Claude Code. Reason: the smallest change to a working endpoint; unknown fields are already stripped.

### d.3 Endpoint details

Success replies use `{ "message": ... }` unless a body is shown. Every error reply is `{ "error": "<message>" }`.

**1. `POST /auth/register`** (changed)

Player body: `{ email, password, role: "PLAYER", name, profileData: { phone, position }, acceptedTerms: true }`.
Owner body: `{ email, password, role: "OWNER", profileData: { indoorName }, acceptedTerms: true }`.

The checks keep their stages and order (required fields, role, email and password, the role's profile fields), with Terms added last:
- Required fields, role, email and password: unchanged, with the same messages.
- **Player:** `name` as today (2–50, trimmed; "Name is required for PLAYER", "Name must be between 2 and 50 characters"). `profileData.phone`: missing gives "PLAYER profile requires phone and position" (as today); otherwise it must match the phone rule, else **"Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678"** (replaces "Phone number must be exactly 11 digits", Q7). `profileData.position`: missing gives "PLAYER profile requires phone and position"; otherwise exactly one of the five values, else **"Position must be Goalkeeper, Defender, Midfielder, Forward or Any"** (new). Height, weight and address are no longer read.
- **Owner:** `profileData.indoorName` as today (2–60, trimmed). Missing gives **"Venue name is required"** (replaces "OWNER profile requires indoorName, phone, and address", which is no longer true, Q7). Phone, address, description and website are no longer read.
- **[P9, approved] Terms, checked last:** `acceptedTerms` must be exactly `true` (not "true", not 1). Otherwise **"Please accept the Terms of Use and Privacy Policy"**. Proposed by Claude Code. Reason: checked last, a request with other problems still gets the message it got before.
- "Email already registered" stays in the controller, after all of these.
- Creates the user with `termsAcceptedAt: now`; the player profile gets `name`, `phone`, `position` (height, weight and area null); the owner profile gets `indoorName` (everything else null).
- Replies, the verification email and its failure reply: unchanged.

**2. `GET /players/me`** (changed): as today, `playerProfile` holds `area` instead of `address`, and `position` is one of the five values.

```json
{ "id": 12, "email": "…", "role": "PLAYER", "createdAt": "…",
  "playerProfile": { "name": "Rahim Uddin", "phone": "01712345678", "position": "Forward",
                     "height": 172, "weight": null, "area": "Dhanmondi 27" } }
```

**3. `PATCH /players/me`** (new; `verifyToken`, players only: anyone else gets 403 "Players only", like `GET /players/me`).

Body: `{ name, phone, position, height, weight, area }`. zod (`updatePlayerProfileSchema`), first problem wins, in this order:
- `name`: required text, trimmed, 2–50. "Name is required", "Name must be text", "Name must be between 2 and 50 characters".
- `phone`: required. "Phone number is required"; the phone rule message above.
- `position`: required, one of the five. "Position is required"; "Position must be Goalkeeper, Defender, Midfielder, Forward or Any".
- `height`, `weight`: as at sign-up today (numbers or null; 100–250 cm, 30–200 kg; same messages). Missing or null clears it.
- `area`: optional text, tidied (P4), 2–40 after tidying, blank or missing becomes null. "Area must be text", "Area must be between 2 and 40 characters".

One update of the player profile. Reply: 200 with the `GET /players/me` shape. 404 "Player profile not found" if the profile is missing (as GET).

**4. `GET /owners/me`** (changed): same shape as today; `phone`, `address`, `description` and `website` may each be null.

**5. `PATCH /owners/me`** (new; `verifyToken`, venue owners only: anyone else gets 403 "Owners only") **[D2, approved]**.

Body: `{ indoorName, phone, address, website, description }`. zod (`updateVenueSchema`), in this order:
- `indoorName`: required text, trimmed, 2–60. "Venue name is required", "Venue name must be text", "Venue name must be between 2 and 60 characters".
- `phone`: optional; missing, null or blank becomes null; otherwise the phone rule, mobile only (Q1).
- `address`: optional text, trimmed, at most 200; blank becomes null. "Address must be text", "Address must be at most 200 characters".
- `website`: optional text, trimmed, at most 200, blank becomes null; otherwise it must be a web link (below). "Website must be text", "Website must be at most 200 characters", **"Website must start with http:// or https://"**.
- `description`: optional text, trimmed, at most 500, blank becomes null. "Description must be text", "Description must be at most 500 characters".

One update of the owner profile. Reply: 200 with the `GET /owners/me` shape. 404 "Owner profile not found" if missing.

**[P18, approved] What counts as a web link** (**[D3, approved]** detail): the text parses as a URL (`new URL(...)`), its scheme is `http:` or `https:` in any case, it has a host name, and it contains no spaces. So `https://arena.com.bd` and `HTTP://Arena.com` pass; `arena.com`, `www.arena.com`, `javascript:alert(1)`, `ftp://arena.com` and `https://` fail. Proposed by Claude Code. Reason: "starts with http:// or https://" alone would let `https://` with nothing after it through; parsing also catches broken links. The same function is written in the app (`src/utils/links.js`, `isWebLink`); a stored website that fails it is shown as plain text, never opened.

Feature 3 later adds area, opening hours and pricing info to this endpoint, and the rule that an approved venue can't clear its address, area or phone.

**6. `POST /auth/change-password`** (new; `verifyToken`, any role).

Body: `{ currentPassword, newPassword }`. Middleware order: `verifyToken`, then the rate limiters, then `validate`, then the controller.

zod (`changePasswordSchema`):
- Both present and non-empty text, else **"Current password and new password are required"**.
- `newPassword`: the shared strength rule (`PASSWORD_RULE_MESSAGE`) and the 72-byte limit (`PASSWORD_TOO_LONG`), exactly as at sign-up and reset.
- **[P14, approved]** `newPassword` differs from `currentPassword`, else **"Your new password must be different from your current one"**. Proposed by Claude Code. Reason: "changing" to the same password logs out every other phone and changes nothing else, which is almost always a mistake.

Controller:
- `bcrypt.compare(currentPassword, user.password)` fails: **400 "Current password is incorrect"**. Nothing changes. **Never 401:** the app treats any 401 on a request that carried a token as "session expired" and logs out (`src/api/api.js`), so a typo would log the user out.
- Otherwise one update: the new bcrypt hash (cost 10), `tokenVersion: { increment: 1 }`, and **[P15, approved]** `resetToken` and `resetTokenExpires` cleared. Proposed by Claude Code. Reason: a reset link sent before the change shouldn't still work afterwards.
- Reply 200 `{ "message": "Password changed", "token": "<new login token>" }`. The token is signed exactly like a login token (same claims, the new `tv`, a fresh 30 days), by a shared helper `signLoginToken(user)` in `src/utils/tokens.js` that login uses too. Every other token of the account now gets 401 (logout on every other device, decided); this phone saves the new token and stays logged in.
- **Notice email (Q5).** After the update, a short email goes to the account's address through a new `sendPasswordChangedEmail({ email, displayName })` in `src/utils/mailer.js` (HTML from `emailTemplates.js`, every value through `escapeHtml`). Subject "Your ConnectArena password was changed"; text: "Hi {name}, the password for your ConnectArena account was just changed. If this was you, you don't need to do anything. If it wasn't, use Forgot password on the app's login screen right away to set a new one." No link in the email (a link in a "your account changed" email is what phishing copies). A failed send is logged and doesn't change the reply: the password is already changed. Like every account email, it's skipped for `@example.com` addresses, so tests send nothing.

**[D5, approved] Rate limits**, in `src/middleware/rateLimits.js`, counting only failed requests like login: **10 per 15 minutes per account** (keyed by `req.user.id`) and **50 per 15 minutes per IP** (`ipKeyGenerator`). Any reply of 400 or more counts as a failure (a wrong current password, or a new password that breaks the rule). Then 429 **"Too many attempts to change your password. Please wait 15 minutes and try again."** The numbers are Claude Code's detail, copied from login. Counters are in memory, as for the other limits.

**7. `GET /legal/terms` and `GET /legal/privacy`** (new; no login) **[D1, approved]**

**[P17, approved]** Served by a new `src/routes/legalRoutes.js` mounted at `/legal`, as HTML pages built by a new `legalPage({ title, sections })` in `src/utils/pages.js` (escaped with `escapeHtml`, no inline scripts or styles, so helmet's content security policy holds). No rate limit: they're static text. Proposed by Claude Code. Reason: short, stable addresses that can go on the Play Store listing once the backend has its real domain (Phase 5).

Placeholder content until Phase 5 writes the real text, each page opening with "This is a draft. The full text will be published before the app launches.":
- **Terms of Use:** who can use the app; what's not allowed (offensive names or content, fake profiles or venues, harassment, spam, from PRODUCT.md); that the admin can suspend or delete accounts that break the rules; that users can report and block.
- **Privacy Policy:** what the app stores (email, hashed password, name, phone, position, height and weight if given, area, the venue listing); who sees what (the PRODUCT.md visibility rules in plain words); that accounts can be deleted in the app; that the backup retention period will be stated before launch.

Only facts already decided go in. The app opens the pages in the phone's browser with `Linking.openURL`, using the same server address as the API (`src/api/api.js` exports it).

**8. Area in public replies** **[P16, approved]**: `GET /players` selects `area` with `name` and `position`; the team member lists in `GET /teams/:teamId` and `GET /teams/me` do too. All go through `toPublicPlayer`, which adds `area` only when it's set. Proposed by Claude Code. Reason: Area is public (decided), and these are the lists captains use to pick players; the app shows it later on Player detail and in Explore.

**9.** `GET /owners` and `GET /admin/indoors` need no code change, but a new owner now appears with only a venue name until they fill in the listing (see section f).

## e. Screens

Built from `src/components/ui` with theme tokens only. Every button that sends a request uses the `Button` `loading` state (decided, ROADMAP 4.5). Field problems found before sending show as `TextField` errors under the field; the backend's `error` shows in an alert. No mockups exist for these screens; they follow DESIGN.md section 6.

**[P19, approved] Three new shared components** in `src/components/ui/`, each with tests, a UI gallery entry and a DESIGN.md section 6 entry. Proposed by Claude Code. Reason: none of the 19 components fits, and each is used in more than one place.
- **`Checkbox`**: a 24×24 box inside a 44×44 touch target; unticked: `surface` with a `border` line; ticked: `accent` with the `approve` (check) icon in `onAccent`. Role `checkbox` with checked state. The label sits beside it and can contain `TextLink`s, which stay separately tappable. An `error` line under it, like `TextField`.
- **`OptionGroup`**: the position picker. A label, then the options as tappable chips in a wrapping row (each at least 44 tall): chosen = `accent` background, `onAccent` text; others = `surface` with a `border` line. Role `radiogroup`, each option `radio` with selected state. An `error` line under it.
- **`SuggestionField`**: a `TextField` plus a list of up to 5 suggestion rows right under it (inline, not a floating pop-up), shown while the field is focused and the suggestions match (P5). Each row is at least 44 tall, labelled "Suggestion: {name}". Generic: it takes the list and the matching function as props, so feature 3 reuses it for venue areas.

**[P8, approved, in the app]** Phone fields strip spaces and dashes (`src/utils/phone.js`: `cleanPhone`, `isMobileNumber`, the same regex as the backend).

**[P21, approved] The app repeats the password strength rule**: the password field's helper shows the rule, and the app checks it before sending (keep in sync with `src/utils/password.js`). Proposed by Claude Code. Reason: today people only learn the rule from the backend's alert after tapping Register.

### Login (rebuilt) [D4, approved]

- The ball logo (`assets/icons/ball.png`), the title "ConnectArena" (`display`, Q9) and the slogan in `bodySmall` / `textMuted`.
- `TextField`s **Email** and **Password** (`secure`). A `TextLink` **Forgot password?** (→ Forgot password).
- **Log in** (primary, full width, loading). A failed login shows the backend's message in an alert, as today.
- After "Please verify your email" (403): a `NoticeLine` "**Your email isn't verified yet.** Check your inbox for the link." and **Resend verification email** (secondary, loading). Its reply shows in an alert, as today. Changing the email hides both, as today.
- **[P23, approved]** A line "New here?" with a `TextLink` **Create an account** (→ Role selection) replaces today's Login/Signup "tabs". Proposed by Claude Code. Reason: the tabs look like a switch but one of them navigates away; a link says what it does.
- The "UI gallery" link stays, development builds only.

### Role selection (rebuilt) [D4, approved]

`BackLink` "Log in", title "Create an account", then two tappable `Card`s: **"I'm a player"** (`teams` icon, "Join and run teams, and find venues.") → Player sign-up, and **"I run a venue"** (`venue` icon, "List your indoor venue so players can find it.") → Owner sign-up.

### Player sign-up (rebuilt)

`Screen keyboardAware scroll`. `BackLink` "Back", title "Player sign-up". Fields in this order:
- **Name** (helper "2–50 characters").
- **Email** (email keyboard, no auto-capitals).
- **Phone** (phone keyboard; helper "Bangladeshi mobile number, like 01712345678"; teammates use it to reach you).
- **Position** (`OptionGroup`: Goalkeeper, Defender, Midfielder, Forward, Any).
- **Password** (`secure`; helper: the strength rule) and **Confirm password** (`secure`).
- **Terms** (`Checkbox`): "I agree to the **Terms of Use** and **Privacy Policy**", the two names as `TextLink`s opening the pages.
- **Create account** (primary, full width, loading).

Checks before sending, each shown under its field: required fields; name 2–50 code points; the email looks like an address; the phone rule (after `cleanPhone`); a position chosen; the strength rule; the two passwords match ("Passwords don't match"); the box ticked ("Please accept the Terms of Use and Privacy Policy").
**[P20, approved]** The button stays enabled while the box is unticked; tapping it shows the error under the box. Proposed by Claude Code. Reason: a disabled button doesn't say why it's disabled.

On success: **Check your email** (below), replacing the form.

### Owner sign-up (rebuilt)

Same layout, title "Venue sign-up": **Venue name** (helper "2–60 characters"), **Email**, **Password**, **Confirm password**, **Terms**, **Create account**. A short line under the title: "You'll add your venue's address, phone and other details after you log in." On success: Check your email.

### Check your email (new, small screen)

**[P22, approved]** Title "Check your email"; text "We've sent a link to {email}. Open it to verify your account, then log in. The link works for 24 hours." (When the reply says sending failed: "Your account is ready, but we couldn't send the email. Tap Resend to try again.") **Resend email** (secondary, loading; its reply shows as a line of text under it, errors in an alert) and **Back to log in** (primary). Proposed by Claude Code. Reason: verifying is where new users get stuck; this keeps the next step and the resend button in one place, and handles the "couldn't send" reply properly instead of an alert.

### Forgot password (rebuilt) [D4, approved]

`BackLink` "Log in", title "Forgot password", a line "Enter your email and we'll send you a link to set a new password.", **Email**, **Send reset link** (primary, loading).
**[P24, approved]** After sending, the form is replaced by "If that email has an account, we've sent a reset link. It works for 1 hour." and **Back to log in**. No alert. Proposed by Claude Code. Reason: the same "no success alerts" approach as feature 1 (its P16); the confirmation stays on screen.

### Player Profile (rebuilt)

No stack header: a `ScreenHeader` with the title "Profile" and a gear `IconButton` (`settings`, "Settings") as its action (→ Settings).
- A `Card`: `Avatar` (`avatarLarge`) with the player's initials, the name (`cardTitle`), the position as a soft `Pill`, and the area with the `area` icon (`meta`, only when set).
- A "Details" `Card` of `ListRow`s: Position, Area, Height ("172 cm"), Weight ("68 kg"), Phone, Email.
- **[P26, approved]** An empty optional row shows "Not added" (`textMuted`) instead of disappearing. Proposed by Claude Code. Reason: the player sees what they can still fill in (the short sign-up leaves area, height and weight empty).
- **[P25, approved]** Privacy hints in `meta` / `textMuted`: under Phone "Only your teammates can see this", under Email "Only you can see this". Proposed by Claude Code. Reason: players see what's public without reading the policy.
- **Edit profile** (secondary, `edit` icon) under the cards (PRODUCT.md: "Profile → Edit").
- Loads `GET /players/me` on focus and on pull to refresh; a failed first load shows "Couldn't load your profile." with Try again.

### Edit profile (player, new)

`BackLink` "Profile", title "Edit profile". Fields filled in from `GET /players/me`:
- **Name**, **Phone** (as at sign-up), **Position** (`OptionGroup`).
- **Area** (`SuggestionField`; helper "Your neighbourhood, like Dhanmondi. Don't enter your full address."; optional. PRODUCT.md: the field tells players not to enter a full address).
- **Height (cm)** and **Weight (kg)** (number keyboard, optional; ranges checked before sending).
- **Email** (disabled `TextField`, helper "Email can't be changed yet.").
- **Save changes** (primary, loading).

Sends every field (`PATCH /players/me`; empty optional fields as null). On success: goes back to Profile, and the app's logged-in user gets the new name (`AuthContext` `setUser`). A 400 shows the backend's message in an alert.
**[P31, approved]** No "Discard changes?" dialog on Back. Proposed by Claude Code. Reason: the form is short, and it keeps this feature small.

### My Venue (owner, rebuilt) [D2, approved]

The My Venue tab (today `OwnerProfileScreen`, renamed `MyVenueScreen`). No stack header: a `ScreenHeader` with the title "My Venue".
- The venue name (`title`), then a "Listing" `Card` of `ListRow`s: Phone (`phone` icon), Address (`area` icon), Website (`website` icon), Description. Empty rows show "Not added" (P26).
- The website is a `TextLink` only when `isWebLink` passes; otherwise plain text (D3).
- **Edit venue** (primary, `edit` icon).
- Loads `GET /owners/me` on focus and on pull to refresh; a failed first load shows "Couldn't load your venue." with Try again.
- Feature 3 adds the status pill ("Pending review" / "Live"), the missing-fields checklist, area, opening hours and pricing info.

### Edit venue (owner, new) [D2, approved]

`BackLink` "My Venue", or "Settings" when opened from Settings (Q3), title "Edit venue". Fields: **Venue name** (2–60), **Phone** (optional; the phone rule), **Address** (optional, multiline, at most 200; helper "So players can find you."), **Website** (optional; helper "Starts with https://"; checked with `isWebLink` before sending), **Description** (optional, multiline, at most 500, with a live count). **Save changes** (primary, loading). Sends every field (`PATCH /owners/me`); on success goes back, and the app's logged-in user gets the new venue name.

Today's `IndoorsListScreen` also opens websites: it gets the same `isWebLink` check (D3), with no other change.

### Owner Profile tab (new, replaces the interim Settings-as-Profile)

**[P32, approved]** (Q4) A `ScreenHeader` "Profile" with the gear (→ Settings). A `Card`: `Avatar` with the venue's initials, the venue name (`cardTitle`), a soft `Pill` "Venue owner", and Email (with "Only you can see this" and "Email can't be changed yet."). A `ListRow` **"Your venue listing"** (`venue` icon, chevron) → the My Venue tab. Proposed by Claude Code. Reason: an owner has no personal fields beyond the email; the listing itself lives on My Venue (PRODUCT.md), so Profile shows the account and points there.

### Settings (rebuilt, one screen for players and owners)

**[P29, approved]** One shared screen, `src/screens/Shared/SettingsScreen.js`, registered in each role's Profile stack. Proposed by Claude Code. Reason: the two old Settings screens are near copies.
- `BackLink` "Profile", title "Settings". A `Card` of tappable `ListRow`s with icons and a chevron:
  - **Edit profile** (`edit`) → Edit profile; for owners **Edit venue** → Edit venue (Q3).
  - **Change password** (`password`) → Change password.
  - **Terms of Use** and **Privacy Policy** (each opens its page in the browser). PRODUCT.md lists one "Terms & Privacy" row; two rows avoid an extra step (part of P29).
- **Log out** (danger text button) with a `ConfirmDialog`: "Log out?" / "You'll need your email and password to log in again." / **Log out** (danger). Logging out works as today.
- The old **About** and **Support** rows are dropped (part of P29): Support showed a made-up address, and Contact support arrives with the real support email (Phase 5).
- Later features add Blocked players, Contact support and Delete account (last, in red) to this screen.

### Change password (new)

`BackLink` "Settings", title "Change password", a line "You'll stay logged in on this phone. Any other phones will be logged out, and we'll email you to let you know." (Q5)
- **Current password**, **New password** (helper: the strength rule), **Confirm new password** (all `secure`).
- Checks before sending: all filled; the strength rule; new ≠ current (P14); the two new ones match.
- **Change password** (primary, loading).
- "Current password is incorrect" shows as the error under Current password (not an alert). A 429 shows in an alert.
- On success: the app saves the new token before anything else (`AuthContext` `changePassword` calls `saveToken`), then **[P27, approved]** one alert "Password changed" / "You're still logged in on this phone. Any other phones have been logged out." and goes back to Settings. Proposed by Claude Code. Reason: nothing visible changes otherwise, so this is the one place a success alert helps.
- **[P28, approved]** A `TextLink` **Forgot your current password?** opens a `ConfirmDialog` "Send a reset link?" / "We'll email a link to {email} to set a new password." / **Send link** (loading), which calls `POST /auth/forgot`. Proposed by Claude Code. Reason: it keeps the old Settings button's use (a logged-in user who forgot their password) without having to log out first.

**[P30, approved] Stale 401s after a change.** `src/api/api.js` ignores a 401 for a request that was sent with a token other than the one now saved. Proposed by Claude Code. Reason: a request sent with the old token just before the change would otherwise log out the very phone that changed the password.

### What happens to the old "Change Password" button

The old Settings button that emails a reset link is **removed** with the old Settings screens (`PlayerSettingsScreen`, `OwnerSettingsScreen`, deleted). Its job moves to the Change password screen (P28). **Forgot password on the Login screen stays.**

### Navigation

- **Auth stack:** `Login`, `RoleSelection`, `PlayerRegister`, `OwnerRegister`, `CheckEmail` (new), `ForgotPassword`, all with `headerShown: false` (each draws its own `BackLink`). The temporary `#F2F2F2` backgrounds go.
- **Player Profile stack:** `PlayerProfile` (now `headerShown: false`), `EditProfile`, `Settings`, `ChangePassword`.
- **Owner My Venue stack:** `MyVenue` (was `OwnerProfile`), `EditVenue`.
- **Owner Profile stack:** `OwnerProfile` (the new Profile tab screen), `Settings`, `ChangePassword`, and `EditVenue` again, so Settings → Edit venue goes back to Settings (Q3).
- `__tests__/navigation.test.js` changes with the route names.

## f. Edge cases

| Case | Backend | App |
|---|---|---|
| Double tap on Create account | A second request gets "Email already registered" | The loading Button ignores the second tap |
| The verification email fails to send | 201 with the "couldn't send" message (as today) | Check your email shows the "couldn't send" text and Resend |
| Terms box not ticked | `acceptedTerms` missing, false, "true" or 1: 400 "Please accept the Terms of Use and Privacy Policy" | Error under the box; nothing sent |
| Phone "01212345678", 10 or 12 digits, "+8801712345678", letters | 400 with the phone rule message | Error under the field before sending |
| Phone typed as "01712-345 678" | Spaces or dashes inside: 400 | `cleanPhone` sends "01712345678" |
| Position "Pivot", "forward" (lower case), missing | 400 with the position message / the "requires phone and position" message | The picker only sends the five values |
| An old app sends the long form | Height, weight, address, venue phone etc. are ignored; a free-text position gets 400 | No released app exists, so no real user hits this |
| Area "  dhanmondi   27 " | Stored as "dhanmondi 27" | Shown as stored |
| Area only spaces, or empty | Stored as null | Profile shows "Not added" |
| Area of 41 characters, or 1 | 400 "Area must be between 2 and 40 characters" | Checked before sending |
| A Bangla area or name | Counted in code points (40 Bangla letters fit) | Same |
| The owner clears the venue phone or address | Allowed in this feature (stored as null) | Feature 3 adds "an approved venue can't clear them" |
| Website "www.arena.com" or "javascript:…" | 400 "Website must start with http:// or https://" | Checked before sending; a stored bad link is plain text, never opened |
| A new owner with only a venue name | Appears in `GET /owners` with nulls (until feature 3 shows approved venues only) | The old Indoors list shows empty fields; acceptable until feature 3 |
| A player calls `PATCH /owners/me`, an owner `PATCH /players/me`, the admin either | 403 "Owners only" / "Players only" | No such screen for them |
| Wrong current password | 400 "Current password is incorrect"; nothing changes; counts toward the limit | Error under Current password; still logged in |
| 11th failed change in 15 minutes | 429 | Alert |
| Password changed on phone A while phone B is logged in | B's token now gets 401 | B shows "Your session has expired" on its next request and goes to Login |
| The change succeeds but the reply never arrives (network drop) | Password and `tokenVersion` changed | The saved token is the old one, so the next request gets 401 → session expired → log in with the new password |
| A request sent with the old token just before the change gets 401 afterwards | — | Ignored, because the saved token has changed (P30) |
| A reset link was requested before the change | The link no longer works (P15) | The reset page says the link is invalid |
| Two phones edit the same profile at once | The later save wins | Profile reloads on focus |
| The name is changed | `GET /auth/me`, team lists and admin lists show the new name | `AuthContext` user updated at once; other lists on their next load |
| Stored phones that don't match the new rule | None left: the five found on 2026-11-22 are fixed before the migration (Q2). If one appears later, saving Edit profile requires a valid number | Edit profile shows the error under Phone |
| The password-changed notice email fails to send | Logged; the reply is still 200 with the new token (the password is already changed) | Nothing different |
| Terms or Privacy page opened with no connection | — | The phone's browser shows its own error |

## g. Notification hook points

None. PRODUCT.md's notification events don't include profile edits, password changes or sign-ups. ("Your venue was approved" belongs to feature 3.)

## h. Test plan

**Backend** (`node:test`, real HTTP against the local server, throwaway users, as in `tests/helpers.js`):
- `tests/registration-short.test.js`: player and owner short forms create the right rows, with `termsAcceptedAt` set to about now; extra old fields (height, weight, address, venue phone) are ignored, not stored; `acceptedTerms` missing, false, "true", 1 → 400; Terms checked last (a bad phone and no Terms gives the phone message); each of the five positions accepted; "Pivot", "forward", "" refused; the phone rule: 0131…, 0191… accepted, 0121…, 10 and 12 digits, "+880…", spaces inside refused, spaces at both ends trimmed; the owner without a venue name gets "Venue name is required".
- `tests/profile-edit.test.js`: `PATCH /players/me` saves every field and replies in the GET shape; area tidying, 2–40, blank to null, Bangla counted in code points; height and weight cleared with null; every message in d.3; owner and admin 403; `GET /auth/me` returns the new name.
- `tests/venue-edit.test.js`: `PATCH /owners/me` with and without the optional fields; the phone rule when given; blank to null; trimming (P13); website cases from P18; player and admin 403.
- `tests/change-password.test.js`: success returns a token that works and logs in with the new password; the old token and a second "device" token get 401; wrong current password → 400 (not 401), `tokenVersion` unchanged; weak, too long (73 bytes) and same-as-current new passwords → 400 with their messages; missing fields; a pending reset link stops working; the notice email is attempted after a success and not after a failure (the mailer's log line for `@example.com`), and a failed send still replies 200; the per-account limit (11th failure → 429, using a fixed `X-Forwarded-For`, like `rate-limits.test.js`) and that a success doesn't count.
- `tests/mailer.test.js` (updated): the password-changed email through the in-memory `streamTransport`: subject, the escaped name, no link.
- `tests/legal-pages.test.js`: both pages answer 200 HTML with their title and the draft line, without login; helmet's content security policy header is present.
- `tests/profiles-data.test.js` (after the migration): `position` only takes the five values; `area` exists and `address` doesn't; `OwnerProfile.phone` and `address` accept null; `termsAcceptedAt` exists.
- Updated: `visibility.test.js` (others see `area` in `GET /players` and team members; phone and email still hidden), `auth-validation.test.js` and `registration-and-reset.test.js` (new messages, short forms), `rate-limits.test.js` (the new limiter), `helpers.js` and every test that registers or creates players with old values (phone "1", position "p" or " Defender ", `address`), `route-ids.test.js` if it lists routes.

**App** (Jest, fake API like `__tests__/navigation.test.js`):
- Components: `Checkbox`, `OptionGroup` and `SuggestionField` (roles and states, 44-tall targets, errors, suggestion matching and tapping); they pass the raw-colour and font guard in `components-composite.test.js`.
- `src/utils/phone.js`, `src/utils/links.js` (`isWebLink`, the P18 cases) and `src/constants/areas.js` (matching ignores case, matches inside words, at most 5, hides on an exact match).
- Player and owner sign-up: each field error; the phone stripped and checked; Terms required; the payload sent (`acceptedTerms: true`, position value); the loading Button; Check your email for both replies, with Resend.
- Login: loading; 403 shows the notice and Resend (loading); Create an account and Forgot password links. Forgot password: loading, then the confirmation text.
- Profile: own fields, "Not added", privacy hints, Edit profile button, the failed-load state. Edit profile: filled in, area suggestions, the PATCH payload (nulls for empty fields), going back, `setUser` with the new name.
- My Venue, Edit venue and the owner Profile tab: fields, "Not added", website link only when `isWebLink` passes, the PATCH payload.
- Settings: rows per role, Terms and Privacy open the right addresses, Log out with its dialog.
- Change password: checks before sending; "Current password is incorrect" under the field; on success the new token is saved before the alert; Forgot your current password? sends `/auth/forgot` after the dialog.
- `api.js`: a 401 for a request sent with an old token doesn't call the session-expired handler (P30).
- Navigation: the new routes in each role's stacks.
- `npm run lint`, `npx prettier --check src App.js`, `npm test`.

**On the emulator** (for the owner; backend running; log out and in to switch accounts):
1. Login is in the new design. **Forgot password?** → send to your own email → the confirmation text shows; the email arrives.
2. **Create an account → I'm a player.** Tap Create account on the empty form: errors under each field. Type phone `01212345678`: phone error. Leave Terms unticked: error under the box. Tap **Terms of Use** and **Privacy Policy**: each opens a draft page in the browser.
3. Fill in a real player (phone typed as `01712-345678`), tick Terms, create: the button spins once, then Check your email. Tap **Resend email**: a line confirms it.
4. Verify from the email, log in. **Profile**: name, position pill, phone with "Only your teammates can see this", email with "Only you can see this", Area, Height and Weight "Not added".
5. **Edit profile**: type `dhan` in Area → "Dhanmondi" is suggested; tap it. Change it to `Dhanmondi 27`, add a height, save. Profile shows the new values. Change the name: My Teams and the team page show it after a reload.
6. **Settings → Change password**: a wrong current password shows the error under the field and you stay logged in. Then change it properly: the alert shows and you're still logged in, and a "Your ConnectArena password was changed" email arrives. Log out and log in with the new password; the old one fails.
7. If you have a second phone or emulator logged in to the same account: after step 6 its next action shows "Your session has expired".
8. **Create an account → I run a venue** with only a venue name. After verifying and logging in: **My Venue** shows "Not added" rows and **Edit venue**. Enter website `arena.com`: error. Enter `https://example.com`, a phone and an address, save. The website opens in the browser.
9. Owner **Profile** tab: venue name, "Venue owner", email, **Your venue listing** opens My Venue. **Settings**: Edit venue, Change password, Terms of Use, Privacy Policy, Log out (with the dialog).
10. Set the phone's font size to the largest: sign-up, Edit profile and Settings wrap without cutting text. Android back from each new screen returns to the screen before.

## i. Task split

1. **F2.1 Backend.** First, fix the five phone numbers in the local database (Q2) and show the position mapping from the data at that moment; then, after the owner approves the migration: the migration (section c), `profileFields.js`, registration, `PATCH /players/me` with Area visibility, `PATCH /owners/me` with the website check, change password with `signLoginToken`, its limiters and the notice email, the legal pages, and the tests in section h. Small commits: migration · registration · player edit and visibility · venue edit · change password and notice email · legal pages. CLAUDE.md, ARCHITECTURE.md and README updated in the same commits.
2. **F2.2 Sign-up and auth screens.** `Checkbox` and `OptionGroup` (with gallery entries, tests, DESIGN.md), `src/utils/phone.js`, Login, Role selection, Player sign-up, Owner sign-up, Check your email, Forgot password, and the `AuthContext` changes. Removes the temporary register backgrounds.
3. **F2.3 Player profile, Settings and Change password.** `SuggestionField` and the area list, Player Profile, Edit profile, the shared Settings screen, Change password (with P28), the `api.js` fix (P30). Deletes `PlayerSettingsScreen`.
4. **F2.4 Venue owner screens.** My Venue, Edit venue, `isWebLink` (also in `IndoorsListScreen`), the owner Profile tab, Settings for owners. Deletes `OwnerSettingsScreen`. Updates PRODUCT.md's interim screens list (the owner Profile stand-in is gone).

Then the ROADMAP items are ticked.

## j. Answered questions

Questions the docs didn't settle, and contradictions found while writing this spec. The owner answered them on 2026-11-22; the answers are built into the sections above.

| | Question | Answer |
|---|---|---|
| Q1 | Should venue phones also accept landline numbers (Dhaka landlines start with 02), or mobile only like players? | **Mobile only**, the same rule as players. Widening it later needs no migration, only a changed check. |
| Q2 | Five stored phone numbers don't match the new rule (players 5, 35, 761, 6210; owner 1684). What happens to them? | **Claude Code changes them to valid made-up mobile numbers** in the local database at the start of F2.1, and says which rows changed. |
| Q3 | What is "Edit profile" in an owner's Settings? | **The row reads "Edit venue"** and opens Edit venue. |
| Q4 | What does the owner's Profile tab show? | **The account:** venue name, "Venue owner", email, and a link to My Venue (P32). |
| Q5 | Should a password change email a short notice? | **Yes.** A short notice with no link (d, endpoint 6). PRODUCT.md's list of account emails is widened. |
| Q6 | Which areas go in the suggestion list? | **The starter list in P6.** |
| Q7 | Contradiction: existing validation messages are kept word for word (DECISIONS.md 2026-11-20), but two become untrue. | **Replace them with suitable new messages:** "Enter a Bangladeshi mobile number: 11 digits starting with 01, like 01712345678" and "Venue name is required", plus the new "Position must be Goalkeeper, Defender, Midfielder, Forward or Any" and "Please accept the Terms of Use and Privacy Policy". A message whose rule changes is replaced; every other message keeps its words. |
| Q8 | Should the app capitalise areas or names automatically? | **No.** Stored as typed (P4). |
| Q9 | Contradiction (code vs docs): the app says "ConnectArena", the docs said "Connect Arena". | **"ConnectArena"** (the owner's preference, against Claude Code's recommendation). The docs' titles were changed to match. |

## k. Proposals (all approved 2026-11-22)

Defaults from the brief, confirmed:
- **D1** Terms of Use and Privacy Policy are backend web pages with placeholder text until Phase 5; the app's links open them (a, d endpoint 7, e).
- **D2** Owners edit their existing venue fields (name, phone, address, website, description) on My Venue in this feature (a, d endpoint 5, e).
- **D3** The http/https website check moves into this feature, backend and app (a, d endpoint 5, e). ROADMAP.md shows the move.
- **D4** Login, Role selection and Forgot password are rebuilt in the new design here (a, e).
- **D5** Change password is rate-limited per account and per IP, like login (d endpoint 6).

Proposed by Claude Code, approved:
- **P1** Position values are an enum spelled exactly as shown (Goalkeeper, Defender, Midfielder, Forward, Any) (b).
- **P2** The "obvious match" words for mapping old positions, including futsal terms (c).
- **P3** Area is 2–40 characters after tidying (b).
- **P4** Area tidying: trim, collapse inner whitespace to one space, keep the letters as typed (b).
- **P5** The area suggestion list lives in the app; matching ignores case, matches inside names, shows at most 5 (b).
- **P6** The starter area list (b; Q6).
- **P7** `User.termsAcceptedAt`; existing accounts null and not asked again in v1.0 (b, c).
- **P8** The app strips spaces and dashes from phones; the backend accepts the 11 digits only (b, e).
- **P9** The Terms check runs last in registration, with "Please accept the Terms of Use and Privacy Policy" (d endpoint 1).
- **P10** The register request keeps today's shape plus `acceptedTerms` (d.2).
- **P11** `PATCH /players/me` and `PATCH /owners/me` take every field each time (d.2).
- **P12** Players can change their name on Edit profile (b).
- **P13** Optional text is trimmed on the edit endpoints (d.1).
- **P14** A new password must differ from the current one (d endpoint 6).
- **P15** A password change also cancels any pending reset link (d endpoint 6).
- **P16** `area` is added to `GET /players` and the team member lists (d endpoint 8).
- **P17** The legal pages live at `/legal/terms` and `/legal/privacy`, without a rate limit (d endpoint 7).
- **P18** A web link must parse as a URL with an http/https scheme and a host; the app uses the same check (d endpoint 5).
- **P19** New shared components: `Checkbox`, `OptionGroup`, `SuggestionField` (e).
- **P20** Create account stays enabled while Terms is unticked, and shows the error under the box (e).
- **P21** The app repeats the password strength rule (e).
- **P22** A "Check your email" screen after sign-up, with Resend (e).
- **P23** Login: a "Create an account" link replaces the Login/Signup tabs (e).
- **P24** Forgot password shows its confirmation on screen instead of an alert (e).
- **P25** Privacy hints under Phone and Email on the player's Profile (e).
- **P26** Empty optional profile and listing rows show "Not added" (e).
- **P27** One "Password changed" alert after a change (e).
- **P28** "Forgot your current password?" on Change password sends a reset link (e).
- **P29** One shared Settings screen with Terms of Use and Privacy Policy as two rows; the old About and Support rows are dropped (e).
- **P30** `api.js` ignores a 401 for a request sent with a token that's no longer saved (e).
- **P31** No "Discard changes?" dialog on the edit screens (e).
- **P32** The owner's Profile tab shows the account and links to My Venue (e; Q4).

