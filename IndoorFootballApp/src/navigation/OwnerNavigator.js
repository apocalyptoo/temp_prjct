// Venue owner: bottom tabs My Venue · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack. Explore is read-only for
// owners (the team list hides Create Team, and Team detail shows no buttons).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OwnerExploreStack } from './ExploreStack';
import {
  NOTIFICATIONS_TAB,
  refreshBadgeOnTabFocus,
  tabNavigatorProps,
} from './tabs';
import {
  NotificationsProvider,
  useNotifications,
} from '../contexts/NotificationsContext';
import MyVenueScreen from '../screens/Owner/MyVenueScreen';
import EditVenueScreen from '../screens/Owner/EditVenueScreen';
import OwnerProfileScreen from '../screens/Owner/OwnerProfileScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';
import DeleteAccountScreen from '../screens/Shared/DeleteAccountScreen';
import NotificationsScreen from '../screens/Shared/NotificationsScreen';

const Tab = createBottomTabNavigator();
const MyVenueStack = createNativeStackNavigator();
const NotificationsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// My Venue shows the listing; Edit venue edits it. Both draw their own header.
function MyVenueTab() {
  return (
    <MyVenueStack.Navigator>
      <MyVenueStack.Screen
        name="MyVenue"
        component={MyVenueScreen}
        options={{ headerShown: false }}
      />
      <MyVenueStack.Screen
        name="EditVenue"
        component={EditVenueScreen}
        options={{ headerShown: false }}
      />
    </MyVenueStack.Navigator>
  );
}

// The Notifications screen (docs/features/notifications.md, section e). An owner only
// gets venue updates, which open My Venue in its own tab, so no team screens here.
function NotificationsTab() {
  return (
    <NotificationsStack.Navigator>
      <NotificationsStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </NotificationsStack.Navigator>
  );
}

// Profile (the account, with the Settings gear), Settings, Change password, Delete
// account, and Edit venue again, so Settings → Edit venue goes back to Settings. Each
// draws its own header.
function ProfileTab() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="OwnerProfile"
        component={OwnerProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditVenue"
        component={EditVenueScreen}
        options={{ headerShown: false }}
      />
    </ProfileStack.Navigator>
  );
}

// The badge's number lives in a provider around the tabs, so it starts at login and
// ends at logout (docs/features/notifications.md, P31).
export default function OwnerNavigator() {
  return (
    <NotificationsProvider>
      <Tabs />
    </NotificationsProvider>
  );
}

function Tabs() {
  const { count, refresh } = useNotifications();
  return (
    <Tab.Navigator
      {...tabNavigatorProps}
      screenListeners={refreshBadgeOnTabFocus(refresh)}
    >
      <Tab.Screen
        name="MyVenueTab"
        component={MyVenueTab}
        options={{ title: 'My Venue', tabBarIconName: 'venue' }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={OwnerExploreStack}
        options={{ title: 'Explore', tabBarIconName: 'explore' }}
      />
      <Tab.Screen
        name={NOTIFICATIONS_TAB}
        component={NotificationsTab}
        options={{
          title: 'Notifications',
          tabBarIconName: 'notifications',
          tabBarBadge: count,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTab}
        options={{ title: 'Profile', tabBarIconName: 'profile' }}
      />
    </Tab.Navigator>
  );
}
