// App.js
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

// The design is dark only, so the status bar always has light content (white icons)
// on the theme background, whatever the phone's light/dark setting (DESIGN.md
// section 9).
function ThemedStatusBar() {
  const { colors } = useTheme();
  return <StatusBar barStyle="light-content" backgroundColor={colors.bg} />;
}

export default function App() {
  // SafeAreaProvider tells Screen (src/components/ui) how much room the status bar and
  // notches take, so content keeps clear of them.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
