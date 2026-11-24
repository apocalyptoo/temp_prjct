// Team detail (docs/features/team-membership.md, sections c and e): one team, as the
// viewer sees it. Params: { teamId }. Opened from My Teams, Explore → Teams and a
// player's teams on Player detail. Every person row (members, join requests, invites)
// opens Player detail (docs/features/explore.md, P28), pushed so a chain of team and
// player pages goes back one step at a time (P30).
// The backend says where the viewer stands (viewerState: captain, member, invited,
// requested or none) and sends join requests and pending invites only to the captain.
import React, { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  BackLink,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  Icon,
  IconButton,
  ListRow,
  NoticeLine,
  Pill,
  Screen,
  SectionHeader,
  Text,
  TextLink,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import {
  CaptainLabel,
  TeamLoadState,
  personName,
  personMeta,
  showActionError,
  useTeam,
} from './teamCommon';

// The back link names the screen underneath (the mockup's "‹ My Teams").
const BACK_LABELS = {
  MyTeams: 'My Teams',
  Teams: 'All Teams',
  Invites: 'Invites',
};
function backLabel(navigation) {
  const state = navigation.getState?.();
  const below = state?.routes?.[state.index - 1]?.name;
  return BACK_LABELS[below]; // no short name: BackLink says just "Back"
}

// The confirmation dialogs (docs/features/team-membership.md, section e, "Confirmation
// dialogs"), with the spec's exact wording. Each says what the confirm button sends,
// and whether the screen then goes back (the team is gone for this viewer) or reloads.
function dialogFor(kind, team, row) {
  const name = row ? personName(row) : '';
  switch (kind) {
    case 'leave':
      return {
        title: `Leave ${team.name}?`,
        message:
          "You'll need a new invite or an approved request to join again.",
        confirmTitle: 'Leave team',
        destructive: true,
        request: () => api.post(`/teams/${team.id}/leave`),
        goBack: true,
      };
    case 'transferFirst':
      return {
        title: 'Transfer captaincy first',
        message: `You're the captain of ${team.name}. Make another member captain, then you can leave.`,
        confirmTitle: 'Transfer captaincy',
        cancelTitle: 'Not now',
        opens: 'TransferCaptaincy',
      };
    case 'leaveAndDelete':
      return {
        title: `Leave and delete ${team.name}?`,
        message:
          "You're the only member, so leaving deletes the team and cancels its pending invites and requests. This can't be undone.",
        confirmTitle: 'Leave and delete',
        destructive: true,
        request: () => api.post(`/teams/${team.id}/leave`),
        goBack: true,
      };
    case 'remove':
      return {
        title: `Remove ${name} from ${team.name}?`,
        message: "They'll no longer be a member of this team.",
        confirmTitle: 'Remove',
        destructive: true,
        request: () => api.delete(`/teams/${team.id}/members/${row.userId}`),
      };
    case 'delete':
      return {
        title: `Delete ${team.name}?`,
        message: `This deletes the team for all its members and cancels its pending invites and requests. This can't be undone.`,
        confirmTitle: 'Delete team',
        destructive: true,
        request: () => api.delete(`/teams/${team.id}`),
        goBack: true,
      };
    case 'declineRequest':
      return {
        title: `Decline ${name}'s request?`,
        message: 'They can ask to join again later.',
        confirmTitle: 'Decline',
        destructive: true,
        request: () =>
          api.post(`/teams/${team.id}/requests/${row.userId}/reject`),
      };
    case 'cancelInvite':
      return {
        title: `Cancel the invite to ${name}?`,
        message: "They won't be able to accept it any more.",
        confirmTitle: 'Cancel invite',
        cancelTitle: 'Keep invite',
        destructive: true,
        request: () => api.delete(`/teams/${team.id}/invites/${row.userId}`),
      };
    default:
      return null;
  }
}

export default function TeamDetailScreen({ route, navigation }) {
  const { teamId } = route.params;
  const { user } = useContext(AuthContext);
  const { spacing } = useTheme();
  const { team, status, reload, retry } = useTeam(teamId, navigation);
  // Which action's request is running (one at a time), so its button shows the
  // loading state and nothing else can be pressed twice.
  const { run: runOnce, busyKey: busy } = useBusyAction();
  // The open confirmation dialog: { kind, row } (see dialogFor), or null.
  const [asking, setAsking] = useState(null);

  // Runs one action, then shows the team as it is now (or goes back, when the team is
  // gone for this viewer). A 404 or 409 means the screen was out of date: the alert
  // says so and the team reloads.
  const run = (key, request, { goBack = false } = {}) =>
    runOnce(async () => {
      try {
        await request();
        if (goBack) navigation.goBack();
        else await reload();
      } catch (err) {
        showActionError(err, { onStale: reload });
      }
    }, key);

  const dialog =
    asking && team ? dialogFor(asking.kind, team, asking.row) : null;
  const confirm = async () => {
    if (dialog.opens) {
      setAsking(null);
      navigation.navigate(dialog.opens, {
        teamId: team.id,
        teamName: team.name,
      });
      return;
    }
    await run('dialog', dialog.request, { goBack: dialog.goBack });
    setAsking(null);
  };

  return (
    <Screen
      scroll
      style={{ gap: spacing.detailGap, paddingBottom: spacing.xxxl }}
    >
      <BackLink label={backLabel(navigation)} onPress={navigation.goBack} />
      {status !== 'ready' ? (
        <TeamLoadState status={status} onRetry={retry} />
      ) : (
        <TeamContent
          team={team}
          isPlayer={user?.role === 'PLAYER'}
          busy={busy}
          run={run}
          ask={(kind, row) => setAsking({ kind, row })}
          navigation={navigation}
        />
      )}
      <ConfirmDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmTitle={dialog?.confirmTitle}
        cancelTitle={dialog?.cancelTitle}
        destructive={dialog?.destructive ?? false}
        loading={busy === 'dialog'}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

function TeamContent({ team, isPlayer, busy, run, ask, navigation }) {
  const { spacing } = useTheme();
  const openPlayer = row =>
    navigation.push('PlayerDetail', {
      userId: row.userId,
      playerName: personName(row),
    });
  const state = team.viewerState;
  const isFull = team.memberCount >= team.maxMembers;
  const fullLabel = `Team is full (${team.memberCount}/${team.maxMembers})`;
  const captainRow = team.members.find(row => row.userId === team.captainId);
  const toParams = { teamId: team.id, teamName: team.name };
  const editTeam = () =>
    navigation.navigate('EditTeam', {
      teamId: team.id,
      teamName: team.name,
      description: team.description,
      area: team.area,
    });

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <View style={[styles.wrapRow, { gap: spacing.xs }]}>
          <ViewerPill state={state} />
          <Pill label={`${team.memberCount} / ${team.maxMembers} members`} />
        </View>
        <Text variant="title" accessibilityRole="header">
          {team.name}
        </Text>
        <TeamArea
          area={team.area}
          onAdd={state === 'captain' ? editTeam : null}
        />
        {team.description ? (
          <Text variant="bodySmall" color="textMuted">
            {team.description}
          </Text>
        ) : null}
      </View>

      {state === 'captain' ? (
        <SideBySide>
          <Button
            title={isFull ? fullLabel : 'Invite players'}
            disabled={isFull}
            onPress={() => navigation.navigate('InvitePlayers', toParams)}
            style={styles.grow}
          />
          {team.memberCount > 1 ? (
            <Button
              title="Transfer captaincy"
              variant="secondary"
              onPress={() => navigation.navigate('TransferCaptaincy', toParams)}
              style={styles.grow}
            />
          ) : null}
        </SideBySide>
      ) : null}

      {state === 'invited' ? (
        <>
          <NoticeLine
            strong={`${personName(captainRow)} invited you`}
            text="to this team"
          />
          <SideBySide>
            <Button
              title={isFull ? fullLabel : 'Accept invite'}
              disabled={isFull || busy !== null}
              loading={busy === 'accept'}
              onPress={() =>
                run('accept', () => api.post(`/teams/${team.id}/accept`))
              }
              style={styles.grow}
            />
            <Button
              title="Decline"
              variant="secondary"
              disabled={busy !== null && busy !== 'decline'}
              loading={busy === 'decline'}
              onPress={() =>
                run('decline', () => api.post(`/teams/${team.id}/reject`))
              }
              style={styles.grow}
            />
          </SideBySide>
        </>
      ) : null}

      {state === 'requested' ? (
        <Card style={{ gap: spacing.cardGap }}>
          <SectionHeader title="Your request" />
          <Text color="textMuted">Waiting for the captain</Text>
          {team.myRequest?.message ? (
            <Text variant="bodySmall" color="textMuted">
              {`“${team.myRequest.message}”`}
            </Text>
          ) : null}
          <Button
            title="Cancel request"
            variant="secondary"
            loading={busy === 'cancelRequest'}
            onPress={() =>
              run('cancelRequest', () =>
                api.delete(`/teams/${team.id}/requests/me`),
              )
            }
          />
        </Card>
      ) : null}

      {state === 'none' && isPlayer ? (
        <Button
          title={isFull ? fullLabel : 'Request to join'}
          disabled={isFull}
          fullWidth
          onPress={() => navigation.navigate('RequestToJoin', toParams)}
        />
      ) : null}

      {state === 'captain' && team.joinRequests?.length > 0 ? (
        <JoinRequestsCard
          team={team}
          busy={busy}
          run={run}
          ask={ask}
          onOpen={openPlayer}
        />
      ) : null}

      {state === 'captain' && team.pendingInvites?.length > 0 ? (
        <Card>
          <SectionHeader title="Invited" />
          {team.pendingInvites.map((row, index) => (
            <ListRow
              key={row.userId}
              name={personName(row)}
              meta={personMeta(row)}
              onPress={() => openPlayer(row)}
              actions={
                <IconButton
                  icon="reject"
                  accessibilityLabel={`Cancel invite to ${personName(row)}`}
                  disabled={busy !== null}
                  onPress={() => ask('cancelInvite', row)}
                />
              }
              last={index === team.pendingInvites.length - 1}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Members" />
        {team.members.map((row, index) => (
          <ListRow
            key={row.userId}
            name={personName(row)}
            meta={personMeta(row)}
            onPress={() => openPlayer(row)}
            trailing={row.userId === team.captainId ? <CaptainLabel /> : null}
            actions={
              row.userId !== team.captainId && state === 'captain' ? (
                <IconButton
                  icon="remove"
                  accessibilityLabel={`Remove ${personName(row)}`}
                  disabled={busy !== null}
                  onPress={() => ask('remove', row)}
                />
              ) : null
            }
            last={index === team.members.length - 1}
          />
        ))}
      </Card>

      {state === 'member' ? (
        <Button
          title="Leave team"
          variant="danger"
          fullWidth
          onPress={() => ask('leave')}
        />
      ) : null}

      {state === 'captain' ? (
        <View style={{ gap: spacing.md }}>
          <Button
            title="Edit team"
            variant="secondary"
            icon="edit"
            fullWidth
            onPress={editTeam}
          />
          <Button
            title="Leave team"
            variant="danger"
            fullWidth
            onPress={() =>
              ask(team.memberCount > 1 ? 'transferFirst' : 'leaveAndDelete')
            }
          />
          <Button
            title="Delete team"
            variant="danger"
            fullWidth
            onPress={() => ask('delete')}
          />
        </View>
      ) : null}
    </>
  );
}

// The team's area under its name, as a muted line with the area icon. Without an area,
// the captain (onAdd set) sees "No area yet." and an Add area link to Edit team
// (explore spec P27): a team without an area can't be found by the area filter.
// Everyone else sees nothing.
function TeamArea({ area, onAdd }) {
  const { colors, spacing, icon } = useTheme();
  if (!area && !onAdd) return null;
  return (
    <View style={[styles.wrapRow, { gap: spacing.xs }]}>
      <Icon name="area" size={icon.sizeSmall} color={colors.textMuted} />
      <Text variant="bodySmall" color="textMuted" style={styles.shrink}>
        {area || 'No area yet.'}
      </Text>
      {area ? null : <TextLink title="Add area" onPress={onAdd} />}
    </View>
  );
}

// Where the viewer stands, as a pill; nothing for visitors, venue owners and the admin.
function ViewerPill({ state }) {
  if (state === 'captain') return <Pill label="Captain" variant="strong" />;
  if (state === 'member') return <Pill label="Player" />;
  if (state === 'invited') return <Pill label="Invited" />;
  if (state === 'requested') return <Pill label="Request sent" />;
  return null;
}

// Two buttons sharing a row (DESIGN.md: a layout, not a component).
function SideBySide({ children }) {
  const { spacing } = useTheme();
  return <View style={[styles.wrapRow, { gap: spacing.md }]}>{children}</View>;
}

// The captain's join requests, oldest first, each with its message under the row.
// Approving needs no confirmation; declining asks first (ask).
function JoinRequestsCard({ team, busy, run, ask, onOpen }) {
  const { spacing } = useTheme();
  const requests = team.joinRequests;
  return (
    <Card>
      <SectionHeader
        title="Join requests"
        right={<Pill label={String(requests.length)} />}
      />
      {requests.map((row, index) => {
        const name = personName(row);
        const last = index === requests.length - 1;
        const key = `approve-${row.userId}`;
        return (
          <View key={row.userId}>
            {/* The row draws no line of its own, so the message sits above the line. */}
            <ListRow
              name={name}
              meta={personMeta(row)}
              onPress={() => onOpen(row)}
              last
              actions={
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <IconButton
                    variant="reject"
                    accessibilityLabel={`Decline ${name}`}
                    disabled={busy !== null}
                    onPress={() => ask('declineRequest', row)}
                  />
                  <IconButton
                    variant="approve"
                    accessibilityLabel={`Approve ${name}`}
                    disabled={busy !== null}
                    onPress={() =>
                      run(key, () =>
                        api.post(
                          `/teams/${team.id}/requests/${row.userId}/approve`,
                        ),
                      )
                    }
                  />
                </View>
              }
            />
            {row.message ? (
              <Text
                variant="bodySmall"
                color="textMuted"
                style={{ paddingBottom: spacing.md }}
              >
                {`“${row.message}”`}
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
  wrapRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 0 },
  shrink: { flexShrink: 1 },
});
