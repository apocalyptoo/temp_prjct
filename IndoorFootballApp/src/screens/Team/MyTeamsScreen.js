// My Teams (docs/features/team-membership.md, section e, "My Teams"; the mockup is
// docs/design/floodlight-my-teams.png): the player's teams as cards, the join requests
// they've sent (with Cancel), and Create team. Reloads whenever it comes into view, and
// on pull to refresh.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  NoticeLine,
  Pill,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  TextLink,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState, showActionError } from './teamCommon';

export default function MyTeamsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { colors, spacing } = useTheme();
  const [teams, setTeams] = useState(null); // GET /teams/me
  const [requests, setRequests] = useState([]); // GET /players/requests
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  // The teamId of the request being cancelled (one action at a time).
  const { run, busyKey: cancelling } = useBusyAction();

  // A failed reload keeps what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const [teamsRes, requestsRes] = await Promise.all([
        api.get('/teams/me'),
        api.get('/players/requests'),
      ]);
      setTeams(teamsRes.data);
      setRequests(requestsRes.data);
      setStatus('ready');
    } catch {
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setStatus('loading');
    load();
  };

  const cancelRequest = teamId =>
    run(async () => {
      try {
        await api.delete(`/teams/${teamId}/requests/me`);
        await load();
      } catch (err) {
        showActionError(err, { onStale: load });
      }
    }, teamId);

  const openTeam = teamId => navigation.navigate('TeamDetail', { teamId });

  const header = (
    <ScreenHeader
      title="My Teams"
      action={
        <Button
          title="Create team"
          icon="add"
          onPress={() => navigation.navigate('CreateTeam')}
        />
      }
      style={{ paddingTop: spacing.lg }}
    />
  );

  if (status !== 'ready') {
    return (
      <Screen style={{ gap: spacing.listGap }}>
        {header}
        <TeamLoadState
          status={status}
          onRetry={retry}
          errorMessage="Couldn't load your teams."
        />
      </Screen>
    );
  }

  const nothingYet = teams.length === 0 && requests.length === 0;

  return (
    <Screen>
      <FlatList
        data={teams}
        keyExtractor={team => String(team.id)}
        renderItem={({ item }) => (
          <TeamCard
            team={item}
            isCaptain={item.captainId === user?.id}
            onPress={() => openTeam(item.id)}
          />
        )}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: spacing.listGap }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={
          nothingYet ? (
            <View>
              <EmptyState
                message="You're not in a team yet."
                actionTitle="Create team"
                actionIcon="add"
                onAction={() => navigation.navigate('CreateTeam')}
              />
              <TextLink
                title="Find a team"
                onPress={() =>
                  navigation.navigate('ExploreTab', {
                    screen: 'Teams',
                    initial: false,
                  })
                }
                style={styles.centred}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          requests.length > 0 ? (
            <RequestsSentCard
              requests={requests}
              cancelling={cancelling}
              onCancel={cancelRequest}
              onOpen={openTeam}
              style={teams.length > 0 ? { marginTop: spacing.listGap } : null}
            />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
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
    </Screen>
  );
}

function Gap() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.listGap }} />;
}

// One team, as in the mockup: avatar, name, "x / 15 members", the area (when set), the
// viewer's pill, the description, and for a captain with join requests, the notice line.
function TeamCard({ team, isCaptain, onPress }) {
  const { colors, spacing, icon } = useTheme();
  const waiting = isCaptain ? team.joinRequestCount ?? 0 : 0;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Open ${team.name}`}
      style={{ gap: spacing.cardGap }}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar name={team.name} size="large" />
        <View style={styles.fill}>
          <Text variant="cardTitle">{team.name}</Text>
          <Text variant="meta" color="textMuted">
            {`${team.memberCount} / ${team.maxMembers} members`}
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
        {isCaptain ? (
          <Pill label="Captain" variant="strong" />
        ) : (
          <Pill label="Player" />
        )}
      </View>
      {team.description ? (
        <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
          {team.description}
        </Text>
      ) : null}
      {waiting > 0 ? (
        <>
          <Divider />
          <NoticeLine
            strong={`${waiting} join ${waiting === 1 ? 'request' : 'requests'}`}
            text="waiting for you"
          />
        </>
      ) : null}
    </Card>
  );
}

// The join requests the player has sent, each with its message and Cancel.
function RequestsSentCard({ requests, cancelling, onCancel, onOpen, style }) {
  const { spacing } = useTheme();
  return (
    <Card style={style}>
      <SectionHeader title="Requests sent" />
      {requests.map((request, index) => {
        const last = index === requests.length - 1;
        return (
          <View key={request.teamId}>
            {/* The row draws no line of its own, so the message sits above the line. */}
            <ListRow
              name={request.team.name}
              meta="Waiting for the captain"
              onPress={() => onOpen(request.teamId)}
              accessibilityLabel={`Open ${request.team.name}`}
              last
              actions={
                <Button
                  title="Cancel"
                  variant="secondary"
                  accessibilityLabel={`Cancel request to ${request.team.name}`}
                  loading={cancelling === request.teamId}
                  disabled={
                    cancelling !== null && cancelling !== request.teamId
                  }
                  onPress={() => onCancel(request.teamId)}
                />
              }
            />
            {request.message ? (
              <Text
                variant="bodySmall"
                color="textMuted"
                style={{ paddingBottom: spacing.md }}
              >
                {`“${request.message}”`}
              </Text>
            ) : null}
            {last ? null : <Divider />}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  centred: { alignSelf: 'center' },
});
