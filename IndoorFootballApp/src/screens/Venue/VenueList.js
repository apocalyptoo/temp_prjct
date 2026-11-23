// The venue list (docs/features/venues.md, section e, "The venue list"; P19, P20): live
// venues from GET /owners, A to Z (the backend sorts them), with a search by name and an
// area filter. Both are sent to the backend, which does the matching, 400 ms after
// typing stops (or at once when an area suggestion is tapped or Search is pressed on
// the keyboard), so there's no request per keystroke. One card per venue: the name, the
// area and the opening hours on one line; tapping it opens Venue detail.
//
// A reusable component, not a screen: the interim VenuesScreen shows it now, and feature
// 3b puts it into the real Explore as its Venues section.
//   <VenueList navigation={navigation} header={<ScreenHeader title="Venues" />} />
// navigation: the screen's own (for the focus reload and opening Venue detail, which
// must be registered in the same stack). header: shown above the search fields.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Card,
  EmptyState,
  Icon,
  SuggestionField,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { suggestAreas } from '../../constants/areas';
import { TeamLoadState } from '../Team/teamCommon';
import { tidyArea } from '../Player/profileChecks';
import { hoursOnOneLine } from './venueCommon';

export const SEARCH_DELAY_MS = 400; // spec P20
// The backend's limits (venueListQuerySchema): the fields stop there, so a search can
// never be refused. A TextInput counts UTF-16 units, never fewer than characters.
export const SEARCH_MAX = 60;
export const AREA_FILTER_MAX = 40;

export const NO_VENUES = 'No venues yet.';
export const NO_MATCH = 'No venues match your search.';

const NO_FILTER = { search: '', area: '' };

// What's sent: the search trimmed, the area tidied like a stored area (as the backend
// does); a blank one isn't sent at all.
const toFilter = (search, area) => ({
  search: search.trim(),
  area: tidyArea(area),
});
const toParams = filter => {
  const params = {};
  if (filter.search) params.search = filter.search;
  if (filter.area) params.area = filter.area;
  return params;
};

export default function VenueList({ navigation, header }) {
  const { colors, spacing } = useTheme();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [venues, setVenues] = useState([]);
  // The filter the shown list was loaded with (decides which empty state shows).
  const [shownFilter, setShownFilter] = useState(NO_FILTER);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef(NO_FILTER); // the latest filter asked for
  const requestRef = useRef(0); // only the latest request's reply is shown
  const timerRef = useRef(null);

  // Loads the list for a filter (by default the latest one). A reply that arrives after
  // a newer request was sent is ignored. A failed reload keeps what's shown; only a
  // failed first load shows the error.
  const load = useCallback(async (filter = filterRef.current) => {
    filterRef.current = filter;
    const request = ++requestRef.current;
    try {
      const res = await api.get('/owners', { params: toParams(filter) });
      if (request !== requestRef.current) return;
      // The list comes in pages now ({ items, page, limit, total }). Until this list is
      // rebuilt with paging (feature 3b, task F3b.4), it shows the first page only.
      setVenues(res.data.items);
      setShownFilter(filter);
      setStatus('ready');
    } catch {
      if (request !== requestRef.current) return;
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(
    () => navigation.addListener('focus', () => load()),
    [navigation, load],
  );
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const searchSoon = (nextSearch, nextArea) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => load(toFilter(nextSearch, nextArea)),
      SEARCH_DELAY_MS,
    );
  };
  const searchNow = (nextSearch, nextArea) => {
    clearTimeout(timerRef.current);
    load(toFilter(nextSearch, nextArea));
  };

  const changeSearch = text => {
    setSearch(text);
    searchSoon(text, area);
  };
  const changeArea = text => {
    setArea(text);
    searchSoon(search, text);
  };
  const clearSearch = () => {
    setSearch('');
    setArea('');
    searchNow('', '');
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setStatus('loading');
    load();
  };

  const openVenue = venue =>
    navigation.navigate('VenueDetail', {
      userId: venue.userId,
      venueName: venue.indoorName,
    });

  const filtered = shownFilter.search !== '' || shownFilter.area !== '';

  const top = (
    <View style={{ gap: spacing.lg }}>
      {header ?? null}
      <TextField
        label="Search venues"
        icon="search"
        value={search}
        onChangeText={changeSearch}
        maxLength={SEARCH_MAX}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => searchNow(search, area)}
      />
      <SuggestionField
        label="Area"
        value={area}
        onChangeText={changeArea}
        getSuggestions={suggestAreas}
        onSuggestionPress={name => searchNow(search, name)}
        maxLength={AREA_FILTER_MAX}
        autoCapitalize="words"
        returnKeyType="search"
        onSubmitEditing={() => searchNow(search, area)}
      />
    </View>
  );

  let empty = null;
  if (status !== 'ready') {
    empty = (
      <TeamLoadState
        status={status}
        onRetry={retry}
        errorMessage="Couldn't load venues."
      />
    );
  } else if (filtered) {
    empty = (
      <View>
        <EmptyState message={NO_MATCH} />
        <TextLink
          title="Clear search"
          onPress={clearSearch}
          style={styles.centred}
        />
      </View>
    );
  } else {
    empty = <EmptyState message={NO_VENUES} />;
  }

  return (
    <FlatList
      data={status === 'ready' ? venues : []}
      keyExtractor={venue => String(venue.userId)}
      renderItem={({ item }) => (
        <VenueCard venue={item} onPress={() => openVenue(item)} />
      )}
      ListHeaderComponent={top}
      ListHeaderComponentStyle={{ marginBottom: spacing.listGap }}
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={empty}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          colors={[colors.accent]}
          tintColor={colors.accent}
          progressBackgroundColor={colors.surface}
        />
      }
    />
  );
}

function Gap() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.listGap }} />;
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
  centred: { alignSelf: 'center' },
});
