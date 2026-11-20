// An avatar (docs/DESIGN.md section 6): a circle with initials. No photos in v1.0.
//   <Avatar name="Nayeem Islam" />          → "NI", 38 (list rows)
//   <Avatar name="Dhanmondi Strikers" size="large" />  → "DS", 44 (team cards)
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

// ── Initials ──
// The first whole character of the first two words that start with a letter, in any
// script. Words that start with an emoji, a flag, a number or a symbol are skipped, so
// emoji never become initials. "?" when no word starts with a letter.
//   "Nayeem Islam" → "NI"   "🇧🇩 Tanvir Ahmed" → "TA"   "👍🏽 Fahim" → "F"   "👨‍👩‍👧" → "?"
// "Whole character" keeps the marks that belong to a letter: a Bangla vowel sign (রা),
// an accent, or a joined letter (ক্ষ).
//
// These patterns are built with new RegExp(...) on purpose. Written as /\p{L}/u, the
// app's Babel setup (which rewrites u-flag patterns) fails with "Expected atom" and the
// build breaks. Hermes itself supports Unicode categories (its compiler accepts \p{L}
// and \p{M} and rejects unknown ones), and so does Node for the tests.
const STARTS_WITH_LETTER = new RegExp('^\\p{L}', 'u'); // any script's letters
const IS_MARK = new RegExp('^\\p{M}$', 'u'); // vowel signs, accents and other marks

const ZWJ = 0x200d; // zero-width joiner (can join two letters into one)

// A virama joins the next letter onto this one (ক + ্ + ষ = ক্ষ). In the Indic scripts
// (U+0900 to U+0DFF) it sits at the same offset in every 128-character block.
const isVirama = cp => cp >= 0x0900 && cp <= 0x0dff && cp % 0x80 === 0x4d;

// The first whole character of a word, where the phone has no Intl.Segmenter.
function firstCharacterFallback(word) {
  const points = Array.from(word); // splits by code point, never half of one
  if (points.length === 0) return '';
  let result = points[0];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1].codePointAt(0);
    const joined = previous === ZWJ || isVirama(previous);
    const cp = points[i].codePointAt(0);
    if (cp === ZWJ || IS_MARK.test(points[i]) || joined) {
      result += points[i];
    } else {
      break;
    }
  }
  return result;
}

// Intl.Segmenter finds whole characters exactly, where the JavaScript engine has it.
const defaultSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

// Which way this engine finds whole characters (shown in the developer UI gallery).
export const INITIALS_METHOD = defaultSegmenter ? 'Intl.Segmenter' : 'fallback';

function firstCharacter(word, segmenter) {
  if (segmenter) {
    const first = segmenter.segment(word)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return firstCharacterFallback(word);
}

// Up to two initials, uppercase. `segmenter` is only passed by the tests (null tries
// the fallback).
export function getInitials(name, segmenter = defaultSegmenter) {
  if (typeof name !== 'string') return '?';
  const letterWords = name
    .trim()
    .split(/\s+/)
    .filter(word => STARTS_WITH_LETTER.test(word));
  if (letterWords.length === 0) return '?';
  return letterWords
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
