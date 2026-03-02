import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';

import AuthStack from './AuthStack';
import PlayerNavigator from './PlayerNavigator';
import OwnerNavigator from './OwnerNavigator';
import AdminStack from './AdminStack';

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

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