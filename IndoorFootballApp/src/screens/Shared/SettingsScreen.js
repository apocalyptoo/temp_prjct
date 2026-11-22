// Settings (docs/features/profiles-and-registration.md, section e, P29): one screen for
// players and venue owners. The rows that exist in v1.0 so far: Edit profile (for venue
// owners Edit venue, Q3), Change password, Terms of Use and Privacy Policy (each opens
// its page in the browser), then Log out with a confirmation. Later features add Blocked
// players, Contact support and Delete account. Registered in each role's Profile stack.
import React, { useContext, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  ConfirmDialog,
  Icon,
  ListRow,
  Screen,
  ScreenHeader,
} from '../../components/ui';
import { openLegalPage } from '../Auth/signUpCommon';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const { colors, spacing } = useTheme();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const rows = [
    user?.role === 'OWNER'
      ? {
          icon: 'edit',
          name: 'Edit venue',
          // Its back link then reads "Settings", and Back returns here.
          onPress: () => navigation.navigate('EditVenue', { from: 'Settings' }),
        }
      : {
          icon: 'edit',
          name: 'Edit profile',
          onPress: () => navigation.navigate('EditProfile'),
        },
    {
      icon: 'password',
      name: 'Change password',
      onPress: () => navigation.navigate('ChangePassword'),
    },
    {
      icon: 'terms',
      name: 'Terms of Use',
      onPress: () => openLegalPage('terms'),
    },
    {
      icon: 'privacy',
      name: 'Privacy Policy',
      onPress: () => openLegalPage('privacy'),
    },
  ];

  return (
    <Screen
      scroll
      style={{ gap: spacing.detailGap, paddingBottom: spacing.xxxl }}
    >
      <ScreenHeader
        back={{ label: 'Profile', onPress: navigation.goBack }}
        title="Settings"
      />
      <Card>
        {rows.map((row, index) => (
          <ListRow
            key={row.name}
            icon={row.icon}
            name={row.name}
            onPress={row.onPress}
            trailing={<Icon name="forward" color={colors.textMuted} />}
            last={index === rows.length - 1}
          />
        ))}
      </Card>
      <Button
        title="Log out"
        variant="danger"
        icon="logout"
        onPress={() => setConfirmingLogout(true)}
        fullWidth
      />
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
