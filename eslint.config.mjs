// Lint for the shared core and its tests, and for the site's code in site/. The
// Vega application in native/ is its own npm package with its own
// configuration, which adds React's and Amazon's rules; run
// `npm run lint --prefix native` for it. The site's build output and the types
// Astro generates are not source.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['native/', 'site/dist/', 'site/.astro/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // The site's configuration and its build checks run in Node.
    files: ['test/**', 'scripts/**', 'site/*.mjs', 'site/scripts/**'],
    languageOptions: { globals: globals.node },
  },
  {
    // The answers sheet's Apps Script (site/answers-sheet/README.md). Google
    // runs it as a classic script, provides these services as globals, and
    // calls doGet and doPost by name.
    files: ['site/answers-sheet/**'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ContentService: 'readonly',
        LockService: 'readonly',
        SpreadsheetApp: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^do(Get|Post)$' },
      ],
    },
  },
);
