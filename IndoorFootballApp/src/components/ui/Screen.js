// The standard screen container (docs/DESIGN.md section 6): the theme background,
// screenPadding on the sides, and room kept for the status bar and notches.
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

// scroll: the content scrolls (long screens, forms).
// keyboardAware: form fields stay above the keyboard. Android already resizes the app
//   for the keyboard (adjustResize in AndroidManifest.xml), so this matters for iOS.
// edges: which sides keep clear of the status bar and notches. Default the top only,
//   because a header or the bottom tab bar covers the others.
// scrollRef: with scroll, a ref to the ScrollView, so a form can scroll to a field
//   (for example the first one with a problem).
// style: layout only (for example paddingTop), never colours or fonts.
export default function Screen({
  children,
  scroll = false,
  keyboardAware = false,
  edges = ['top'],
  scrollRef,
  style,
}) {
  const { colors, spacing } = useTheme();
  const sides = { paddingHorizontal: spacing.screenPadding };

  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={[styles.grow, sides, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, sides, style]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.fill, { backgroundColor: colors.bg }]}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
});
