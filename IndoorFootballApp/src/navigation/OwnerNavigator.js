import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import OwnerProfileScreen from '../screens/Owner/OwnerProfileScreen';
import OwnerSettingsScreen from '../screens/Owner/OwnerSettingsScreen';
import IndoorsListScreen from '../screens/Owner/IndoorsListScreen';
import TeamsListScreen from '../screens/Team/TeamsListScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Tabs (private to this file) ──
function OwnerTabs() {
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
          if (route.name === 'OwnerProfile') iconName = 'person-circle-outline';
          if (route.name === 'OwnerSettings') iconName = 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="OwnerProfile"
        component={OwnerProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Tab.Screen
        name="OwnerSettings"
        component={OwnerSettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ── Stack (exported) ──
export default function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="OwnerTabs"
        component={OwnerTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllTeams"
        component={TeamsListScreen}
        options={{ title: 'All Teams' }}
      />
      <Stack.Screen
        name="Indoors"
        component={IndoorsListScreen}
        options={{ title: 'Registered Indoors' }}
      />
    </Stack.Navigator>
  );
}