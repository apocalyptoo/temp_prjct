// Provides the theme to the whole app (wrapped around everything in App.js).
// Screens and components read it with useTheme(), so a light/dark switch can be added
// later without touching them. v1.0 has one dark theme and no switching.
import React, { createContext, useContext } from 'react';
import { theme as darkTheme } from './index';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={darkTheme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme() must be used inside ThemeProvider');
  return theme;
}
