module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Jest only translates (with Babel) our own files by default. These packages ship
  // modern JavaScript that Jest can't run as-is, so translate them too. The first two
  // entries are React Native's own defaults.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
