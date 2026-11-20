// The top of a screen (docs/DESIGN.md section 6): an optional small greeting or back
// link, the title (display), and an optional action on the right of the title.
//   <ScreenHeader greeting="Salam, Rahim" title="My teams"
//                 action={<Button title="Create team" icon="add" onPress={…} />} />
//   <ScreenHeader back={{ label: 'My Teams', onPress: navigation.goBack }} title="…" />
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import BackLink from './BackLink';
import Text from './Text';

export default function ScreenHeader({ title, greeting, back, action, style }) {
  const { spacing } = useTheme();
  return (
    <View style={[{ gap: spacing.xxs }, style]}>
      {back ? <BackLink label={back.label} onPress={back.onPress} /> : null}
      {!back && greeting ? (
        <Text variant="bodySmall" color="textMuted">
          {greeting}
        </Text>
      ) : null}
      <View style={[styles.titleRow, { gap: spacing.md }]}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {action ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  title: { flexShrink: 1 },
});
