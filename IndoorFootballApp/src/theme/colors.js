// Colour meanings (docs/DESIGN.md section 3). Screens and components use only these
// names (colors.accent, never palette.lime). A future light theme would be a second
// mapping with the same names.
import { palette } from './palette';

export const colors = {
  bg: palette.nearBlack, // screen background
  surface: palette.slate900, // cards, sections, secondary buttons
  border: palette.slate800, // card borders, dividers, outlined buttons
  text: palette.snow, // main text and headings
  textMuted: palette.gray400, // secondary text, meta info, back links
  accent: palette.lime, // main buttons, active tab, "Captain" pill, links
  onAccent: palette.nearBlack, // text and icons on accent
  accentSoft: palette.limeSoft, // soft pill backgrounds
  tabBar: palette.slate950, // bottom tab bar background
  tabIdle: palette.gray500, // inactive tab icons and labels
  danger: palette.coral, // destructive actions and error text
  badge: palette.red, // notification count badge, "waiting for you" dots
  onBadge: palette.nearBlack, // text on badge
  avatarBg: palette.slate800, // avatar circle background
  avatarText: palette.lime, // avatar initials
  shadow: palette.black, // colour of the one floating shadow (shadows.js)
};
