// The one theme object (docs/DESIGN.md section 2). Screens get it through useTheme()
// from ThemeProvider.js, never by importing theme files directly. Dark only in v1.0.
// (ThemeProvider imports this file, not the other way round, so there's no import loop.)
import { colors } from './colors';
import { fonts, typography } from './typography';
import { spacing, touchTarget } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { icon } from './icons';

export const theme = {
  dark: true,
  colors,
  fonts,
  typography,
  spacing,
  radius,
  shadows,
  touchTarget,
  icon,
};
