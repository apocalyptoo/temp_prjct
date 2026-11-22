// Venue owner: bottom tabs My Venue · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack. Explore is read-only for
// owners (the team list hides Create Team, and Team detail shows no buttons).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OwnerExploreStack } from './ExploreStack';
import { tabNavigatorProps } from './tabs';
import MyVenueScreen from '../screens/Owner/MyVenueScreen';
import EditVenueScreen from '../screens/Owner/EditVenueScreen';
import OwnerNotificationsScreen from '../screens/Owner/OwnerNotificationsScreen';
import OwnerProfileScreen from '../screens/Owner/OwnerProfileScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';

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

// Interim: an empty state until the real Notifications screen (Step 3).
function NotificationsTab() {
  return (
    <NotificationsStack.Navigator>
      <NotificationsStack.Screen
        name="OwnerNotifications"
        component={OwnerNotificationsScreen}
        options={{ headerShown: false }}
      />
    </NotificationsStack.Navigator>
  );
}

// Profile (the account, with the Settings gear), Settings, Change password, and Edit
// venue again, so Settings → Edit venue goes back to Settings. Each draws its own header.
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
        name="EditVenue"
        component={EditVenueScreen}
        options={{ headerShown: false }}
      />
    </ProfileStack.Navigator>
  );
}

export default function OwnerNavigator() {
  return (
    <Tab.Navigator {...tabNavigatorProps}>
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
        name="NotificationsTab"
        component={NotificationsTab}
        options={{ title: 'Notifications', tabBarIconName: 'notifications' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTab}
        options={{ title: 'Profile', tabBarIconName: 'profile' }}
      />
    </Tab.Navigator>
  );
}
