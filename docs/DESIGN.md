# Connect Arena: Design System ("Floodlight")

The visual design for v1.0. Every screen follows this file. What screens exist and how navigation works is in [PRODUCT.md](PRODUCT.md) under "App structure and navigation".

Reference mockups (My Teams and Team detail): the "Connect Arena – Visual Directions" canvas, direction **A. Floodlight**.

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

| Token | Font, size | Used for |
|---|---|---|
| `display` | Barlow Condensed 34 | Screen titles ("MY TEAMS") |
| `title` | Barlow Condensed 36 | Detail page titles (team name) |
| `cardTitle` | Barlow Condensed 19 | Team or venue names in cards |
| `section` | Barlow Condensed 18 | Section headings inside cards ("JOIN REQUESTS") |
| `body` | Inter 15, weight 600 for names | List item names |
| `bodySmall` | Inter 14 | Descriptions, back links |
| `meta` | Inter 13 | Member counts, positions, areas |
| `pill` | Inter 12, weight 600–700 | Pills |
| `tabLabel` | Inter 11, weight 500 (600 when active) | Tab labels |
| `button` | Inter 14, weight 700 (600 for secondary) | Button labels |

Line height: about 1.1 for headings, 1.45 for paragraphs.

## 5. Spacing and shape

**Spacing scale** (`spacing` tokens): 4 · 8 · 10 · 12 · 16 · 20 · 24 · 28.
- Screen side padding: 20
- Card padding: 16
- Gap between cards: 20 on list screens, 18 on detail screens
- Gap inside a card: 10–12

**Corner radius** (`radius` tokens):
- Cards and sections: 14
- Buttons and icon buttons: 10
- Pills and badges: fully round (999)
- Avatars: circles

**Touch targets:** anything tappable is at least **44×44**.

## 6. Components

**Primary button.** `accent` background, `onAccent` text (Inter 14/700), radius 10, height at least 44–46. Optional leading icon. Use one per screen for the main action ("Create team", "Invite players").

**Secondary button.** `surface` background, 1px `border`, `text` label (Inter 14/600). For the second action ("Transfer captaincy").

**Danger action.** `danger` text, on `surface` or as a text button. Never lime. Always asks for confirmation first.

**Loading state (every button that sends a request).** While the request runs, a small spinner in the label's colour replaces the label, the button keeps its size, and further taps are ignored until the request finishes.

**Icon button.** 44×44, radius 10. Approve = `accent` with a check icon. Reject = outlined with `border` and an X icon in `textMuted`. Always has an accessibility label ("Approve Nayeem Islam").

**Card.** `surface` background, 1px `border`, radius 14, padding 16. A whole card can be tappable (team cards open Team detail).

**List row** (inside cards). Avatar (38–44) + name (`body`) + meta (`meta`, `textMuted`) + optional trailing item (pill, icon buttons, "Captain" label). Rows are separated by a 1px `border` line.

**Pill.** Strong: `accent` background, `onAccent` text ("Captain"). Soft: `accentSoft` background, `accent` text ("Player", "11 / 15 members", "2 new").

**Badge.** `badge` background, `onBadge` text, Inter 11/700, minimum 18×18, sits on the top-right of the Notifications tab icon. It shows pending actions plus unread updates.

**Avatar.** A circle with `avatarBg` and initials in `avatarText`. There are no profile photos in v1.0.

**Bottom tab bar.** `tabBar` background with a 1px `border` top line. Each tab is an icon (24) plus a label (`tabLabel`). Active: `accent`. Inactive: `tabIdle`. The tabs per role are in PRODUCT.md.

**Screen header.** Optional small greeting or back link (`textMuted`), then the title (`display`). The primary action can sit to the right of the title.

**Back link.** A chevron icon plus the previous screen's name, in `textMuted`, at least 44 tall.

**Empty states.** Every list has one: a short line saying what's missing, plus the main action (e.g. "You're not in a team yet." + "Create team").

**Confirmation dialogs.** Used for destructive or important actions (leave team, transfer captaincy, delete account). The title says exactly what will happen. The confirm button uses `danger` for destructive actions.

## 7. Icons

- **Icon set: [Lucide](https://lucide.dev)** (`lucide-react-native`), which draws its icons with `react-native-svg`. Lucide is a widely used, actively maintained open-source line icon set with 1,000+ icons in one consistent style.
- Line (stroke) icons, 24×24, **stroke width 1.8**, rounded ends. No filled icons, no emoji.
- Icons take the color of the text next to them.
- Icon-only buttons always have an accessibility label.
- Screens never import Lucide directly. They use the shared `Icon` component with our own names (see section 2).
- The old `react-native-vector-icons` (Ionicons) is **replaced**. Remove it once no screen uses it, including its font files and config entries.

## 8. Accessibility checklist (every screen)

- Contrast follows section 3.
- Touch targets are 44×44 or bigger.
- Every icon-only button has a label for screen readers.
- Text can grow with the phone's font-size setting without breaking the layout (cards wrap rather than clip).
- Meaning never depends on color alone.

## 9. Implementation notes (for Claude Code)

- **Theme module first:** create the theme folder and the shared components (section 2) before restyling screens. Then restyle screens one by one.
- **Fonts:** Barlow Condensed and Inter are added as font files, with their folder added to `react-native.config.js` (which currently links only the old icon fonts).
- **Icons:** install `lucide-react-native` and `react-native-svg`. This is approved in DECISIONS.md, but still check that the versions work with the app's React Native version before installing, and tell me which versions you chose. Then remove `react-native-vector-icons` once nothing uses it.
- **Status bar:** always light content (white icons), whatever the phone's light/dark setting. Today `App.js` follows the phone's setting. That's a bug for a dark-only design.
- **Dark only in v1.0.** Don't build theme switching yet. Just keep every value in tokens and use `useTheme()`.
- **The existing UI code isn't a constraint.** It was written as a university project. Replace screens, styles and components properly wherever they conflict with this design. Don't patch around them.
- **Restyling and behaviour changes are separate tasks.** A restyle commit changes how a screen looks, not what it does. Text or behaviour fixes (e.g. "Owner" → "Captain") get their own task.
