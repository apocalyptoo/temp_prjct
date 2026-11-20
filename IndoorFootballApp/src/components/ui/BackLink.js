// "‹ My Teams" (docs/DESIGN.md section 6): a chevron plus the previous screen's name,
// muted, at least 44 tall. It doesn't know about navigation: the screen passes onPress
// (usually navigation.goBack).
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import Text from './Text';

export default function BackLink({ label, onPress, style }) {
  const { colors, spacing, opacity, touchTarget } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      style={({ pressed }) => [
        styles.base,
        { minHeight: touchTarget, minWidth: touchTarget, gap: spacing.xxs },
        pressed && { opacity: opacity.pressed },
        style,
      ]}
    >
      <Icon name="back" color={colors.textMuted} />
      <Text variant="bodySmall" color="textMuted" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  label: { flexShrink: 1 },
});
