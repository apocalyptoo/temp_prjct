// Admin: bottom tabs Dashboard · Reports · Venues · Users · Teams (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack, like the other roles.
// The Users and Teams management screens keep their old headers until they're
// restyled; the Dashboard and the Venues tab are rebuilt (docs/features/venues.md, P22).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { tabNavigatorProps } from './tabs';
import AdminDashboard from '../screens/Admin/AdminDashboard';
import AdminReportsScreen from '../screens/Admin/AdminReportsScreen';
import AdminVenuesScreen from '../screens/Admin/AdminVenuesScreen';
import AdminVenueScreen from '../screens/Admin/AdminVenueScreen';
import ManageUsersScreen from '../screens/Admin/ManageUsersScreen';
import ManageTeamsScreen from '../screens/Admin/ManageTeamsScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createNativeStackNavigator();
const ReportsStack = createNativeStackNavigator();
const VenuesStack = createNativeStackNavigator();
const UsersStack = createNativeStackNavigator();
const TeamsStack = createNativeStackNavigator();

function DashboardTab() {
  return (
    <DashboardStack.Navigator>
      <DashboardStack.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ headerShown: false }}
      />
    </DashboardStack.Navigator>
  );
}

// Interim: an empty state until moderation brings reports (Step 3).
function ReportsTab() {
  return (
    <ReportsStack.Navigator>
      <ReportsStack.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{ headerShown: false }}
      />
    </ReportsStack.Navigator>
  );
}

function VenuesTab() {
  return (
    <VenuesStack.Navigator>
      <VenuesStack.Screen
        name="AdminVenues"
        component={AdminVenuesScreen}
        options={{ headerShown: false }}
      />
      <VenuesStack.Screen
        name="AdminVenue"
        component={AdminVenueScreen}
        options={{ headerShown: false }}
      />
    </VenuesStack.Navigator>
  );
}

function UsersTab() {
  return (
    <UsersStack.Navigator>
      <UsersStack.Screen
        name="ManageUsers"
        component={ManageUsersScreen}
        options={{ title: 'Manage Users' }}
      />
    </UsersStack.Navigator>
  );
}

function TeamsTab() {
  return (
    <TeamsStack.Navigator>
      <TeamsStack.Screen
        name="ManageTeams"
        component={ManageTeamsScreen}
        options={{ title: 'Manage Teams' }}
      />
    </TeamsStack.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Tab.Navigator {...tabNavigatorProps}>
      <Tab.Screen
        name="DashboardTab"
        component={DashboardTab}
        options={{ title: 'Dashboard', tabBarIconName: 'dashboard' }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsTab}
        options={{ title: 'Reports', tabBarIconName: 'reports' }}
      />
      <Tab.Screen
        name="VenuesTab"
        component={VenuesTab}
        options={{ title: 'Venues', tabBarIconName: 'venues' }}
      />
      <Tab.Screen
        name="UsersTab"
        component={UsersTab}
        options={{ title: 'Users', tabBarIconName: 'users' }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={TeamsTab}
        options={{ title: 'Teams', tabBarIconName: 'teams' }}
      />
    </Tab.Navigator>
  );
}
