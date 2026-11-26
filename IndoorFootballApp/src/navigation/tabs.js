// Settings shared by the three role navigators (Player, Owner, Admin): our TabBar,
// and no tab-level header (each tab has its own stack, which shows headers).
// backBehavior "firstRoute": Android back on the first screen of another tab goes to
// the first tab; from the first tab's first screen it leaves the app.
import React from 'react';
import { TabBar } from '../components/ui';

export const renderTabBar = props => <TabBar {...props} />;

export const tabNavigatorProps = {
  tabBar: renderTabBar,
  backBehavior: 'firstRoute',
  screenOptions: { headerShown: false },
};

// The player's and venue owner's navigators: a tab coming into view refreshes the
// Notifications badge (docs/features/notifications.md, D4), including the first tab when
// the app opens or someone logs in. Not the Notifications tab itself: its screen loads
// everything, the number included.
//   <Tab.Navigator screenListeners={refreshBadgeOnTabFocus(refresh)}>
export const NOTIFICATIONS_TAB = 'NotificationsTab';
export const refreshBadgeOnTabFocus =
  refresh =>
  ({ route }) => ({
    focus: () => {
      if (route.name !== NOTIFICATIONS_TAB) refresh();
    },
  });
