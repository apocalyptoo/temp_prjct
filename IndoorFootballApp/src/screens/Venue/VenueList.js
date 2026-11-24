// Explore's Venues section (docs/features/venues.md, section e, "The venue list";
// docs/features/explore.md, section e): the live venues from GET /owners, A to Z (the
// backend sorts them), with a search by name and an area filter, in pages. One card per
// venue: the name, the area and the opening hours on one line; tapping it opens Venue
// detail.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Icon, Text } from '../../components/ui';
import { usePagedList } from '../../hooks/usePagedList';
import PagedList, {
  ListFilters,
  NO_FILTERS,
  toParams,
} from '../Shared/PagedList';
import { hoursOnOneLine } from './venueCommon';

export const NO_VENUES = 'No venues yet.';
export const NO_MATCH = 'No venues match your search.';

const keyOf = venue => venue.userId;

// navigation: the Explore screen's own (Venue detail is in the same stack).
export default function VenueList({ navigation }) {
  const list = usePagedList({
    path: '/owners',
    initialFilters: NO_FILTERS,
    toParams,
    keyOf,
  });

  return (
    <PagedList
      list={list}
      keyOf={keyOf}
      renderItem={({ item }) => (
        <VenueCard
          venue={item}
          onPress={() =>
            navigation.navigate('VenueDetail', {
              userId: item.userId,
              venueName: item.indoorName,
            })
          }
        />
      )}
      filters={<ListFilters list={list} searchLabel="Search venues" />}
      errorMessage="Couldn't load venues."
      emptyMessage={NO_VENUES}
      noMatchMessage={NO_MATCH}
    />
  );
}

// One venue: the name, the area (when set) and the opening hours on one line (when set).
function VenueCard({ venue, onPress }) {
  const { colors, spacing, icon } = useTheme();
  const hours = hoursOnOneLine(venue.openingHours);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[venue.indoorName, venue.area]
        .filter(Boolean)
        .join(', ')}
      style={{ gap: spacing.xs }}
    >
      <Text variant="cardTitle">{venue.indoorName}</Text>
      {venue.area ? (
        <View style={[styles.row, { gap: spacing.xs }]}>
          <Icon name="area" size={icon.sizeSmall} color={colors.textMuted} />
          <Text variant="meta" color="textMuted" style={styles.shrink}>
            {venue.area}
          </Text>
        </View>
      ) : null}
      {hours ? (
        <Text variant="meta" color="textMuted">
          {hours}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1 },
});
