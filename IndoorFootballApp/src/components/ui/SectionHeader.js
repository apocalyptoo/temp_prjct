// A heading row inside a card (docs/DESIGN.md section 6): the title on the left and an
// optional item on the right, such as <Pill label="2 new" /> or
// <TextLink title="See all 11" onPress={…} />.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

export default function SectionHeader({ title, right, style }) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.md }, style]}>
      <Text variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  title: { flexShrink: 1 },
});
