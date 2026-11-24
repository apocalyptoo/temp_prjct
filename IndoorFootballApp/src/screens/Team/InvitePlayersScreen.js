// Invite players to a team (docs/features/explore.md, section e, "Invite players"; P29).
// Params: { teamId, teamName }. Opened from the captain's Team detail.
// The title and the member count stay at the top; under them, the same player list as
// Explore → Players, fed by GET /teams/:teamId/invite-candidates: everyone the captain
// may find, minus the captain, members, invited players and players who asked to join.
// Inviting keeps the screen open: the row stays and its button turns into a disabled
// "Invited". Tapping the rest of the row opens Player detail.
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Screen, ScreenHeader, Text } from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import PlayerList from '../Player/PlayerList';
import { TeamLoadState, showActionError, useTeam } from './teamCommon';

export const NO_CANDIDATES = 'No players to invite right now.';

export default function InvitePlayersScreen({ route, navigation }) {
  const { teamId, teamName } = route.params;
  const { spacing } = useTheme();
  // The team, for the member count and whether it's full.
  const { team, status, reload, retry } = useTeam(teamId, navigation);
  // The id of the player whose invite runs (one at a time).
  const { run, busy, isBusy } = useBusyAction();

  // An invited player leaves the server's list (list.leave) but stays on screen, marked
  // with the button's label; a fresh load of the list then leaves them out.
  const invite = (player, list) =>
    run(async () => {
      try {
        const res = await api.post(`/teams/${teamId}/invite`, {
          userId: player.id,
        });
        // "Joined": the player had just asked to join, so the invite approved it. That
        // changes the member count.
        const joined = Boolean(res.data?.joined);
        list.leave(player.id, { inviteLabel: joined ? 'Joined' : 'Invited' });
        if (joined) await reload();
      } catch (err) {
        const code = err?.response?.status;
        if (code === 400 || code === 404 || code === 409) {
          // Already invited or in the team, gone, or the team is full: the list is out
          // of date. Say so, then show it as it is now.
          Alert.alert(
            'Something changed',
            err.response.data?.error || 'This is no longer possible.',
          );
          await Promise.all([reload(), list.retry()]);
        } else {
          showActionError(err);
        }
      }
    }, player.id);

  const ready = status === 'ready';
  const isFull = ready && team.memberCount >= team.maxMembers;

  const inviteButton = (player, list) => {
    const label = player.inviteLabel;
    return (
      <Button
        title={label ?? 'Invite'}
        variant="secondary"
        accessibilityLabel={
          label ? `${label}: ${player.name}` : `Invite ${player.name}`
        }
        disabled={Boolean(label) || isFull || (busy && !isBusy(player.id))}
        loading={isBusy(player.id)}
        onPress={() => invite(player, list)}
      />
    );
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <ScreenHeader
          back={{
            label: team?.name ?? teamName ?? 'Team',
            onPress: navigation.goBack,
          }}
          title="Invite players"
        />
        {ready ? (
          <Text
            variant={isFull ? 'bodyStrong' : 'meta'}
            color={isFull ? 'text' : 'textMuted'}
          >
            {isFull
              ? `Team is full (${team.memberCount}/${team.maxMembers})`
              : `${team.memberCount} / ${team.maxMembers} members`}
          </Text>
        ) : null}
      </View>
      {ready ? (
        <View style={styles.fill}>
          <PlayerList
            navigation={navigation}
            path={`/teams/${teamId}/invite-candidates`}
            emptyMessage={NO_CANDIDATES}
            renderActions={inviteButton}
          />
        </View>
      ) : (
        <TeamLoadState status={status} onRetry={retry} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
