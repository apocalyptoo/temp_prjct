// Tappable text (docs/DESIGN.md section 6), for links inside cards ("See all 11").
// Lime, semibold, at least 44 tall and wide to tap.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

// accessibilityLabel: only when the visible text alone isn't clear ("See all 11
// members" for "See all 11").
export default function TextLink({
  title,
  onPress,
  accessibilityLabel,
  style,
}) {
  const { opacity, touchTarget } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.base,
        { minHeight: touchTarget, minWidth: touchTarget },
        pressed && { opacity: opacity.pressed },
        style,
      ]}
    >
      <Text variant="buttonSecondary" color="accent">
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'flex-end' },
});
