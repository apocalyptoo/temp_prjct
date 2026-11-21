// The Explore tab's stack, shared by players and venue owners: the interim Explore
// screen and the three lists it opens. The lists keep their old headers until restyled.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExploreScreen from '../screens/Shared/ExploreScreen';
import TeamsListScreen from '../screens/Team/TeamsListScreen';
import PlayersListScreen from '../screens/Player/PlayersListScreen';
import IndoorsListScreen from '../screens/Owner/IndoorsListScreen';

const Stack = createNativeStackNavigator();

export default function ExploreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Teams"
        component={TeamsListScreen}
        options={{ title: 'All Teams' }}
      />
      <Stack.Screen
        name="Players"
        component={PlayersListScreen}
        options={{ title: 'Players' }}
      />
      <Stack.Screen
        name="Indoors"
        component={IndoorsListScreen}
        options={{ title: 'Registered Indoors' }}
      />
    </Stack.Navigator>
  );
}
