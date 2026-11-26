// A captain's join requests to one team: the card, approving, and the decline dialog.
// Shared by Team detail and the Notifications screen, so one action looks and behaves
// the same wherever it is (docs/features/notifications.md, P24 and P25).
// - Each row: avatar, name, "Position · Area", the quoted message under it, and the
//   decline (X) and approve (check) icon buttons beside the row. Tapping the row opens
//   Player detail (onOpen).
// - Approving needs no confirmation; declining asks first (declineRequestDialog).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Card,
  Divider,
  IconButton,
  ListRow,
  Pill,
  SectionHeader,
  Text,
} from '../../components/ui';
import { personMeta, personName } from './teamCommon';

// The busy key of one approval (useBusyAction), unique across teams.
export const approveKey = (teamId, row) => `approve-${teamId}-${row.userId}`;

export const approveRequest = (teamId, row) =>
  api.post(`/teams/${teamId}/requests/${row.userId}/approve`);

// The decline confirmation, with the team membership spec's wording, for ConfirmDialog.
export function declineRequestDialog(teamId, row) {
  return {
    title: `Decline ${personName(row)}'s request?`,
    message: 'They can ask to join again later.',
    confirmTitle: 'Decline',
    destructive: true,
    request: () => api.post(`/teams/${teamId}/requests/${row.userId}/reject`),
  };
}

// title: "Join requests" on Team detail, "Join requests · {team}" on Notifications.
// busy: useBusyAction's busyKey; while anything runs, the buttons are disabled.
export function JoinRequestsCard({
  title = 'Join requests',
  requests,
  busy,
  onApprove,
  onDecline,
  onOpen,
}) {
  const { spacing } = useTheme();
  return (
    <Card>
      <SectionHeader
        title={title}
        right={<Pill label={String(requests.length)} />}
      />
      {requests.map((row, index) => {
        const name = personName(row);
        const last = index === requests.length - 1;
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
                    onPress={() => onDecline(row)}
                  />
                  <IconButton
                    variant="approve"
                    accessibilityLabel={`Approve ${name}`}
                    disabled={busy !== null}
                    onPress={() => onApprove(row)}
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
});
