import React, { useContext, useMemo } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeProvider';

import AuthStack from './AuthStack';
import PlayerNavigator from './PlayerNavigator';
import OwnerNavigator from './OwnerNavigator';
import AdminNavigator from './AdminNavigator';
import {
  StartupLoading,
  ServerUnreachable,
} from '../screens/Auth/StartupScreen';

export default function AppNavigator() {
  const { user, loading, serverUnreachable, retryRestoreSession, logout } =
    useContext(AuthContext);
  const { colors } = useTheme();

  // React Navigation's own colours (screen background, headers, borders), built from
  // our tokens so transitions and headers don't flash white. Fonts stay React
  // Navigation's defaults until the screens are restyled.
  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: colors.accent,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    }),
    [colors],
  );

  // Checking a saved login at start-up: a loading view, not the login screen.
  if (loading) return <StartupLoading />;
  // The check couldn't reach the server. The saved login is kept; Retry checks again,
  // Log out forgets it and shows the login screen.
  if (serverUnreachable) {
    return (
      <ServerUnreachable onRetry={retryRestoreSession} onLogout={logout} />
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {!user ? (
        <AuthStack />
      ) : user.role === 'PLAYER' ? (
        <PlayerNavigator />
      ) : user.role === 'OWNER' ? (
        <OwnerNavigator />
      ) : user.role === 'ADMIN' ? (
        <AdminNavigator />
      ) : null}
    </NavigationContainer>
  );
}
