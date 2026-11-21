// Player: bottom tabs My Teams · Explore · Notifications · Profile (docs/PRODUCT.md,
// "App structure and navigation"). Each tab has its own stack, so screens opened from a
// tab keep the tab bar. Old screens keep their own headers until they're restyled.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { IconButton } from '../components/ui';
import ExploreStack from './ExploreStack';
import { tabNavigatorProps } from './tabs';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import AddMemberScreen from '../screens/Team/AddMemberScreen';
import CreateTeamScreen from '../screens/Team/CreateTeamScreen';
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
        name="TeamDetail"
        component={TeamDetailScreen}
        options={{ title: 'Team Detail' }}
      />
      <MyTeamsStack.Screen
        name="AddMember"
        component={AddMemberScreen}
        options={{ title: 'Add Member' }}
      />
      <MyTeamsStack.Screen
        name="CreateTeam"
        component={CreateTeamScreen}
        options={{ title: 'Create Team' }}
      />
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
        component={ExploreStack}
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
