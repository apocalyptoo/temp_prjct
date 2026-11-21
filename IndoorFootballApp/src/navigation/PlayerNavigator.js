// Player: bottom tabs My Teams · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack, so screens opened from a
// tab keep the tab bar. Old screens keep their own headers until they're restyled.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { IconButton } from '../components/ui';
import { PlayerExploreStack } from './ExploreStack';
import { tabNavigatorProps } from './tabs';
import { teamScreens } from './teamScreens';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamFormScreen from '../screens/Team/TeamFormScreen';
import InvitesScreen from '../screens/Player/InvitesScreen';
import PlayerProfileScreen from '../screens/Player/PlayerProfileScreen';
import PlayerSettingsScreen from '../screens/Player/PlayerSettingsScreen';

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
        options={{ title: 'My Teams' }}
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

// Interim: the existing Invites screen, until the real Notifications screen (Step 3).
function NotificationsTab() {
  return (
    <NotificationsStack.Navigator>
      <NotificationsStack.Screen
        name="Invites"
        component={InvitesScreen}
        options={{ title: 'Invites' }}
      />
    </NotificationsStack.Navigator>
  );
}

// The Profile header: a gear that opens Settings. The options get the screen's own
// navigation (a header can't rely on useNavigation for that).
const profileScreenOptions = ({ navigation }) => ({
  title: 'Profile',
  headerRight: () => (
    <IconButton
      icon="settings"
      accessibilityLabel="Settings"
      onPress={() => navigation.navigate('PlayerSettings')}
    />
  ),
});

function ProfileTab() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={profileScreenOptions}
      />
      <ProfileStack.Screen
        name="PlayerSettings"
        component={PlayerSettingsScreen}
        options={{ title: 'Settings' }}
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
