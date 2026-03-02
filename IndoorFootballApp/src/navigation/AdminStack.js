

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AdminDashboard from '../screens/Admin/AdminDashboard';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import ManageTeamsScreen from '../screens/Admin/ManageTeamsScreen';
import ManageIndoorsScreen from '../screens/Admin/ManageIndoorsScreen';

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageUsers"
        component={ManageUsersScreen}
        options={{ title: 'Manage Users' }}
      />
      <Stack.Screen
        name="ManageTeams"
        component={ManageTeamsScreen}
        options={{ title: 'Manage Teams' }}
      />
      <Stack.Screen
        name="ManageIndoors"
        component={ManageIndoorsScreen}
        options={{ title: 'Manage Indoors' }}
      />
    </Stack.Navigator>
  );
}