// "‹ My Teams" (docs/DESIGN.md section 6): a chevron plus the previous screen's name,
// muted, at least 44 tall. It doesn't know about navigation: the screen passes onPress
// (usually navigation.goBack).
// label: the previous screen's name, read as "Back to My Teams". Leave it out when there
// is no short name for it: the link then shows and reads just "Back". (A label that is
// blank or the word "Back" counts as no name, so it never reads "Back to Back".)
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Icon from './Icon';
import Text from './Text';

export default function BackLink({ label, onPress, style }) {
  const { colors, spacing, opacity, touchTarget } = useTheme();
  const name = label?.trim();
  const hasName = Boolean(name) && name !== 'Back';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasName ? `Back to ${name}` : 'Back'}
      style={({ pressed }) => [
        styles.base,
        { minHeight: touchTarget, minWidth: touchTarget, gap: spacing.xxs },
        pressed && { opacity: opacity.pressed },
        style,
      ]}
    >
      <Icon name="back" color={colors.textMuted} />
      <Text variant="bodySmall" color="textMuted" style={styles.label}>
        {hasName ? name : 'Back'}
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
