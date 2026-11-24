// Shared by the team screens of feature 1 (docs/features/team-membership.md, section e):
// loading one team, the "team gone" case, the alerts after a failed action, and the
// join request message limit.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { useTheme } from '../../theme/ThemeProvider';
import { useTryAgain } from '../../hooks/useTryAgain';
import { EmptyState, Icon, Pill, Text } from '../../components/ui';

// The join request message limit (docs/PRODUCT.md, "Join request message"). Counted in
// characters as people see them (code points), like the backend, so an emoji counts once.
export const MESSAGE_MAX = 150;
export const charCount = text => [...text].length;
export const limitChars = (text, max) =>
  charCount(text) > max ? [...text].slice(0, max).join('') : text;

// A membership row's person, as the backend sends them.
export const personName = row => row?.user?.name || 'Unknown player';
// The line under a person's name on every player row: "Goalkeeper · Mirpur 10", or
// just the position when they have no area (docs/features/explore.md, section e).
export const personMeta = row => {
  const profile = row?.user?.playerProfile;
  return [profile?.position, profile?.area].filter(Boolean).join(' · ');
};

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

// What a team screen shows before its data has loaded: a spinner, or after a failed
// first load, a line (errorMessage) and Try again, which always shows the spinner for a
// moment (useTryAgain).
export function TeamLoadState({
  status,
  onRetry,
  errorMessage = "Couldn't load this team.",
}) {
  const { colors, spacing } = useTheme();
  const { trying, tryAgain } = useTryAgain(onRetry);
  if (status === 'error' && !trying) {
    return (
      <EmptyState
        message={errorMessage}
        actionTitle="Try again"
        onAction={tryAgain}
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

// Where the viewer stands with a team, in words, by the backend's viewerState; null for
// visitors, venue owners and the admin.
const VIEWER_LABELS = {
  captain: 'Captain',
  member: 'Player',
  invited: 'Invited',
  requested: 'Request sent',
};
export const viewerLabel = state => VIEWER_LABELS[state] ?? null;

// The same as a pill, or nothing. Used on Team detail and on Explore's team cards.
export function ViewerPill({ state }) {
  const label = viewerLabel(state);
  if (!label) return null;
  return (
    <Pill label={label} variant={state === 'captain' ? 'strong' : 'soft'} />
  );
}

// A captain's row ends with a crown and "Captain" (DESIGN.md section 6). Used on Team
// detail's members and Player detail's teams.
export function CaptainLabel() {
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

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
