// Player: bottom tabs My Teams · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack, so screens opened from a
// tab keep the tab bar. Old screens keep their own headers until they're restyled.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PlayerExploreStack } from './ExploreStack';
import { tabNavigatorProps } from './tabs';
import { teamScreens } from './teamScreens';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamFormScreen from '../screens/Team/TeamFormScreen';
import InvitesScreen from '../screens/Player/InvitesScreen';
import PlayerProfileScreen from '../screens/Player/PlayerProfileScreen';
import EditProfileScreen from '../screens/Player/EditProfileScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';
import DeleteAccountScreen from '../screens/Shared/DeleteAccountScreen';

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

// Interim: the Invites screen, until the real Notifications screen (feature 5). An invite
// opens Team detail, so the team screens are registered here too.
function NotificationsTab() {
  return (
    <NotificationsStack.Navigator>
      <NotificationsStack.Screen
        name="Invites"
        component={InvitesScreen}
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

export default function PlayerNavigator() {
  return (
    <Tab.Navigator {...tabNavigatorProps}>
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
