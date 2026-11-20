// A count badge (docs/DESIGN.md section 6): red with dark text, at least 18 x 18.
// It doesn't place itself: the parent positions it (for example on the top-right of
// the Notifications tab icon). Shows nothing at 0, and "99+" above 99.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

export const MAX_BADGE_COUNT = 99;

// The text a count shows, or null when the badge should be hidden.
export function badgeLabel(count) {
  if (!Number.isFinite(count) || count < 1) return null;
  const whole = Math.floor(count);
  return whole > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(whole);
}

// accessibilityLabel: what the number means ("3 notifications"), when it isn't
// already said by the element the badge sits on.
export default function Badge({ count, accessibilityLabel, style }) {
  const { colors, sizes, spacing, radius } = useTheme();
  const label = badgeLabel(count);
  if (label === null) return null;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        {
          minWidth: sizes.badge,
          minHeight: sizes.badge,
          borderRadius: radius.round,
          backgroundColor: colors.badge,
          paddingHorizontal: spacing.xxs,
        },
        style,
      ]}
    >
      <Text variant="badge" color="onBadge">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
