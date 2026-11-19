import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';

import AuthStack from './AuthStack';
import PlayerNavigator from './PlayerNavigator';
import OwnerNavigator from './OwnerNavigator';
import AdminStack from './AdminStack';
import { StartupLoading, ServerUnreachable } from '../screens/Auth/StartupScreen';

export default function AppNavigator() {
  const { user, loading, serverUnreachable, retryRestoreSession, logout } = useContext(AuthContext);

  // Checking a saved login at start-up: a loading view, not the login screen.
  if (loading) return <StartupLoading />;
  // The check couldn't reach the server. The saved login is kept; Retry checks again,
  // Log out forgets it and shows the login screen.
  if (serverUnreachable) {
    return <ServerUnreachable onRetry={retryRestoreSession} onLogout={logout} />;
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : user.role === 'PLAYER' ? (
        <PlayerNavigator />
      ) : user.role === 'OWNER' ? (
        <OwnerNavigator />
      ) : user.role === 'ADMIN' ? (
        <AdminStack />
      ) : null}
    </NavigationContainer>
  );
}