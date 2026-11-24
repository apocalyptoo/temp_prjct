// Switches between the sections of one screen (docs/DESIGN.md section 6), like Explore's
// Teams · Players · Venues: a row of equal-width segments in a surface box. The chosen
// one is accentSoft with accent text.
//   <SectionTabs label="Explore sections" value={section} onChange={setSection}
//                tabs={[{ value: 'teams', label: 'Teams' }, …]} />
// Not for choosing a value in a form: that's OptionGroup.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Text from './Text';

// tabs: the sections, as { value, label }. value: the chosen section's value.
// onChange(value): called with the tapped section. label: read as the row's name.
// style: layout only.
export default function SectionTabs({ tabs, value, onChange, label, style }) {
  const { colors, sizes, spacing, radius, opacity, touchTarget } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: sizes.border,
          borderRadius: radius.button,
        },
        style,
      ]}
    >
      {tabs.map(tab => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange?.(tab.value)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              {
                minHeight: touchTarget,
                paddingHorizontal: spacing.xs,
                borderRadius: radius.button,
              },
              selected && { backgroundColor: colors.accentSoft },
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Text
              variant="buttonSecondary"
              color={selected ? 'accent' : 'textMuted'}
              style={styles.label}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
