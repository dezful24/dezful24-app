const expoConfig = require('eslint-config-expo/flat');
module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', 'scripts/verify-offline/*'] },
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
];
