// DEVELOPMENT ONLY, TEMPORARY: the "Quick login" row on the Login screen. One tap logs
// in with a test account made by backend/scripts/seedDevAccounts.js (local database
// only). The Login screen requires this file inside a __DEV__ check, so a release build
// drops it before bundling, together with these weak test passwords (the same check as
// the UI gallery). Before release: ROADMAP.md, Phase 5.
import React, { useContext } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Text } from '../../components/ui';
import { useBusyAction } from '../../hooks/useBusyAction';

export const QUICK_LOGINS = [
  { label: 'Player A', email: 'aa', password: 'aa' },
  { label: 'Player B', email: 'ab', password: 'ab' },
  { label: 'Venue owner', email: 'bb', password: 'bb' },
  { label: 'Admin', email: 'ad', password: 'ad' },
];

export default function QuickLogin() {
  const { login } = useContext(AuthContext);
  const { spacing } = useTheme();
  const { run, busy, isBusy } = useBusyAction();

  // On success AppNavigator shows that role's tabs; a refusal (for example the accounts
  // haven't been created yet) says why.
  const quickLogin = account =>
    run(async () => {
      const res = await login(account.email, account.password);
      if (!res.success) {
        Alert.alert(
          'Quick login failed',
          `${
            res.error || 'Login failed'
          }\n\nRun node scripts/seedDevAccounts.js in backend/.`,
        );
      }
    }, account.email);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="meta" color="textMuted" style={styles.center}>
        Quick login (development only)
      </Text>
      <View style={[styles.row, { gap: spacing.xs }]}>
        {QUICK_LOGINS.map(account => (
          <Button
            key={account.email}
            title={account.label}
            variant="secondary"
            accessibilityLabel={`Quick login as ${account.label}`}
            loading={isBusy(account.email)}
            disabled={busy && !isBusy(account.email)}
            onPress={() => quickLogin(account)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
