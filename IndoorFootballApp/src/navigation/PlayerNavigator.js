// Player: bottom tabs My Teams · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack, so screens opened from a
// tab keep the tab bar. Old screens keep their own headers until they're restyled.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlayerExploreStack } from './ExploreStack';
import {
  NOTIFICATIONS_TAB,
  refreshBadgeOnTabFocus,
  tabNavigatorProps,
} from './tabs';
import {
  NotificationsProvider,
  useNotifications,
} from '../contexts/NotificationsContext';
import { teamScreens } from './teamScreens';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamFormScreen from '../screens/Team/TeamFormScreen';
import PlayerProfileScreen from '../screens/Player/PlayerProfileScreen';
import EditProfileScreen from '../screens/Player/EditProfileScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';
import DeleteAccountScreen from '../screens/Shared/DeleteAccountScreen';
import NotificationsScreen from '../screens/Shared/NotificationsScreen';

const Tab = createBottomTabNavigator();
const MyTeamsStack = createNativeStackNavigator();
const NotificationsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function MyTeamsTab() {
  return (
    <MyTeamsStack.Navigator>
      <MyTeamsStack.Screen
        name="MyTeams"
        component={MyTeamsScreen}
        options={{ headerShown: false }}
      />
      <MyTeamsStack.Screen
        name="CreateTeam"
        component={TeamFormScreen}
        options={{ headerShown: false }}
      />
      {teamScreens(MyTeamsStack)}
    </MyTeamsStack.Navigator>
  );
}

// The Notifications screen (docs/features/notifications.md, section e). Invites, join
// requests and updates open Team detail and Player detail, so the team screens are
// registered here too.
function NotificationsTab() {
  return (
    <NotificationsStack.Navigator>
      <NotificationsStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
      {teamScreens(NotificationsStack)}
    </NotificationsStack.Navigator>
  );
}

// Profile, Edit profile, Settings, Change password and Delete account each draw their
// own header (the Profile title with its Settings gear, the others a back link).
function ProfileTab() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
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
    </ProfileStack.Navigator>
  );
}

// The badge's number lives in a provider around the tabs, so it starts at login and
// ends at logout (docs/features/notifications.md, P31).
export default function PlayerNavigator() {
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
        name="MyTeamsTab"
        component={MyTeamsTab}
        options={{ title: 'My Teams', tabBarIconName: 'teams' }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={PlayerExploreStack}
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
