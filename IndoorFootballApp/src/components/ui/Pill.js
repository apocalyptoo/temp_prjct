// A pill (docs/DESIGN.md section 6).
// strong: lime background, dark text ("Captain").
// soft: faint lime background, lime text ("Player", "11 / 15 members", "2 new").
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

const VARIANTS = {
  strong: { bg: 'accent', text: 'onAccent' },
  soft: { bg: 'accentSoft', text: 'accent' },
};

export default function Pill({ label, variant = 'soft', style }) {
  const { colors, spacing, radius } = useTheme();
  const look = VARIANTS[variant] ?? VARIANTS.soft;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors[look.bg],
          borderRadius: radius.round,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
        },
        style,
      ]}
    >
      <Text variant="pill" color={look.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
