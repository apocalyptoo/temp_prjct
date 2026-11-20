// App.js
import React from 'react';
import { StatusBar } from 'react-native';
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
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
