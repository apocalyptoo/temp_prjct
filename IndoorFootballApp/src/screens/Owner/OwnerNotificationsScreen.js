// Interim Notifications tab for venue owners. The real Notifications screen ("Needs
// your action" and "Updates", with the badge) is a Step 3 feature (docs/PRODUCT.md,
// "Notifications").
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, EmptyState, Screen, ScreenHeader } from '../../components/ui';

export default function OwnerNotificationsScreen() {
  const { spacing } = useTheme();
  return (
    <Screen scroll>
      <View style={{ gap: spacing.listGap, paddingVertical: spacing.xl }}>
        <ScreenHeader title="Notifications" />
        <Card>
          <EmptyState message="No notifications yet." />
        </Card>
      </View>
    </Screen>
  );
}
