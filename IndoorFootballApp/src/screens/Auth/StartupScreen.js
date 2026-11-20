// src/screens/Auth/StartupScreen.js
// Shown by AppNavigator while the app checks a saved login at start-up, and when that
// check couldn't reach the server. They render outside NavigationContainer, straight on
// the Android window (which is dark), so they paint the theme background and text
// colours themselves. Still deliberately plain: the built-in spinner and the native
// Retry button, until the shared components exist (docs/ROADMAP.md, Step 2).
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function StartupLoading() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.centered, { backgroundColor: colors.bg }]}
      accessibilityLabel="Loading"
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function ServerUnreachable({ onRetry, onLogout }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: colors.bg }]}>
      <Text style={[styles.message, { color: colors.text }]}>
        Can't reach the server
      </Text>
      <Button title="Retry" onPress={onRetry} />
      {/* A plain text link so it stays smaller than Retry. */}
      <Text
        style={[styles.link, { color: colors.text }]}
        onPress={onLogout}
        accessibilityRole="button"
      >
        Log out
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center' },
  link: { textAlign: 'center', textDecorationLine: 'underline' },
});
