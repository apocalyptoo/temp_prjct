// An avatar (docs/DESIGN.md section 6): a circle with initials. No photos in v1.0.
//   <Avatar name="Nayeem Islam" />          → "NI", 38 (list rows)
//   <Avatar name="Dhanmondi Strikers" size="large" />  → "DS", 44 (team cards)
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

// ── Initials ──
// "First letter" means a whole character as people see it, not half of one: a Bangla
// letter with its vowel sign (রা), a joined letter (ক্ষ), an emoji with a skin tone or
// joiner (👍🏽, 👨‍👩‍👧), a flag (🇧🇩). Intl.Segmenter does this properly where the phone's
// JavaScript engine has it; otherwise a simpler rule below covers these cases.

const ZWJ = 0x200d; // zero-width joiner (joins emoji, and some letters)

const isRegionalIndicator = cp => cp >= 0x1f1e6 && cp <= 0x1f1ff; // flag halves

// Indic scripts (Devanagari, Bengali and the others from U+0900 to U+0DFF) share one
// layout: in each 128-character block, the vowel signs, nukta, virama and other marks
// sit at the same offsets.
const isIndicMark = cp => {
  if (cp < 0x0900 || cp > 0x0dff) return false;
  const offset = cp % 0x80;
  return (
    offset <= 0x03 ||
    (offset >= 0x3a && offset <= 0x4f && offset !== 0x3d) ||
    (offset >= 0x51 && offset <= 0x57) ||
    offset === 0x62 ||
    offset === 0x63
  );
};
const isVirama = cp => cp >= 0x0900 && cp <= 0x0dff && cp % 0x80 === 0x4d;

// Marks that belong to the character before them.
const isMark = cp =>
  (cp >= 0x0300 && cp <= 0x036f) || // accents
  (cp >= 0x1ab0 && cp <= 0x1aff) ||
  (cp >= 0x1dc0 && cp <= 0x1dff) ||
  (cp >= 0x20d0 && cp <= 0x20ff) ||
  (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors (emoji style)
  (cp >= 0xfe20 && cp <= 0xfe2f) ||
  (cp >= 0x1f3fb && cp <= 0x1f3ff) || // emoji skin tones
  (cp >= 0xe0020 && cp <= 0xe007f) || // tag characters (some flags)
  isIndicMark(cp);

// The first whole character of a word, without Intl.Segmenter.
function firstCharacterFallback(word) {
  const points = Array.from(word); // splits by code point, so emoji stay whole
  if (points.length === 0) return '';
  const codeAt = i => points[i].codePointAt(0);

  if (
    points.length > 1 &&
    isRegionalIndicator(codeAt(0)) &&
    isRegionalIndicator(codeAt(1))
  ) {
    return points[0] + points[1]; // a flag is two halves
  }

  let result = points[0];
  for (let i = 1; i < points.length; i += 1) {
    const cp = codeAt(i);
    const previous = codeAt(i - 1);
    // A mark or joiner belongs to what came before; so does the letter after a joiner
    // or a virama (which joins two letters into one, as in ক্ষ).
    if (cp === ZWJ || isMark(cp) || previous === ZWJ || isVirama(previous)) {
      result += points[i];
    } else {
      break;
    }
  }
  return result;
}

const defaultSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function firstCharacter(word, segmenter) {
  if (segmenter) {
    const first = segmenter.segment(word)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return firstCharacterFallback(word);
}

// Up to two initials: the first character of the first two words, uppercase. "?" for
// an empty name. `segmenter` is only passed by the tests (null tries the fallback).
export function getInitials(name, segmenter = defaultSegmenter) {
  if (typeof name !== 'string') return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map(word => firstCharacter(word, segmenter))
    .join('')
    .toUpperCase();
}

// ── The circle ──
// size: small (38, list rows) or large (44, team cards). A circle needs a fixed size,
// so the initials grow a little with the phone's font size but not past the circle.
// The name is always shown next to an avatar, so the avatar itself is hidden from
// screen readers unless it's given an accessibilityLabel.
const INITIALS_MAX_FONT_SCALE = 1.3;

export default function Avatar({
  name,
  size = 'small',
  accessibilityLabel,
  style,
}) {
  const { colors, sizes, radius } = useTheme();
  const diameter = size === 'large' ? sizes.avatarLarge : sizes.avatarSmall;
  const labelled = Boolean(accessibilityLabel);

  return (
    <View
      accessible={labelled}
      accessibilityLabel={labelled ? accessibilityLabel : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!labelled}
      style={[
        styles.base,
        {
          width: diameter,
          height: diameter,
          borderRadius: radius.round,
          backgroundColor: colors.avatarBg,
        },
        style,
      ]}
    >
      <Text
        variant="button"
        color="avatarText"
        numberOfLines={1}
        maxFontSizeMultiplier={INITIALS_MAX_FONT_SCALE}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
