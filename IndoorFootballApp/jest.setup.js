/* eslint-env jest */
// Runs before every Jest test file (see setupFiles in jest.config.js).
//
// Jest runs the app's JavaScript in Node, without a phone, so native modules don't
// exist there. Swap them for the in-memory mocks their packages ship for this purpose.

// AsyncStorage (where the login token is saved). Without this: "AsyncStorage is null".
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe areas (how much room the status bar and notches take). The library's own mock
// gives fixed sizes, so SafeAreaProvider and Screen render without a phone.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
