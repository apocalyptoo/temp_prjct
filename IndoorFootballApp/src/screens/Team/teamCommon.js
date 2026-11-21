// Shared by the team screens of feature 1 (docs/features/team-membership.md, section e):
// loading one team, the "team gone" case, the alerts after a failed action, and the
// join request message limit.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/ui';

// The join request message limit (docs/PRODUCT.md, "Join request message"). Counted in
// characters as people see them (code points), like the backend, so an emoji counts once.
export const MESSAGE_MAX = 150;
export const charCount = text => [...text].length;
export const limitChars = (text, max) =>
  charCount(text) > max ? [...text].slice(0, max).join('') : text;

// A membership row's person, as the backend sends them.
export const personName = row => row?.user?.name || 'Unknown player';
export const personPosition = row => row?.user?.playerProfile?.position;

// After a failed action. A 404 (the thing is gone) or 409 (the team changed, for example
// it's full) means the screen shows old data: say so, then refresh with onStale.
// Anything else is a plain error. The backend's message is short and human, so it's
// shown as it is.
export function showActionError(err, { onStale } = {}) {
  const status = err?.response?.status;
  const message = err?.response?.data?.error;
  if (status === 404 || status === 409) {
    Alert.alert('Something changed', message || 'This is no longer possible.');
    onStale?.();
    return;
  }
  Alert.alert('Error', message || 'Something went wrong. Please try again.');
}

// Loads GET /teams/:teamId whenever the screen comes into view (React Navigation's
// focus event also fires when it first opens).
// status: 'loading' (first load), 'ready', or 'error' (the first load failed for a
// reason other than 404). A failed reload keeps the content already shown. When the
// team no longer exists, an alert says so and the screen goes back.
export function useTeam(teamId, navigation) {
  const [team, setTeam] = useState(null);
  const [status, setStatus] = useState('loading');

  const reload = useCallback(async () => {
    try {
      const res = await api.get(`/teams/${teamId}`);
      setTeam(res.data);
      setStatus('ready');
    } catch (err) {
      if (err?.response?.status === 404) {
        Alert.alert('Team not found', 'This team no longer exists.');
        navigation.goBack();
        return;
      }
      setStatus(current => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [teamId, navigation]);

  useEffect(
    () => navigation.addListener('focus', reload),
    [navigation, reload],
  );

  const retry = () => {
    setStatus('loading');
    reload();
  };

  return { team, status, reload, retry };
}

// What a team screen shows before its team has loaded: a spinner, or after a failed
// first load, a line and Try again.
export function TeamLoadState({ status, onRetry }) {
  const { colors, spacing } = useTheme();
  if (status === 'error') {
    return (
      <EmptyState
        message="Couldn't load this team."
        actionTitle="Try again"
        onAction={onRetry}
      />
    );
  }
  return (
    <View style={[styles.centre, { padding: spacing.xxxl }]}>
      <ActivityIndicator
        size="large"
        color={colors.accent}
        accessibilityLabel="Loading"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
