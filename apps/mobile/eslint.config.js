// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*'],
  },
  {
    rules: {
      // React Compiler rule. The app loads data / resets sheets in effects in many places;
      // that works (the compiler just skips those components). Kept visible as a warning
      // so it can be cleaned up screen by screen instead of in one risky sweep.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
