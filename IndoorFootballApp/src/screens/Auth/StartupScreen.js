// src/screens/Auth/StartupScreen.js
// Shown by AppNavigator while the app checks a saved login at start-up, and when that
// check couldn't reach the server. Deliberately plain: it uses React Native's built-in
// spinner, text and button, with no colours or sizes of its own, until the theme module
// exists (docs/DESIGN.md).
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  StyleSheet,
} from 'react-native';

export function StartupLoading() {
  return (
    <View style={styles.centered} accessibilityLabel="Loading">
      <ActivityIndicator size="large" />
    </View>
  );
}

export function ServerUnreachable({ onRetry, onLogout }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.message}>Can't reach the server</Text>
      <Button title="Retry" onPress={onRetry} />
      {/* A plain text link (built-in styling) so it stays smaller than Retry. */}
      <Text style={styles.link} onPress={onLogout} accessibilityRole="button">
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
