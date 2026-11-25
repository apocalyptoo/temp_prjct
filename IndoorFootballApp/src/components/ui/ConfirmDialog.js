// A confirmation dialog (docs/DESIGN.md section 6) for destructive or important
// actions. The title says exactly what will happen ("Leave Dhanmondi Strikers?").
//   <ConfirmDialog visible={open} title="Delete this team?" destructive
//                  confirmTitle="Delete team" loading={deleting}
//                  onConfirm={deleteTeam} onCancel={() => setOpen(false)} />
// Android's back button and tapping outside count as Cancel, but not while loading.
// children: optional, shown between the message and the buttons (for example what will
// happen to each team). That part scrolls when the dialog doesn't fit the screen, so the
// buttons always stay in reach.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from './Button';
import Text from './Text';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  const { colors, sizes, spacing, radius, shadows } = useTheme();

  // The Modal covers the whole screen: a tall dialog stops at the status bar and the
  // navigation bar.
  const insets = useSafeAreaInsets();

  const cancel = () => {
    if (loading) return;
    onCancel?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <View
        style={[
          styles.centre,
          {
            backgroundColor: colors.scrim,
            paddingHorizontal: spacing.screenPadding,
            paddingTop: Math.max(insets.top, spacing.screenPadding),
            paddingBottom: Math.max(insets.bottom, spacing.screenPadding),
          },
        ]}
      >
        {/* Tapping the dimmed area outside the dialog cancels. The Cancel button does
            the same for screen readers, so this area is hidden from them. */}
        <Pressable
          onPress={cancel}
          accessible={false}
          importantForAccessibility="no"
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            shadows.floating,
            {
              maxWidth: sizes.dialogMaxWidth,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: sizes.border,
              borderRadius: radius.card,
              padding: spacing.cardPadding,
              gap: spacing.md,
            },
          ]}
        >
          <Text variant="cardTitle" accessibilityRole="header">
            {title}
          </Text>
          {message ? <Text color="textMuted">{message}</Text> : null}
          {children ? (
            <ScrollView style={styles.scroll}>{children}</ScrollView>
          ) : null}
          <View
            style={[styles.buttons, { gap: spacing.md, marginTop: spacing.xs }]}
          >
            <Button
              title={cancelTitle}
              variant="secondary"
              onPress={cancel}
              disabled={loading}
              style={styles.button}
            />
            <Button
              title={confirmTitle}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Never taller than the screen: it shrinks, and inside it only the scrolling part does.
  dialog: { width: '100%', flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { flexGrow: 1, flexBasis: 0 },
});
