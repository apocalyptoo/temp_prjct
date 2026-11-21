// The team screens, registered as one group in every stack that can open a team
// (docs/features/team-membership.md, section e, "Navigation"): the player's My Teams
// stack and Explore stack, and the venue owner's Explore stack. A screen can only
// navigate inside its own stack, so each of those stacks needs its own copy.
//   <Stack.Navigator>…{teamScreens(Stack)}</Stack.Navigator>
// readOnly (venue owners): Team detail only, since owners can't join or run teams.
import React from 'react';

import TeamDetailScreen from '../screens/Team/TeamDetailScreen';
import RequestToJoinScreen from '../screens/Team/RequestToJoinScreen';
import TransferCaptaincyScreen from '../screens/Team/TransferCaptaincyScreen';
import AddMemberScreen from '../screens/Team/AddMemberScreen';

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
          {/* Interim "Invite players" until the new screen (feature 1, task F1.3). */}
          <Stack.Screen
            name="AddMember"
            component={AddMemberScreen}
            options={{ title: 'Add Member' }}
          />
        </>
      )}
    </Stack.Group>
  );
}
