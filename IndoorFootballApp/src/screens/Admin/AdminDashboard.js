// The admin Dashboard (docs/features/venues.md, section e, D3, P22): a tappable card
// "Venues waiting for review" with the count (a red badge while it's above zero), which
// opens the Venues tab; the totals as 2 × 2 number tiles (users, players, venue owners,
// teams); and Log out, with a confirmation. Loads GET /admin/stats whenever it comes
// into view (the count changes after each review), and on pull to refresh.
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import api from '../../api/api';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Icon,
  Screen,
  ScreenHeader,
  Text,
} from '../../components/ui';
import { TeamLoadState } from '../Team/teamCommon';

export const WAITING_LABEL = 'Venues waiting for review';

// The totals, two tiles per row: [stats field, label].
const TILE_ROWS = [
  [
    ['userCount', 'Users'],
    ['playerCount', 'Players'],
  ],
  [
    ['ownerCount', 'Venue owners'],
    ['teamCount', 'Teams'],
  ],
];

export default function AdminDashboard({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const { colors, spacing } = useTheme();
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // A failed reload keeps what's shown; only a failed first load shows the error.
  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
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

  const retry = () => {
    setStatus('loading');
    load();
  };

  const waiting = stats?.pendingVenueCount ?? 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.listGap,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeader greeting={user?.email} title="Dashboard" />

        {status !== 'ready' ? (
          <TeamLoadState
            status={status}
            onRetry={retry}
            errorMessage="Couldn't load the dashboard."
          />
        ) : (
          <>
            <Card
              onPress={() =>
                navigation.navigate('VenuesTab', { screen: 'AdminVenues' })
              }
              accessibilityLabel={`${WAITING_LABEL}: ${waiting}`}
            >
              <View style={[styles.row, { gap: spacing.md }]}>
                <Icon name="venues" color={colors.textMuted} />
                <Text variant="bodyStrong" style={styles.grow}>
                  {WAITING_LABEL}
                </Text>
                {waiting > 0 ? (
                  <Badge count={waiting} />
                ) : (
                  <Text variant="bodyStrong" color="textMuted">
                    0
                  </Text>
                )}
                <Icon name="forward" color={colors.textMuted} />
              </View>
            </Card>

            <View style={{ gap: spacing.md }}>
              {TILE_ROWS.map(row => (
                <View
                  key={row[0][0]}
                  style={[styles.row, styles.stretch, { gap: spacing.md }]}
                >
                  {row.map(([field, label]) => (
                    <StatTile key={field} value={stats[field]} label={label} />
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        <Button
          title="Log out"
          icon="logout"
          variant="danger"
          onPress={() => setConfirmingLogout(true)}
          fullWidth
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirmingLogout}
        title="Log out?"
        message="You'll need your email and password to log in again."
        confirmTitle="Log out"
        destructive
        onConfirm={() => {
          setConfirmingLogout(false);
          logout(); // AppNavigator then shows the Login screen.
        }}
        onCancel={() => setConfirmingLogout(false)}
      />
    </Screen>
  );
}

// One total: the number large, its label under it. Read as "12 Users".
function StatTile({ value, label }) {
  const { spacing } = useTheme();
  const shown = value ?? 0;
  return (
    <Card style={[styles.grow, { gap: spacing.xxs }]}>
      <View accessible accessibilityLabel={`${shown} ${label}`}>
        <Text variant="stat">{shown}</Text>
        <Text variant="meta" color="textMuted">
          {label}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stretch: { alignItems: 'stretch' },
  grow: { flex: 1 },
});
