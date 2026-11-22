// The Notifications tab's interim Invites screen (docs/features/team-membership.md,
// section e, "Notifications tab (interim: Invites)"), until feature 5's Notifications
// screen replaces it. The player's pending team invites, each with Accept and Decline.
// Tapping a card opens Team detail, so the player can see who's in the team first.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import { TeamLoadState, showActionError } from '../Team/teamCommon';

export default function InvitesScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  const [invites, setInvites] = useState(null); // GET /players/invites
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  // The running action, as "teamId:accept" or "teamId:decline" (one at a time).
  const { run: runOnce, busyKey: busy } = useBusyAction();

  // A failed reload keeps what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get('/players/invites');
      setInvites(res.data);
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

  // Accept or decline, then show the list as it is now. A 404 or 409 (the invite was
  // cancelled, or the team filled up) says so and reloads.
  const run = (key, request) =>
    runOnce(async () => {
      try {
        await request();
        await load();
      } catch (err) {
        showActionError(err, { onStale: load });
      }
    }, key);

  const header = (
    <ScreenHeader title="Invites" style={{ paddingTop: spacing.lg }} />
  );

  if (status !== 'ready') {
    return (
      <Screen style={{ gap: spacing.listGap }}>
        {header}
        <TeamLoadState
          status={status}
          onRetry={() => {
            setStatus('loading');
            load();
          }}
          errorMessage="Couldn't load your invites."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={invites}
        keyExtractor={invite => String(invite.id)}
        renderItem={({ item }) => (
          <InviteCard
            invite={item}
            busy={busy}
            onOpen={() =>
              navigation.navigate('TeamDetail', { teamId: item.teamId })
            }
            onAccept={() =>
              run(`${item.teamId}:accept`, () =>
                api.post(`/teams/${item.teamId}/accept`),
              )
            }
            onDecline={() =>
              run(`${item.teamId}:decline`, () =>
                api.post(`/teams/${item.teamId}/reject`),
              )
            }
          />
        )}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: spacing.listGap }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={<EmptyState message="No invites right now." />}
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

// One invite: the team, who invited you and how full the team is, then Accept and
// Decline side by side. Accept is disabled when the team is full.
function InviteCard({ invite, busy, onOpen, onAccept, onDecline }) {
  const { spacing } = useTheme();
  const { team } = invite;
  const isFull = team.memberCount >= team.maxMembers;
  const acceptKey = `${invite.teamId}:accept`;
  const declineKey = `${invite.teamId}:decline`;
  const captain = team.captain?.name || 'The captain';

  return (
    <Card
      onPress={onOpen}
      accessibilityLabel={`Open ${team.name}`}
      style={{ gap: spacing.cardGap }}
    >
      <View style={{ gap: spacing.xxs }}>
        <Text variant="cardTitle">{team.name}</Text>
        <Text variant="meta" color="textMuted">
          {`${captain} invited you · ${team.memberCount} / ${team.maxMembers} members`}
        </Text>
      </View>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Button
          title={
            isFull
              ? `Team is full (${team.memberCount}/${team.maxMembers})`
              : 'Accept'
          }
          accessibilityLabel={
            isFull ? undefined : `Accept the invite to ${team.name}`
          }
          disabled={isFull || (busy !== null && busy !== acceptKey)}
          loading={busy === acceptKey}
          onPress={onAccept}
          style={styles.grow}
        />
        <Button
          title="Decline"
          variant="secondary"
          accessibilityLabel={`Decline the invite to ${team.name}`}
          disabled={busy !== null && busy !== declineKey}
          loading={busy === declineKey}
          onPress={onDecline}
          style={styles.grow}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 0 },
});
