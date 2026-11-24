// What Explore's three sections share (docs/features/explore.md, section e): the search
// and Area fields, and the list itself with every state it can be in. The data comes from
// the usePagedList hook.
//   const list = usePagedList({ path: '/teams', initialFilters: NO_FILTERS,
//                               toParams, keyOf });
//   <PagedList list={list} keyOf={keyOf} renderItem={…} filters={<ListFilters … />}
//              errorMessage="Couldn't load teams." emptyMessage="No teams yet."
//              noMatchMessage="No teams match your search." />
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  EmptyState,
  SuggestionField,
  Text,
  TextField,
  TextLink,
} from '../../components/ui';
import { useTryAgain } from '../../hooks/useTryAgain';
import { suggestAreas } from '../../constants/areas';
import { tidyArea } from '../Player/profileChecks';
import { TeamLoadState } from '../Team/teamCommon';

// The backend's limits (src/validation/listQuery.js): the fields stop there, so a search
// can never be refused. A TextInput counts UTF-16 units, never fewer than characters.
export const SEARCH_MAX = 60;
export const AREA_FILTER_MAX = 40;
export const MORE_FAILED = "Couldn't load more.";

export const NO_FILTERS = { search: '', area: '' };

// What's sent: the search trimmed, the area tidied like a stored area (as the backend
// does), the position as it is; a blank one isn't sent at all.
export function toParams({ search, area, position }) {
  const params = {};
  if (search.trim()) params.search = search.trim();
  if (tidyArea(area)) params.area = tidyArea(area);
  if (position) params.position = position;
  return params;
}

// The search and Area fields, then any other filter (children). They sit at the top of
// the list and scroll away with it. A field's X empties it and searches at once.
export function ListFilters({ list, searchLabel, children }) {
  const { spacing } = useTheme();
  const { filters, change, searchNow } = list;
  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        label={searchLabel}
        icon="search"
        value={filters.search}
        onChangeText={search => change({ search })}
        onClear={() => searchNow({ search: '' })}
        maxLength={SEARCH_MAX}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => searchNow()}
      />
      <SuggestionField
        label="Area"
        value={filters.area}
        onChangeText={area => change({ area })}
        onClear={() => searchNow({ area: '' })}
        getSuggestions={suggestAreas}
        onSuggestionPress={area => searchNow({ area })}
        maxLength={AREA_FILTER_MAX}
        autoCapitalize="words"
        returnKeyType="search"
        onSubmitEditing={() => searchNow()}
      />
      {children ?? null}
    </View>
  );
}

// emptyAction: { title, icon, onPress }, the button under emptyMessage (optional).
export default function PagedList({
  list,
  keyOf,
  renderItem,
  filters,
  errorMessage,
  emptyMessage,
  noMatchMessage,
  emptyAction,
}) {
  const { colors, spacing } = useTheme();
  const ready = list.status === 'ready';

  let empty;
  if (!ready) {
    empty = (
      <TeamLoadState
        status={list.status}
        onRetry={list.retry}
        errorMessage={errorMessage}
      />
    );
  } else if (list.filtered) {
    empty = (
      <View>
        <EmptyState message={noMatchMessage} />
        <TextLink
          title="Clear search"
          onPress={list.clear}
          style={styles.centred}
        />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        message={emptyMessage}
        actionTitle={emptyAction?.title}
        actionIcon={emptyAction?.icon}
        onAction={emptyAction?.onPress}
      />
    );
  }

  return (
    <FlatList
      data={ready ? list.rows : []}
      keyExtractor={row => String(keyOf(row))}
      renderItem={renderItem}
      ListHeaderComponent={filters}
      ListHeaderComponentStyle={{ marginBottom: spacing.listGap }}
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={empty}
      ListFooterComponent={ready ? <More list={list} /> : null}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          colors={[colors.accent]}
          tintColor={colors.accent}
          progressBackgroundColor={colors.surface}
        />
      }
    />
  );
}

// Under the rows: a spinner while the next page loads, or that it failed. Try again
// always shows the spinner for a moment (useTryAgain).
function More({ list }) {
  const { colors, spacing } = useTheme();
  const { trying, tryAgain } = useTryAgain(list.retryMore);
  if (list.loadingMore || (list.moreFailed && trying)) {
    return (
      <ActivityIndicator
        color={colors.accent}
        accessibilityLabel="Loading more"
        style={{ paddingTop: spacing.listGap }}
      />
    );
  }
  if (!list.moreFailed) return null;
  return (
    <View style={[styles.more, { paddingTop: spacing.listGap }]}>
      <Text color="textMuted">{MORE_FAILED}</Text>
      <TextLink title="Try again" onPress={tryAgain} style={styles.centred} />
    </View>
  );
}

function Gap() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.listGap }} />;
}

const styles = StyleSheet.create({
  centred: { alignSelf: 'center', alignItems: 'center' },
  more: { alignItems: 'center' },
});
