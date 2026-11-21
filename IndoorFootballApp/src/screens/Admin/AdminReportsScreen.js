// Interim Reports tab for the admin. Reports and their handling arrive with the
// moderation feature in Step 3 (docs/PRODUCT.md, "Administration and moderation").
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, EmptyState, Screen, ScreenHeader } from '../../components/ui';

export default function AdminReportsScreen() {
  const { spacing } = useTheme();
  return (
    <Screen scroll>
      <View style={{ gap: spacing.listGap, paddingVertical: spacing.xl }}>
        <ScreenHeader title="Reports" />
        <Card>
          <EmptyState message="Reports arrive with moderation." />
        </Card>
      </View>
    </Screen>
  );
}
