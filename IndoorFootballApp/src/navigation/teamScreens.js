// The team screens, registered as one group in every stack that can open a team
// (docs/features/team-membership.md, section e, "Navigation"): the player's My Teams,
// Explore and Notifications stacks, and the venue owner's Explore stack. A screen can
// only navigate inside its own stack, so each of those stacks needs its own copy.
// Player detail is part of the group (docs/features/explore.md, P30): Team detail and
// Player detail open each other with navigation.push.
//   <Stack.Navigator>…{teamScreens(Stack)}</Stack.Navigator>
// readOnly (venue owners): Team detail and Player detail only, since owners can't join
// or run teams.
import React from 'react';

import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import RequestToJoinScreen from '../screens/Team/RequestToJoinScreen';
import TransferCaptaincyScreen from '../screens/Team/TransferCaptaincyScreen';
import TeamFormScreen from '../screens/Team/TeamFormScreen';
import InvitePlayersScreen from '../screens/Team/InvitePlayersScreen';
import PlayerDetailScreen from '../screens/Player/PlayerDetailScreen';

// The new screens draw their own back link, so the stack header is hidden for them.
const OWN_HEADER = { headerShown: false };

export function teamScreens(Stack, { readOnly = false } = {}) {
  return (
    <Stack.Group key="team-screens">
      <Stack.Screen
        name="TeamDetail"
        component={TeamDetailScreen}
        options={OWN_HEADER}
      />
      <Stack.Screen
        name="PlayerDetail"
        component={PlayerDetailScreen}
        options={OWN_HEADER}
      />
      {readOnly ? null : (
        <>
          <Stack.Screen
            name="RequestToJoin"
            component={RequestToJoinScreen}
            options={OWN_HEADER}
          />
          <Stack.Screen
            name="TransferCaptaincy"
            component={TransferCaptaincyScreen}
            options={OWN_HEADER}
          />
          {/* The team form in edit mode (CreateTeam, the same screen, is in the
              My Teams stack). */}
          <Stack.Screen
            name="EditTeam"
            component={TeamFormScreen}
            options={OWN_HEADER}
          />
          <Stack.Screen
            name="InvitePlayers"
            component={InvitePlayersScreen}
            options={OWN_HEADER}
          />
        </>
      )}
    </Stack.Group>
  );
}
