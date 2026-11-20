// "● 2 join requests waiting for you" (docs/DESIGN.md section 6): a small red dot, a
// strong part and a muted part. The words carry the meaning; the dot only draws the eye.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

// strong: "2 join requests". text: "waiting for you" (optional).
export default function NoticeLine({ strong, text, style }) {
  const { colors, sizes, spacing, radius, typography } = useTheme();
  // Line the dot up with the middle of the first line, however the text wraps.
  const dotOffset = (typography.body.lineHeight - sizes.dot) / 2;

  return (
    <View style={[styles.row, { gap: spacing.sm }, style]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: sizes.dot,
          height: sizes.dot,
          borderRadius: radius.round,
          backgroundColor: colors.badge,
          marginTop: dotOffset,
        }}
      />
      <Text variant="body" color="textMuted" style={styles.text}>
        <Text variant="bodyStrong">{strong}</Text>
        {text ? `  ${text}` : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flexShrink: 1 },
});
