module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Jest only translates (with Babel) our own files by default. These packages ship
  // modern JavaScript that Jest can't run as-is, so translate them too. The first two
  // entries are React Native's own defaults.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
  // Lucide icons are imported one file at a time (src/components/ui/Icon.js). For the
  // app, Lucide hands out modern .mjs files, which Jest can't run; point Jest at
  // Lucide's own CommonJS copy of the same icon instead.
  moduleNameMapper: {
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};
