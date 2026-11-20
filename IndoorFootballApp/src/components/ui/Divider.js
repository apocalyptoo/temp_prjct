// A 1px line across a card, between its parts and between list rows
// (docs/DESIGN.md section 6). Decorative, so screen readers skip it.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function Divider({ style }) {
  const { colors, sizes } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.line,
        { height: sizes.border, backgroundColor: colors.border },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: { alignSelf: 'stretch' },
});
