// Invite players to a team (docs/features/team-membership.md, section e, "Invite
// players"). Params: { teamId, teamName }. Opened from the captain's Team detail.
// Lists every player except the captain, members, players already invited and players
// who have asked to join (they're in Team detail's Join requests card). Inviting keeps
// the screen open: the row's button turns into a disabled "Invited".
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState, showActionError, useTeam } from './teamCommon';

// The user ids that can't be invited: everyone already in, invited or asking.
function excludedIds(team) {
  const rows = [
    ...(team.members ?? []),
    ...(team.pendingInvites ?? []),
    ...(team.joinRequests ?? []),
  ];
  return new Set([team.captainId, ...rows.map(row => row.userId)]);
}

const matches = (player, query) =>
  player.name.toLowerCase().includes(query.trim().toLowerCase());

export default function InvitePlayersScreen({ route, navigation }) {
  const { teamId, teamName } = route.params;
  const { spacing } = useTheme();
  const { team, status, reload, retry } = useTeam(teamId, navigation);
  const [players, setPlayers] = useState(null); // GET /players, once loaded
  const [playersFailed, setPlayersFailed] = useState(false);
  const [query, setQuery] = useState('');
  // Players invited from this screen: userId → button label ("Invited", or "Joined"
  // when the invite approved a join request that had just come in).
  const [done, setDone] = useState({});
  // The userId whose invite runs (one at a time).
  const { run, busyKey: inviting } = useBusyAction();

  const loadPlayers = useCallback(async () => {
    try {
      const res = await api.get('/players');
      setPlayers(res.data);
      setPlayersFailed(false);
    } catch {
      setPlayersFailed(true);
    }
  }, []);
  useEffect(
    () => navigation.addListener('focus', loadPlayers),
    [navigation, loadPlayers],
  );

  const reloadAll = () => {
    setDone({});
    reload();
    loadPlayers();
  };

  const invite = player =>
    run(async () => {
      try {
        const res = await api.post(`/teams/${teamId}/invite`, {
          userId: player.id,
        });
        setDone(current => ({
          ...current,
          [player.id]: res.data?.joined ? 'Joined' : 'Invited',
        }));
      } catch (err) {
        const code = err?.response?.status;
        if (code === 400 || code === 404 || code === 409) {
          // Already invited or in the team, gone, or the team is full: the list is out
          // of date. Say so, then show it as it is now.
          Alert.alert(
            'Something changed',
            err.response.data?.error || 'This is no longer possible.',
          );
          reloadAll();
        } else {
          showActionError(err);
        }
      }
    }, player.id);

  const name = team?.name ?? teamName ?? 'Team';
  const ready = status === 'ready' && players !== null;
  const loadState = status === 'ready' && playersFailed ? 'error' : status;

  let body;
  if (!ready) {
    body = (
      <TeamLoadState
        status={loadState}
        onRetry={() => {
          retry();
          loadPlayers();
        }}
      />
    );
  } else {
    const isFull = team.memberCount >= team.maxMembers;
    const excluded = excludedIds(team);
    const candidates = players.filter(
      player => !excluded.has(player.id) || done[player.id],
    );
    const shown = candidates.filter(player => matches(player, query));

    body = (
      <>
        {isFull ? (
          <Text variant="bodyStrong">
            {`Team is full (${team.memberCount}/${team.maxMembers})`}
          </Text>
        ) : (
          <Text variant="meta" color="textMuted">
            {`${team.memberCount} / ${team.maxMembers} members`}
          </Text>
        )}
        {candidates.length === 0 ? (
          <EmptyState message="No players to invite right now." />
        ) : (
          <>
            <TextField
              label="Search by name"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {shown.length === 0 ? (
              <EmptyState message="No players match your search." />
            ) : (
              <Card>
                {shown.map((player, index) => {
                  const label = done[player.id];
                  return (
                    <ListRow
                      key={player.id}
                      name={player.name}
                      meta={player.playerProfile?.position}
                      last={index === shown.length - 1}
                      trailing={
                        <Button
                          title={label ?? 'Invite'}
                          variant="secondary"
                          accessibilityLabel={
                            label
                              ? `${label}: ${player.name}`
                              : `Invite ${player.name}`
                          }
                          disabled={
                            Boolean(label) ||
                            isFull ||
                            (inviting !== null && inviting !== player.id)
                          }
                          loading={inviting === player.id}
                          onPress={() => invite(player)}
                        />
                      }
                    />
                  );
                })}
              </Card>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: name, onPress: navigation.goBack }}
        title="Invite players"
      />
      {body}
    </Screen>
  );
}
