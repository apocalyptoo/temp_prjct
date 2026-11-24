// Explore (docs/features/explore.md, section e), the same for players and venue owners:
// the title and the section tabs stay at the top; under them, the chosen section's list
// with its own search and filters. Opens on Teams, or on the section in the route's
// optional param { section: 'teams' | 'players' | 'venues' } (My Teams' "Find a team").
//
// A section loads the first time it's shown. After that it stays in place, hidden, while
// another one is shown, so it keeps its search, rows and scroll position (P19). Hidden
// means invisible, not tappable and not read by screen readers, but still laid out at
// full size: a list laid out at zero size (display: none) could lose its place.
import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen, ScreenHeader, SectionTabs } from '../../components/ui';
import PlayerList from '../Player/PlayerList';
import TeamList from '../Team/TeamList';
import VenueList from '../Venue/VenueList';

const SECTIONS = [
  { value: 'teams', label: 'Teams', List: TeamList },
  { value: 'players', label: 'Players', List: PlayerList },
  { value: 'venues', label: 'Venues', List: VenueList },
];
const isSection = value => SECTIONS.some(section => section.value === value);

export default function ExploreScreen({ navigation, route }) {
  const { spacing } = useTheme();
  const asked = route.params?.section;
  const [section, setSection] = useState(isSection(asked) ? asked : 'teams');
  const [opened, setOpened] = useState([section]); // the sections shown so far

  const show = useCallback(value => {
    Keyboard.dismiss(); // it may belong to a field of the section being left
    setSection(value);
    setOpened(current =>
      current.includes(value) ? current : [...current, value],
    );
  }, []);

  // Explore may already be open when a section is asked for. The param is used once and
  // cleared, so asking for the same section again later works too.
  useEffect(() => {
    if (asked === undefined) return;
    if (isSection(asked)) show(asked);
    navigation.setParams({ section: undefined });
  }, [asked, navigation, show]);

  return (
    <Screen>
      <View style={{ gap: spacing.lg, paddingTop: spacing.lg }}>
        <ScreenHeader title="Explore" />
        <SectionTabs
          label="Explore sections"
          tabs={SECTIONS}
          value={section}
          onChange={show}
        />
      </View>
      <View style={styles.fill}>
        {SECTIONS.filter(({ value }) => opened.includes(value)).map(
          ({ value, List }) => {
            const hidden = value !== section;
            return (
              <View
                key={value}
                testID={`explore-${value}`}
                pointerEvents={hidden ? 'none' : 'auto'}
                accessibilityElementsHidden={hidden}
                importantForAccessibility={
                  hidden ? 'no-hide-descendants' : 'auto'
                }
                style={[StyleSheet.absoluteFill, hidden && styles.hidden]}
              >
                <List navigation={navigation} />
              </View>
            );
          },
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
});
