// A list of players with a search by name and filters by area and position (P22: "All"
// first, one choice, sent at once), which all combine, in pages. Shared by Explore's
// Players section and Invite players (docs/features/explore.md, section e, P29).
//   <PlayerList navigation={navigation} />
//   <PlayerList navigation={navigation} path={`/teams/${teamId}/invite-candidates`}
//               emptyMessage="…" renderActions={(player, list) => <Button … />} />
// Tapping a player opens Player detail. Each row ends with a chevron, or with its own
// buttons (renderActions), which sit beside the part that opens the player.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  Card,
  Icon,
  ListRow,
  OptionGroup,
  Text,
} from '../../components/ui';
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

// navigation: the screen's own (Player detail must be in the same stack).
// path: the endpoint; its rows and filters are those of GET /players.
// renderActions(player, list): the row's buttons; list is usePagedList's.
export default function PlayerList({
  navigation,
  path = '/players',
  emptyMessage = NO_PLAYERS,
  renderActions,
}) {
  const list = usePagedList({
    path,
    initialFilters: NO_PLAYER_FILTERS,
    toParams,
    keyOf,
  });

  // Pushed, so Player detail always opens on top, even when the same player's page is
  // already further down the stack (P30).
  const openPlayer = player =>
    navigation.push('PlayerDetail', {
      userId: player.id,
      playerName: player.name,
    });

  return (
    <PagedList
      list={list}
      keyOf={keyOf}
      renderItem={({ item }) => (
        <PlayerCard
          player={item}
          onPress={() => openPlayer(item)}
          actions={renderActions?.(item, list)}
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
      emptyMessage={emptyMessage}
      noMatchMessage={NO_MATCH}
    />
  );
}

// One player: avatar, name, "Goalkeeper · Mirpur 10", then a chevron (the whole card
// opens the player) or the row's own buttons (the rest of the row opens the player).
function PlayerCard({ player, onPress, actions }) {
  const { colors, spacing } = useTheme();
  const meta = personMeta({ user: player });
  if (actions) {
    return (
      <Card>
        <ListRow
          name={player.name}
          meta={meta}
          onPress={onPress}
          actions={actions}
          last
        />
      </Card>
    );
  }
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
