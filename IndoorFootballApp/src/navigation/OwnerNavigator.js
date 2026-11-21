// Venue owner: bottom tabs My Venue · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack. Explore is read-only for
// owners (the team list hides Create Team, and Team detail shows no buttons).
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OwnerExploreStack } from './ExploreStack';
import { tabNavigatorProps } from './tabs';
import OwnerProfileScreen from '../screens/Owner/OwnerProfileScreen';
import OwnerNotificationsScreen from '../screens/Owner/OwnerNotificationsScreen';
import OwnerSettingsScreen from '../screens/Owner/OwnerSettingsScreen';

const Tab = createBottomTabNavigator();
const MyVenueStack = createNativeStackNavigator();
const NotificationsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// The owner profile screen shows the venue listing.
function MyVenueTab() {
  return (
    <MyVenueStack.Navigator>
      <MyVenueStack.Screen
        name="OwnerProfile"
        component={OwnerProfileScreen}
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

// Interim: the Settings screen, until profile editing gives owners a real profile
// (Step 3).
function ProfileTab() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="OwnerSettings"
        component={OwnerSettingsScreen}
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
