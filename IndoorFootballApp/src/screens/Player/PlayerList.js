// Explore's Players section (docs/features/explore.md, section e): the players the viewer
// may find, from GET /players, with a search by name and filters by area and position
// (P22: "All" first, one choice, sent at once). They all combine. One card per player;
// tapping it opens Player detail.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Card, Icon, OptionGroup, Text } from '../../components/ui';
import { POSITIONS } from '../../constants/positions';
import { usePagedList } from '../../hooks/usePagedList';
import PagedList, {
  ListFilters,
  NO_FILTERS,
  toParams,
} from '../Shared/PagedList';
import { personMeta } from '../Team/teamCommon';

export const NO_PLAYERS = 'No players yet.';
export const NO_MATCH = 'No players match your search.';

const ALL = ''; // no position filter ("Any" is a position of its own)
const POSITION_OPTIONS = [{ value: ALL, label: 'All' }, ...POSITIONS];
const NO_PLAYER_FILTERS = { ...NO_FILTERS, position: ALL };

const keyOf = player => player.id;

// navigation: the Explore screen's own (Player detail is in the same stack).
export default function PlayerList({ navigation }) {
  const list = usePagedList({
    path: '/players',
    initialFilters: NO_PLAYER_FILTERS,
    toParams,
    keyOf,
  });

  return (
    <PagedList
      list={list}
      keyOf={keyOf}
      renderItem={({ item }) => (
        <PlayerCard
          player={item}
          onPress={() =>
            navigation.navigate('PlayerDetail', {
              userId: item.id,
              playerName: item.name,
            })
          }
        />
      )}
      filters={
        <ListFilters list={list} searchLabel="Search players">
          <OptionGroup
            label="Position"
            options={POSITION_OPTIONS}
            value={list.filters.position}
            onChange={position => list.searchNow({ position })}
          />
        </ListFilters>
      }
      errorMessage="Couldn't load players."
      emptyMessage={NO_PLAYERS}
      noMatchMessage={NO_MATCH}
    />
  );
}

// One player: avatar, name, "Goalkeeper · Mirpur 10", a chevron.
function PlayerCard({ player, onPress }) {
  const { colors, spacing } = useTheme();
  const meta = personMeta({ user: player });
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[player.name, meta].filter(Boolean).join(', ')}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar name={player.name} />
        <View style={styles.fill}>
          <Text variant="bodyStrong">{player.name}</Text>
          {meta ? (
            <Text variant="meta" color="textMuted">
              {meta}
            </Text>
          ) : null}
        </View>
        <Icon name="forward" color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
});
