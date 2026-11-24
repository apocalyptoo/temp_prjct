// The Explore tab's stack, shared by players and venue owners: Explore itself (Teams ·
// Players · Venues), Venue detail, and the team screens (teamScreens.js), so a team opens
// Team detail and a player opens Player detail. All of them draw their own header. Venue
// owners get the read-only team screens.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ExploreScreen from '../screens/Shared/ExploreScreen';
import VenueDetailScreen from '../screens/Venue/VenueDetailScreen';

import { teamScreens } from './teamScreens';

const Stack = createNativeStackNavigator();

function ExploreStack({ readOnly }) {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VenueDetail"
        component={VenueDetailScreen}
        options={{ headerShown: false }}
      />
      {teamScreens(Stack, { readOnly })}
    </Stack.Navigator>
  );
}

export const PlayerExploreStack = () => <ExploreStack readOnly={false} />;
export const OwnerExploreStack = () => <ExploreStack readOnly />;
