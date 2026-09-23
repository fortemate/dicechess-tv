// Lint for the shared core and its tests. The Vega application in native/ is its
// own npm package with its own configuration, which adds React's and Amazon's
// rules; run `npm run lint --prefix native` for it.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['native/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['test/**'],
    languageOptions: { globals: globals.node },
  },
);
