/* eslint-env jest */
// Tests for the theme module (src/theme, docs/DESIGN.md sections 2–5).

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { palette } from '../src/theme/palette';
import { colors } from '../src/theme/colors';
import { fonts, typography } from '../src/theme/typography';
import { spacing, touchTarget } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';
import { shadows } from '../src/theme/shadows';
import { sizes, opacity } from '../src/theme/sizes';
import { icon } from '../src/theme/icons';
import { theme } from '../src/theme';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

// ── Contrast (WCAG 2.x), written here so no package is needed ──
// Relative luminance of a #RRGGBB colour.
function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast ratio between two opaque colours, from 1 (same) to 21 (black on white).
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('contrast helper', () => {
  test('gives the known ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrast('#123456', '#123456')).toBe(1);
  });
});

describe('colors.js', () => {
  const paletteValues = new Set(Object.values(palette));

  test('every meaning points to a colour that exists in the palette', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect({ name, value }).toEqual({ name, value: expect.any(String) });
      expect({ name, inPalette: paletteValues.has(value) }).toEqual({
        name,
        inPalette: true,
      });
    }
  });

  test('has the DESIGN.md section 3 values', () => {
    expect(colors).toMatchObject({
      bg: '#0E1116',
      surface: '#171B22',
      border: '#262C36',
      text: '#F3F5F7',
      textMuted: '#9AA3AF',
      accent: '#C6F432',
      onAccent: '#0E1116',
      accentSoft: '#C6F43222',
      tabBar: '#12161C',
      tabIdle: '#7D8794',
      danger: '#FF7A7A',
      badge: '#FF5C5C',
      onBadge: '#0E1116',
      avatarBg: '#262C36',
      avatarText: '#C6F432',
      shadow: '#000000',
      scrim: '#0E1116B3',
    });
  });

  test('palette values are #RRGGBB, or #RRGGBBAA for see-through colours', () => {
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
    }
  });
});

describe('readability rules (DESIGN.md section 3), at least 4.5:1', () => {
  const pairs = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['textMuted', 'bg'],
    ['textMuted', 'surface'],
    ['onAccent', 'accent'],
    ['onBadge', 'badge'],
  ];

  test.each(pairs)('%s on %s', (fg, bg) => {
    const ratio = contrast(colors[fg], colors[bg]);
    expect({ pair: `${fg} on ${bg}`, passes: ratio >= 4.5, ratio }).toEqual({
      pair: `${fg} on ${bg}`,
      passes: true,
      ratio,
    });
  });
});

describe('typography.js', () => {
  const families = new Set(Object.values(fonts));

  test('every text style uses one of our font files, and never fontWeight', () => {
    for (const [name, style] of Object.entries(typography)) {
      expect({ name, known: families.has(style.fontFamily) }).toEqual({
        name,
        known: true,
      });
      expect({ name, fontWeight: style.fontWeight }).toEqual({
        name,
        fontWeight: undefined,
      });
    }
  });

  test('headings are Barlow Condensed, uppercase, with +2% letter spacing', () => {
    for (const name of ['display', 'title', 'cardTitle', 'section']) {
      const style = typography[name];
      expect(style.fontFamily).toBe('BarlowCondensed-Bold');
      expect(style.textTransform).toBe('uppercase');
      expect(style.letterSpacing).toBeCloseTo(style.fontSize * 0.02, 2);
    }
  });

  test('has the DESIGN.md section 4 sizes and weights', () => {
    const expected = {
      display: [34, 'BarlowCondensed-Bold'],
      title: [36, 'BarlowCondensed-Bold'],
      cardTitle: [19, 'BarlowCondensed-Bold'],
      section: [18, 'BarlowCondensed-Bold'],
      body: [15, 'Inter-Regular'],
      bodyStrong: [15, 'Inter-SemiBold'],
      bodySmall: [14, 'Inter-Regular'],
      meta: [13, 'Inter-Regular'],
      pill: [12, 'Inter-Bold'],
      tabLabel: [11, 'Inter-Medium'],
      tabLabelActive: [11, 'Inter-SemiBold'],
      button: [14, 'Inter-Bold'],
      buttonSecondary: [14, 'Inter-SemiBold'],
      badge: [11, 'Inter-Bold'],
    };
    for (const [name, [size, family]] of Object.entries(expected)) {
      expect([
        name,
        typography[name].fontSize,
        typography[name].fontFamily,
      ]).toEqual([name, size, family]);
    }
  });
});

describe('spacing, radius, shadows and touch target', () => {
  test('match DESIGN.md section 5', () => {
    expect(spacing).toEqual({
      xxs: 4,
      xs: 8,
      sm: 10,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 28,
      screenPadding: 20,
      cardPadding: 16,
      listGap: 20,
      detailGap: 18,
      cardGap: 12,
    });
    expect(radius).toEqual({ card: 14, button: 10, round: 999 });
    expect(touchTarget).toBe(44);
    expect(sizes).toEqual({
      field: 48,
      button: 46,
      avatarSmall: 38,
      avatarLarge: 44,
      badge: 18,
      dot: 8,
      border: 1,
      dialogMaxWidth: 400,
    });
    expect(opacity).toEqual({ disabled: 0.45, pressed: 0.8 });
    expect(icon).toEqual({ size: 24, sizeSmall: 16, strokeWidth: 1.8 });
    expect(theme).toMatchObject({ sizes, opacity, icon });
  });

  test('the floating shadow has both the Android and the iOS properties', () => {
    expect(shadows.floating).toEqual({
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: expect.any(Number),
      shadowRadius: expect.any(Number),
      elevation: expect.any(Number),
    });
  });
});

describe('useTheme()', () => {
  test('returns the theme inside ThemeProvider', async () => {
    let seen;
    function Probe() {
      seen = useTheme();
      return null;
    }
    await ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });
    expect(seen).toBe(theme);
    expect(seen.dark).toBe(true);
    expect(seen.colors.bg).toBe('#0E1116');
  });

  test('throws a clear error outside ThemeProvider', () => {
    function Probe() {
      useTheme();
      return null;
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      ReactTestRenderer.act(() => {
        ReactTestRenderer.create(<Probe />);
      }),
    ).toThrow('useTheme() must be used inside ThemeProvider');
    spy.mockRestore();
  });
});

describe('Android window colour', () => {
  test('app_background in colors.xml is the same as colors.bg', () => {
    const fs = require('fs');
    const path = require('path');
    const xml = fs.readFileSync(
      path.join(__dirname, '../android/app/src/main/res/values/colors.xml'),
      'utf8',
    );
    const match = xml.match(/<color name="app_background">(#[0-9A-Fa-f]{6})</);
    expect(match).not.toBeNull();
    expect(match[1].toUpperCase()).toBe(colors.bg);
  });
});
