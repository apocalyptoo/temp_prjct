import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AdminDashboard from '../screens/Admin/AdminDashboard';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import ManageTeamsScreen from '../screens/Admin/ManageTeamsScreen';

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
      <Stack.Screen name="ManageTeams" component={ManageTeamsScreen} />
    </Stack.Navigator>
  );
}