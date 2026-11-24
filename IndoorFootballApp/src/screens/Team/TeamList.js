// Explore's Teams section (docs/features/explore.md, section e): every team, from
// GET /teams, with a search by name and an area filter. Teams with a free spot come first
// (the backend sorts them). One card per team, with a "Full" pill and the viewer's own
// pill (P20); tapping it opens Team detail. Creating a team belongs to My Teams, so
// there's a Create team button only when there are no teams at all, and never for venue
// owners (P21).
import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar, Card, Icon, Pill, Text } from '../../components/ui';
import { usePagedList } from '../../hooks/usePagedList';
import PagedList, {
  ListFilters,
  NO_FILTERS,
  toParams,
} from '../Shared/PagedList';
import { ViewerPill, viewerLabel } from './teamCommon';

export const NO_TEAMS = 'No teams yet.';
export const NO_MATCH = 'No teams match your search.';

const keyOf = team => team.id;

// navigation: the Explore screen's own (Team detail is in the same stack).
export default function TeamList({ navigation }) {
  const { user } = useContext(AuthContext);
  const list = usePagedList({
    path: '/teams',
    initialFilters: NO_FILTERS,
    toParams,
    keyOf,
  });

  // Create team lives in the My Teams tab; initial: false keeps My Teams under it, so
  // Back from the form goes there.
  const createTeam = {
    title: 'Create team',
    icon: 'add',
    onPress: () =>
      navigation.navigate('MyTeamsTab', {
        screen: 'CreateTeam',
        initial: false,
      }),
  };

  return (
    <PagedList
      list={list}
      keyOf={keyOf}
      renderItem={({ item }) => (
        <TeamCard
          team={item}
          onPress={() => navigation.navigate('TeamDetail', { teamId: item.id })}
        />
      )}
      filters={<ListFilters list={list} searchLabel="Search teams" />}
      errorMessage="Couldn't load teams."
      emptyMessage={NO_TEAMS}
      noMatchMessage={NO_MATCH}
      emptyAction={user?.role === 'PLAYER' ? createTeam : undefined}
    />
  );
}

// One team, like the My Teams card: avatar, name, captain, member count, area (when set),
// the pills, and up to two lines of the description (when set).
function TeamCard({ team, onPress }) {
  const { colors, spacing, icon } = useTheme();
  const isFull = team.memberCount >= team.maxMembers;
  const captain = `Captain: ${team.captain.name}`;
  const members = `${team.memberCount} / ${team.maxMembers} members`;
  return (
    <Card
      onPress={onPress}
      // Everything that tells teams apart (a card's label replaces its contents for
      // screen readers).
      accessibilityLabel={[
        team.name,
        captain,
        members,
        team.area,
        isFull ? 'Full' : null,
        viewerLabel(team.viewerState),
      ]
        .filter(Boolean)
        .join(', ')}
      style={{ gap: spacing.cardGap }}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar name={team.name} size="large" />
        <View style={styles.fill}>
          <Text variant="cardTitle">{team.name}</Text>
          <Text variant="meta" color="textMuted">
            {captain}
          </Text>
          <Text variant="meta" color="textMuted">
            {members}
          </Text>
          {team.area ? (
            <View style={[styles.row, { gap: spacing.xs }]}>
              <Icon
                name="area"
                size={icon.sizeSmall}
                color={colors.textMuted}
              />
              <Text variant="meta" color="textMuted" style={styles.shrink}>
                {team.area}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.pills, { gap: spacing.xs }]}>
          <ViewerPill state={team.viewerState} />
          {isFull ? <Pill label="Full" style={styles.pill} /> : null}
        </View>
      </View>
      {team.description ? (
        <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
          {team.description}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  pills: { alignItems: 'flex-end' },
  pill: { alignSelf: 'flex-end' },
});
