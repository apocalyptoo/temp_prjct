// What a list shows when it's empty (docs/DESIGN.md section 6): one line saying what's
// missing, plus the main action if there is one.
//   <EmptyState message="You're not in a team yet." actionTitle="Create team"
//               actionIcon="add" onAction={…} />
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Button from './Button';
import Text from './Text';

export default function EmptyState({
  message,
  actionTitle,
  actionIcon,
  onAction,
  style,
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={[styles.base, { gap: spacing.lg, padding: spacing.xl }, style]}
    >
      <Text color="textMuted" style={styles.message}>
        {message}
      </Text>
      {actionTitle ? (
        <Button
          title={actionTitle}
          icon={actionIcon}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center' },
  message: { textAlign: 'center' },
  action: { alignSelf: 'center' },
});
