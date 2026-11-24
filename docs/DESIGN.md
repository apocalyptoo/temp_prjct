# ConnectArena: Design System ("Floodlight")

The visual design for v1.0. Every screen follows this file. What screens exist and how navigation works is in [PRODUCT.md](PRODUCT.md) under "App structure and navigation".

**Visual reference for components and screens** (the two approved Floodlight mockups):

- [My Teams](design/floodlight-my-teams.png)
- [Team detail, as captain](design/floodlight-team-detail-captain.png)

Where the mockups differ from decisions made since (the decisions win):

- Positions show futsal terms (Winger, Pivot). The real list is Goalkeeper, Defender, Midfielder, Forward, Any (PRODUCT.md, "Registration").
- ~~The members card shows a few members with "See all 11".~~ **Resolved 2026-11-21:** the Members card lists every accepted member, with no "See all" link (DECISIONS.md, "Team membership details for the screens").
- The Team detail "Join requests" header shows a "2 new" pill. **Decided 2026-11-21:** it shows the plain count ("2"), because nothing records which requests the captain has seen.
- The "Salam, Rahim" greeting wording is still to be confirmed. Until then, My Teams has no greeting (decided 2026-11-21).

---

## 1. The idea

Dark and energetic, like a floodlit indoor court at night. A near-black background, slightly lighter cards, one neon-lime accent for the main action on each screen, and tall condensed headings that feel sporty.

**Rule of one accent:** lime marks the most important action or state on a screen (the main button, the active tab, "Captain"). If everything is lime, nothing stands out.

## 2. The look must be changeable (theme tokens)

The look will change later (new colors, maybe a light theme). So:

- **All colors, fonts, font sizes, spacing, corner radii and shadows live in one place**: the theme module. It exports named values called **tokens**, like `colors.accent` or `spacing.md`.
- **Screens and components never contain raw values.** No hex colors, font names or loose pixel sizes in screen files. They always use tokens.
- **Changing the look = editing the theme module.** Swapping the palette below for another must not require touching any screen.
- **Repeated pieces are shared components**, so each looks the same everywhere and is styled in one place.
- Light theme and theme switching are **not in v1.0**. The structure below makes them possible later without editing screens again.

### Folder structure

```
IndoorFootballApp/src/
  theme/
    palette.js        raw colors with plain names (e.g. lime, nearBlack, slate900)
    colors.js         meanings (bg, surface, text, accent, danger…) pointing to palette colors
    typography.js     font families + named text styles (display, title, body, meta…)
    spacing.js        the spacing scale
    radius.js         corner radii
    shadows.js        minimal: only for floating things (dialogs, pop-ups), not cards
    index.js          puts it all together as one `theme` object
    ThemeProvider.js  provides the theme to the app, with a useTheme() hook
  components/
    ui/               Button, Card, Pill, Badge, Avatar, ListRow, ScreenHeader,
                      TabBar, Icon, EmptyState, ConfirmDialog
```

### Three rules that make the look changeable

1. **Two color layers.** `palette.js` holds the actual colors. `colors.js` gives them meanings. Screens use only the meanings (`colors.accent`, never `palette.lime`). Changing the look means pointing the meanings at different palette colors, or swapping the palette. A future light theme is a second `colors` mapping with the same names.
2. **Screens get the theme through `useTheme()`**, not by importing theme files directly. That way a light/dark switch can be added later without touching screens.
3. **Icons go through the `Icon` component.** Screens use our own icon names (`<Icon name="teams" />`), and `Icon` maps them to the icon library. Changing icon sets later means editing one file.

## 3. Colors

| Token | Hex | Used for |
|---|---|---|
| `bg` | `#0E1116` | Screen background |
| `surface` | `#171B22` | Cards, sections, secondary buttons |
| `border` | `#262C36` | Card borders, dividers between rows, outlined buttons |
| `text` | `#F3F5F7` | Main text and headings |
| `textMuted` | `#9AA3AF` | Secondary text: descriptions, meta info, back links |
| `accent` | `#C6F432` | Main buttons, active tab, "Captain" pill, links |
| `onAccent` | `#0E1116` | Text and icons placed on `accent` |
| `accentSoft` | `#C6F432` at 13% opacity (`#C6F43222`) | Soft pill backgrounds (e.g. "Player", "2 new") |
| `tabBar` | `#12161C` | Bottom tab bar background |
| `tabIdle` | `#7D8794` | Inactive tab icons and labels |
| `danger` | `#FF7A7A` | Destructive actions (Delete account, Remove, Leave team) and error text |
| `badge` | `#FF5C5C` | Notification count badge and "waiting for you" dots |
| `onBadge` | `#0E1116` | Text on `badge` |
| `avatarBg` | `#262C36` | Avatar circle background |
| `avatarText` | `#C6F432` | Avatar initials |
| `shadow` | `#000000` | Colour of the one `floating` shadow (section 5) |
| `scrim` | `#0E1116` at 70% opacity (`#0E1116B3`) | The dimmed backdrop behind dialogs |

**Readability rules (checked):**
- Text on `bg` or `surface` uses `text` or `textMuted` only. Both pass the standard contrast check (4.5:1).
- Text on `accent` or `badge` is always dark (`onAccent` / `onBadge`). White on lime or on this red is too faint.
- Never tell things apart by color alone. Pair the color with a word or an icon (e.g. a red dot plus "2 join requests").

## 4. Typography

Two font families, both from Google Fonts (free to use in apps under the Open Font License):

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings | **Barlow Condensed** | 700 (Bold) | Always UPPERCASE, letter spacing +2% |
| Everything else | **Inter** | 400 / 500 / 600 / 700 | Body, labels, buttons |

**Font files.** Each weight is its own static `.ttf` file, and the file name is the `fontFamily` used in code (`fonts` in `typography.js`): `BarlowCondensed-Bold`, `Inter-Regular` (400), `Inter-Medium` (500), `Inter-SemiBold` (600), `Inter-Bold` (700). On Android a custom font's weight comes from its file, so text styles set `fontFamily` per weight and never `fontWeight`.

| Token | Font, size | Line height | Used for |
|---|---|---|---|
| `display` | Barlow Condensed 34 | 37 | Screen titles ("MY TEAMS") |
| `title` | Barlow Condensed 36 | 40 | Detail page titles (team name) |
| `cardTitle` | Barlow Condensed 22 | 24 | Team or venue names in cards |
| `section` | Barlow Condensed 18 | 20 | Section headings inside cards ("JOIN REQUESTS") |
| `stat` | Barlow Condensed 34 | 37 | The numbers on the admin Dashboard's tiles (added with the venues feature) |
| `body` | Inter 15, 400 | 22 | List item text |
| `bodyStrong` | Inter 15, 600 | 22 | List item names |
| `bodySmall` | Inter 14, 400 | 20 | Descriptions, back links |
| `meta` | Inter 13, 400 | 19 | Member counts, positions, areas |
| `pill` | Inter 12, 700 | 17 | Pills |
| `tabLabel` | Inter 11, 500 | 16 | Tab labels |
| `tabLabelActive` | Inter 11, 600 | 16 | The active tab's label |
| `button` | Inter 14, 700 | 20 | Primary button labels |
| `buttonSecondary` | Inter 14, 600 | 20 | Secondary button labels |
| `badge` | Inter 11, 700 | 16 | Badge counts |

- **Line height:** 1.1 × size for headings and 1.45 × size for everything else, rounded to whole pixels (the values above).
- **Letter spacing:** headings +2% of the size (size × 0.02, e.g. 0.68 for `display`); Inter 0.
- **Heading styles include the uppercase transform and the letter spacing**, so screens never set them by hand.

## 5. Spacing and shape

**Spacing scale** (`spacing` tokens): `xxs` 4 · `xs` 8 · `sm` 10 · `md` 12 · `lg` 16 · `xl` 20 · `xxl` 24 · `xxxl` 28.

**Layout tokens** (also in `spacing`). Screens should prefer these, and use the scale only for one-off gaps:
- `screenPadding` 20: screen side padding
- `cardPadding` 16: card padding
- `listGap` 20: gap between cards on list screens
- `detailGap` 18: gap between cards on detail screens (not on the scale, on purpose)
- `cardGap` 12: gap inside a card (`sm` 10 where it needs to be tighter)

**Corner radius** (`radius` tokens):
- `card` 14: cards and sections
- `button` 10: buttons and icon buttons
- `small` 6: small square controls (the checkbox box), so they don't look round
- `round` 999: pills, badges and avatars (fully round)

**Touch targets:** anything tappable is at least **44×44** (`touchTarget` token).

**Sizes** (`sizes` tokens), used as minimums wherever something holds text, so it can grow with the phone's font size:
- `field` 48: text field minimum height
- `button` 46: button minimum height
- `avatarSmall` 38 / `avatarLarge` 44: avatars in list rows / in team cards
- `badge` 18: badge minimum width and height
- `dot` 8: the small "waiting for you" dot
- `border` 1: the 1px lines (card borders, dividers, outlined buttons, fields)
- `dialogMaxWidth` 400: confirmation dialogs on wide screens
- `logo` 72: the ball logo on the Login screen (a fixed size: it holds no text)

**Opacity** (`opacity` tokens): `disabled` 0.45 for disabled controls (they also say so to screen readers), `pressed` 0.8 while a tappable card or button is held down.

**Icon sizes** (`icon` tokens): `size` 24 by default, `sizeSmall` 16 for icons inside text lines (the error icon, the "Captain" crown). Stroke width `strokeWidth` 1.8.

**Shadow** (`shadows` tokens): only `floating`, for dialogs and pop-ups, never cards: colour `shadow`, offset 0 × 4, opacity 0.3, radius 12, and Android `elevation` 8.

## 6. Components

All shared components live in `IndoorFootballApp/src/components/ui/`, one file each, exported together from `index.js`. Screens are built from them. Rules for every component:
- **Styles only from theme tokens** (through `useTheme()`): no raw colours, font names or loose sizes. A missing value becomes a new token, recorded here.
- **Tappable things** are at least `touchTarget` (44) in both directions, with the right accessibility role, an accessibility label wherever there's no visible text, and accessibility state (disabled, busy).
- **Text can grow** with the phone's font-size setting: things wrap rather than clip, and nothing that holds text has a fixed height, only a minimum.
- **Small, plain props.** No component knows about the backend or navigation (BackLink only takes an `onPress`). Each component accepts an optional `style` for layout only (margins, flex, width), never colours or fonts.

**Text.** Every piece of text uses it: `<Text variant="bodySmall" color="textMuted">`. `variant` is any typography token (default `body`), `color` is any colour meaning (default `text`). Screens never set fonts by hand.

**Screen.** The standard screen container: `bg` background, `screenPadding` on the sides, keeps clear of the status bar and notches (the `edges` it protects; by default the top only, because a header or the tab bar covers the others). Optional `scroll` (content scrolls) and `keyboardAware` (form fields stay above the keyboard). Long forms scroll up to the first field with a problem when the main button finds one, so an error is never off screen. The app is wrapped in one `SafeAreaProvider` for this.

**Primary button.** `accent` background, `onAccent` text (Inter 14/700), radius 10, height at least 44–46. Optional leading icon. Use one per screen for the main action ("Create team", "Invite players").

**Secondary button.** `surface` background, 1px `border`, `text` label (Inter 14/600). For the second action ("Transfer captaincy").

**Danger action.** `danger` text, on `surface` or as a text button. Never lime. Always asks for confirmation first.

**Loading state (every button that sends a request).** While the request runs, a small spinner in the label's colour replaces the label, the button keeps its size, and further taps are ignored until the request finishes.

**Icon button.** 44×44, radius 10. Approve = `accent` with a check icon. Reject = outlined with `border` and an X icon in `textMuted`. Always has an accessibility label ("Approve Nayeem Islam").

**Card.** `surface` background, 1px `border`, radius 14, padding 16. A whole card can be tappable (team cards open Team detail).

**List row** (inside cards). Avatar (38–44) + name (`body`) + meta (`meta`, `textMuted`) + optional trailing item (pill, "Captain" label, chevron) + optional action buttons (icon buttons, a small Invite or Cancel button). When the whole row is tappable (a person row that opens Player detail), the action buttons sit beside the tappable part, never inside it: pressing a button never opens the row, and each button stays its own 44×44 target for screen readers. Rows are separated by a 1px `border` line. Rows that aren't people ("Phone", "Change password") show an icon in `textMuted` instead of the avatar, and a row can have a third line for a hint in `meta` / `textMuted` ("Only your teammates can see this").

**Pill.** Strong: `accent` background, `onAccent` text ("Captain"). Soft: `accentSoft` background, `accent` text ("Player", "11 / 15 members", "2 new").

**Badge.** `badge` background, `onBadge` text, Inter 11/700, minimum 18×18, sits on the top-right of the Notifications tab icon. It shows pending actions plus unread updates.

**Avatar.** A circle with `avatarBg` and initials in `avatarText`. There are no profile photos in v1.0. Sizes `avatarSmall` (38, list rows) and `avatarLarge` (44, team cards).
- **Initials:** the first whole character of the first two words that **start with a letter**, in any script (Unicode letters, so Bangla and other non-Latin names work), in uppercase. A whole character keeps the marks attached to it: a Bangla vowel sign (রাহাত হাসান → রাহা), an accent, or a joined letter (ক্ষ).
- **Skipped:** words that start with an emoji, a flag, a number or a symbol. Emoji never appear in initials.
- **"?"** when no word starts with a letter (an empty name, or only emoji, numbers or symbols).
- Examples: "Nayeem Islam" → NI · "🇧🇩 Tanvir Ahmed" → TA · "👍🏽 Fahim" → F · "10 Rahim Uddin" → RU · "👨‍👩‍👧" → ?

**Bottom tab bar.** `tabBar` background with a 1px `border` top line. Each tab is an icon (24) plus a label (`tabLabel`). Active: `accent`. Inactive: `tabIdle`. The tabs per role are in PRODUCT.md.

**Screen header.** Optional small greeting or back link (`textMuted`), then the title (`display`). The primary action can sit to the right of the title.

**Back link.** A chevron icon plus the previous screen's name, in `textMuted`, at least 44 tall. Screen readers hear "Back to My Teams". When the previous screen has no short name, the link shows and reads just "Back".

**Empty states.** Every list has one: a short line saying what's missing, plus the main action (e.g. "You're not in a team yet." + "Create team").

**Confirmation dialogs.** Used for destructive or important actions (leave team, transfer captaincy, delete account). The title says exactly what will happen. The confirm button uses `danger` for destructive actions.

**Text field.** There's no field in the mockups, so this is the agreed design:
- Label above the field, in `bodySmall` / `textMuted`.
- The field: `surface` background, 1px `border`, radius `button` (10), at least `sizes.field` (48) tall. Text in `body` / `text`, placeholder in `textMuted`, cursor and selection in `accent`.
- Focused: the border turns `accent`.
- Error: the border turns `danger`, and under the field a `warning` icon (`icon.sizeSmall`) plus the message in `meta` / `danger`. The icon and the words carry the meaning, never the colour alone.
- Optional helper text under the field, in `meta` / `textMuted`. An error replaces it while shown.
- Optional leading icon (added with the venues feature, for the venue search): one of our icons, `icon.size`, in `textMuted`, at the left inside the field, `spacing.sm` before the text. Decorative: the label says what the field is.
- Password fields have a show/hide button inside the field on the right: 44×44, icon `show` or `hide`, labelled "Show password" / "Hide password".
- Disabled: `opacity.disabled` and not editable.
- The field grows with the phone's font size (a minimum height only). Screen readers hear the label and the error with the field.

**Checkbox** (added with feature 2, for the Terms box at sign-up). A 24×24 box (corner `small`) inside a 44×44 touch target, with the sentence beside it in `body`. Unticked: `surface` with a 1px `border`; ticked: `accent` with the `approve` check (`icon.sizeSmall`) in `onAccent`. Tapping the box or the sentence toggles it. Links that belong with it (Terms of Use, Privacy Policy) sit in their own row under the sentence, lined up with it: a link inside a wrapped sentence can't be 44 tall. An error shows under it like a text field's (`warning` icon plus the message in `meta` / `danger`), and the box's border turns `danger`. Screen readers hear a checkbox with its sentence, whether it's ticked, and the error.

**Option group** (added with feature 2, the position picker). A label above (`bodySmall` / `textMuted`), then the options as chips in a wrapping row, each at least 44 tall, radius `button`. Chosen: `accent` background, `onAccent` text (`button`); the others: `surface` with a 1px `border` and `text` (`buttonSecondary`). One choice at a time. An error shows under it like a text field's. Screen readers hear a radio group with its label, and each option as a radio button with its selected state.

**Suggestion field** (added with feature 2, for the player's Area; the venues feature reuses it). A text field with a short list of suggestions right under it, inside the page (not a floating pop-up): a `surface` box with a 1px `border` and radius `button`, one row per suggestion (at least 44 tall, a small `area` icon in `textMuted` and the name in `body`), rows separated by dividers. At most 5 suggestions, shown only while the field is focused and something matches; tapping one fills the field. Any other text can still be typed. Screen readers hear each row as "Suggestion: Mirpur".

**Section header.** A heading row inside a card: the title (`section`) on the left and an optional item on the right, such as a soft Pill ("2 new") or a TextLink ("See all 11").

**Text link.** Tappable text in `accent`, `bodySmall` at semibold weight (`buttonSecondary` style), at least 44 tall to tap. For links inside cards ("See all 11"). The back link is the muted version of the same idea.

**Notice line.** A line that something is waiting: a `sizes.dot` (8) dot in `badge`, strong text in `bodyStrong`, then muted text in `body` / `textMuted` ("● **2 join requests** waiting for you"). The words carry the meaning; the dot only draws the eye.

**Divider.** A 1px `border` line across a card, between its parts and between list rows.

**"Captain" label in a row.** Not its own component: a `captain` icon (`icon.sizeSmall`, `accent`) plus "Captain" in `accent`, passed as the list row's trailing item.

**Built from these, not shared components:** two buttons side by side are a layout (each Button gets a `style` with flex). A team card belongs to the team feature and is built from Card, Avatar, Text, Pill, Divider and NoticeLine.

## 7. Icons

- **Icon set: [Lucide](https://lucide.dev)** (`lucide-react-native`), which draws its icons with `react-native-svg`. Lucide is a widely used, actively maintained open-source line icon set with 1,000+ icons in one consistent style.
- Line (stroke) icons, 24×24, **stroke width 1.8**, rounded ends. No filled icons, no emoji.
- Icons take the color of the text next to them.
- Icon-only buttons always have an accessibility label.
- Screens never import Lucide directly. They use the shared `Icon` component with our own names (see section 2).
- The old `react-native-vector-icons` (Ionicons) is **replaced**. Remove it once no screen uses it, including its font files and config entries.

**Our icon names** (`src/components/ui/Icon.js`, which maps them to Lucide). `<Icon name="…" />` takes `size` (default `icon.size`, 24), `color` (default `colors.text`) and an optional `accessibilityLabel`: with a label the icon is announced as an image; without one it's decorative and hidden from screen readers. The stroke width comes from the `icon.strokeWidth` token (1.8). An unknown name shows nothing (and warns in development).

| Group | Our name → Lucide icon |
|---|---|
| Navigation | `teams` Users · `explore` Compass · `notifications` Bell · `profile` User · `settings` Settings · `dashboard` LayoutDashboard · `reports` ShieldAlert · `venues` Building2 · `users` IdCard |
| Movement | `back` ChevronLeft · `forward` ChevronRight |
| Actions | `add` Plus · `approve` Check · `reject` X · `search` Search · `filter` Funnel · `edit` Pencil · `delete` Trash2 · `invite` UserPlus · `remove` UserMinus · `leave` DoorOpen · `logout` LogOut · `transfer` ArrowRightLeft · `show` Eye · `hide` EyeOff (show or hide a password) |
| Things | `captain` Crown · `area` MapPin · `venue` Building2 · `phone` Phone · `email` Mail · `website` Globe · `password` Lock · `report` Flag · `block` Ban · `time` Clock · `position` Shirt · `height` Ruler · `weight` Weight · `terms` FileText (the Terms of Use page) · `privacy` ShieldCheck (the Privacy Policy page) · `description` Text (a venue's description; added with feature 2) · `price` Banknote (a venue's pricing info; added with the venues feature) |
| States | `success` CircleCheck · `warning` TriangleAlert |

To add an icon: import it in `Icon.js` from its own file (`lucide-react-native/icons/<name>`) and add one line to the map. Importing from `lucide-react-native` itself would put every Lucide icon in the app.

## 8. Accessibility checklist (every screen)

- Contrast follows section 3.
- Touch targets are 44×44 or bigger.
- Every icon-only button has a label for screen readers.
- Text can grow with the phone's font-size setting without breaking the layout (cards wrap rather than clip).
- Meaning never depends on color alone.

## 9. Implementation notes (for Claude Code)

- **Theme module first:** create the theme folder and the shared components (section 2) before restyling screens. Then restyle screens one by one.
- **Fonts:** Barlow Condensed and Inter are font files in `IndoorFootballApp/assets/fonts/` (from Google Fonts, with their OFL licenses), listed in `react-native.config.js` and copied by hand into `android/app/src/main/assets/fonts/`. iOS isn't linked yet.
- **Icons:** `lucide-react-native` 1.70.0 and `react-native-svg` 15.16.1 are installed (Task 4.4; react-native-svg 15.16+ is required for React Native 0.80+). Before upgrading either, check the versions work with the app's React Native version and tell me which versions you chose. Remove `react-native-vector-icons` once nothing uses it (the last item of ROADMAP Step 4).
- **Status bar:** always light content (white icons) on `bg`, whatever the phone's light/dark setting (set in `App.js`). React Navigation gets a theme built from the tokens too, so its backgrounds and headers are dark.
- **Dark only in v1.0.** Don't build theme switching yet. Just keep every value in tokens and use `useTheme()`.
- **The existing UI code isn't a constraint.** It was written as a university project. Replace screens, styles and components properly wherever they conflict with this design. Don't patch around them.
- **Restyling and behaviour changes are separate tasks.** A restyle commit changes how a screen looks, not what it does. Text or behaviour fixes (e.g. "Owner" → "Captain") get their own task.
