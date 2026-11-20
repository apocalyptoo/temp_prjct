// A card (docs/DESIGN.md section 6): surface background, 1px border, radius 14,
// padding 16. With onPress the whole card is tappable (team cards open Team detail).
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// accessibilityLabel: what tapping the card opens, when the card is tappable.
// style: layout only (margins, gaps), never colours.
export default function Card({ children, onPress, accessibilityLabel, style }) {
  const { colors, sizes, spacing, radius, opacity } = useTheme();
  const look = {
    backgroundColor: colors.surface,
    borderWidth: sizes.border,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.cardPadding,
  };

  if (!onPress) return <View style={[look, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        look,
        pressed && { opacity: opacity.pressed },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
