// Interim Explore tab (players and venue owners): three rows opening the existing
// lists. The real Explore, with Teams · Players · Venues sections and search, is a
// Step 3 feature (docs/PRODUCT.md, "App structure and navigation").
// The routes it opens (Teams, Players, Venues) live in the same Explore stack, in both
// the player and the owner navigator.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Icon, ListRow, Screen, ScreenHeader } from '../../components/ui';

const SECTIONS = [
  { name: 'Teams', meta: 'All teams', route: 'Teams' },
  { name: 'Players', meta: 'All players', route: 'Players' },
  { name: 'Venues', meta: 'All venues', route: 'Venues' },
];

export default function ExploreScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  return (
    <Screen scroll>
      <View style={{ gap: spacing.listGap, paddingVertical: spacing.xl }}>
        <ScreenHeader title="Explore" />
        <Card>
          {SECTIONS.map((section, index) => (
            <ListRow
              key={section.route}
              name={section.name}
              meta={section.meta}
              onPress={() => navigation.navigate(section.route)}
              trailing={<Icon name="forward" color={colors.textMuted} />}
              last={index === SECTIONS.length - 1}
            />
          ))}
        </Card>
      </View>
    </Screen>
  );
}
