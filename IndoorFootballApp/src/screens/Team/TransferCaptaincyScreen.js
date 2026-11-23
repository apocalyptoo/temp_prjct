// Transfer captaincy: pick an accepted member, then confirm
// (docs/features/team-membership.md, section e, "Transfer captaincy").
// Params: { teamId, teamName }. Opened from the captain's Team detail. The team is loaded
// fresh, so the list never shows someone who has just left.
import React, { useState } from 'react';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
} from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';
import {
  TeamLoadState,
  personName,
  personMeta,
  showActionError,
  useTeam,
} from './teamCommon';

export default function TransferCaptaincyScreen({ route, navigation }) {
  const { teamId, teamName } = route.params;
  const { spacing } = useTheme();
  const { team, status, reload, retry } = useTeam(teamId, navigation);
  const [picked, setPicked] = useState(null); // the member row being confirmed
  const { run, busy: saving } = useBusyAction();

  const name = team?.name ?? teamName ?? 'Team';
  const candidates = (team?.members ?? []).filter(
    row => row.userId !== team.captainId,
  );

  const confirm = () =>
    run(async () => {
      try {
        await api.post(`/teams/${teamId}/transfer`, { userId: picked.userId });
        setPicked(null);
        navigation.goBack(); // Team detail reloads and shows the member view.
      } catch (err) {
        setPicked(null);
        showActionError(err, { onStale: reload });
      }
    });

  return (
    <Screen scroll style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <ScreenHeader
        back={{ label: name, onPress: navigation.goBack }}
        title="Transfer captaincy"
      />
      {status !== 'ready' ? (
        <TeamLoadState status={status} onRetry={retry} />
      ) : candidates.length === 0 ? (
        <EmptyState message="No other members yet." />
      ) : (
        <Card>
          {candidates.map((row, index) => (
            <ListRow
              key={row.userId}
              name={personName(row)}
              meta={personMeta(row)}
              onPress={() => setPicked(row)}
              last={index === candidates.length - 1}
            />
          ))}
        </Card>
      )}
      <ConfirmDialog
        visible={picked !== null}
        title={picked ? `Make ${personName(picked)} captain?` : ''}
        message={
          picked
            ? `You'll stay in ${name} as a player. ${personName(
                picked,
              )} will manage invites, requests and the team's details.`
            : ''
        }
        confirmTitle="Make captain"
        loading={saving}
        onConfirm={confirm}
        onCancel={() => setPicked(null)}
      />
    </Screen>
  );
}
