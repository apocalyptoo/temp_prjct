// Ask to join a team, with an optional message to the captain
// (docs/features/team-membership.md, section e, "Request to join").
// Params: { teamId, teamName }. Opened from Team detail's "Request to join".
import React, { useState } from 'react';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Screen, ScreenHeader, TextField } from '../../components/ui';
import {
  MESSAGE_MAX,
  charCount,
  limitChars,
  showActionError,
} from './teamCommon';

export default function RequestToJoinScreen({ route, navigation }) {
  const { teamId, teamName = 'this team' } = route.params;
  const { spacing } = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // The field stops at the limit, counted the way the backend counts (a phone's own
  // maxLength would count an emoji as two).
  const onChangeText = text => setMessage(limitChars(text, MESSAGE_MAX));

  const send = async () => {
    setSending(true);
    try {
      await api.post(`/teams/${teamId}/requests`, { message });
      navigation.goBack(); // Team detail reloads and shows "Request sent".
    } catch (err) {
      setSending(false);
      // Already in the team, already asked, team full or gone: Team detail shows the
      // real state once we're back.
      showActionError(err, { onStale: () => navigation.goBack() });
    }
  };

  return (
    <Screen
      scroll
      keyboardAware
      style={{ gap: spacing.xl, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: teamName, onPress: navigation.goBack }}
        title={`Ask to join ${teamName}`}
      />
      <TextField
        label="Message to the captain (optional)"
        value={message}
        onChangeText={onChangeText}
        multiline
        helper={`Up to ${MESSAGE_MAX} characters (${charCount(
          message,
        )}/${MESSAGE_MAX})`}
        editable={!sending}
      />
      <Button title="Send request" onPress={send} loading={sending} fullWidth />
    </Screen>
  );
}
