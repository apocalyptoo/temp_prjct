import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import PlayerProfileScreen from '../screens/Player/PlayerProfileScreen';
import PlayerSettingsScreen from '../screens/Player/PlayerSettingsScreen';
import TeamsListScreen from '../screens/Team/TeamsListScreen';
import CreateTeamScreen from '../screens/Team/CreateTeamScreen';
import MyTeamsScreen from '../screens/Team/MyTeamsScreen';
import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import AddMemberScreen from '../screens/Team/AddMemberScreen';
import PlayersListScreen from '../screens/Player/PlayersListScreen';
import InvitesScreen from '../screens/Player/InvitesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Tabs (private to this file) ──
function PlayerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1E3A8A',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 10,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'PlayerProfile') iconName = 'person-circle-outline';
          if (route.name === 'PlayerSettings') iconName = 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Tab.Screen
        name="PlayerSettings"
        component={PlayerSettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ── Stack (exported) ──
export default function PlayerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="PlayerTabs"
        component={PlayerTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Teams" component={TeamsListScreen} options={{ title: 'All Teams' }} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ title: 'Create Team' }} />
      <Stack.Screen name="MyTeams" component={MyTeamsScreen} options={{ title: 'My Teams' }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Team Detail' }} />
      <Stack.Screen name="AddMember" component={AddMemberScreen} options={{ title: 'Add Member' }} />
      <Stack.Screen name="Players" component={PlayersListScreen} options={{ title: 'Players' }} />
      <Stack.Screen name="Invites" component={InvitesScreen} options={{ title: 'Invites' }} />
    </Stack.Navigator>
  );
}