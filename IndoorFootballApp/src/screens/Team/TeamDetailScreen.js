// Team detail (docs/features/team-membership.md, sections c and e): one team, as the
// viewer sees it. Params: { teamId }. Opened from My Teams and from Explore → Teams.
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
  Divider,
  Icon,
  IconButton,
  ListRow,
  NoticeLine,
  Pill,
  Screen,
  SectionHeader,
  Text,
} from '../../components/ui';
import {
  TeamLoadState,
  personName,
  personPosition,
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
  return BACK_LABELS[below] ?? 'Back';
}

export default function TeamDetailScreen({ route, navigation }) {
  const { teamId } = route.params;
  const { user } = useContext(AuthContext);
  const { spacing } = useTheme();
  const { team, status, reload, retry } = useTeam(teamId, navigation);
  // Which action's request is running (one at a time), so its button shows the
  // loading state and nothing else can be pressed twice.
  const [busy, setBusy] = useState(null);

  // Runs one action, then shows the team as it is now. A 404 or 409 means the screen
  // was out of date: the alert says so and the team reloads.
  const run = async (key, request) => {
    setBusy(key);
    try {
      await request();
      await reload();
    } catch (err) {
      showActionError(err, { onStale: reload });
    } finally {
      setBusy(null);
    }
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
          navigation={navigation}
        />
      )}
    </Screen>
  );
}

function TeamContent({ team, isPlayer, busy, run, navigation }) {
  const { spacing } = useTheme();
  const state = team.viewerState;
  const isFull = team.memberCount >= team.maxMembers;
  const fullLabel = `Team is full (${team.memberCount}/${team.maxMembers})`;
  const captainRow = team.members.find(row => row.userId === team.captainId);
  const toParams = { teamId: team.id, teamName: team.name };

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
            onPress={() =>
              navigation.navigate('AddMember', {
                teamId: team.id,
                captainId: team.captainId,
              })
            }
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
        <JoinRequestsCard team={team} busy={busy} run={run} />
      ) : null}

      {state === 'captain' && team.pendingInvites?.length > 0 ? (
        <Card>
          <SectionHeader title="Invited" />
          {team.pendingInvites.map((row, index) => (
            <ListRow
              key={row.userId}
              name={personName(row)}
              meta="Invited"
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
            meta={personPosition(row)}
            trailing={row.userId === team.captainId ? <CaptainLabel /> : null}
            last={index === team.members.length - 1}
          />
        ))}
      </Card>

      {/* TODO(F1.3): the captain's "Edit team" button goes here, under the cards
          (docs/features/team-membership.md, section e). It's hidden until the Create /
          Edit team form exists. "Invite players" above opens the interim Add Member
          screen until F1.3 builds the new one. */}
    </>
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

// The captain's row ends with a crown and "Captain" (DESIGN.md section 6).
function CaptainLabel() {
  const { colors, spacing, icon } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.xxs }]}>
      <Icon name="captain" size={icon.sizeSmall} color={colors.accent} />
      <Text variant="buttonSecondary" color="accent">
        Captain
      </Text>
    </View>
  );
}

// The captain's join requests, oldest first, each with its message under the row.
function JoinRequestsCard({ team, busy, run }) {
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
              meta={personPosition(row)}
              last
              trailing={
                <View style={[styles.row, { gap: spacing.sm }]}>
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
});
