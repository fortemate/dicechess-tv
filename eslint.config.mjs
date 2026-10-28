// Lint for the shared core and its tests, for the site's code in site/ and for
// the browser test bench in web/. The
// Vega application in native/ is its own npm package with its own
// configuration, which adds React's and Amazon's rules; run
// `npm run lint --prefix native` for it. The build output of the site and the
// bench, and the types Astro generates, are not source.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'native/',
      'site/dist/',
      'site/.astro/',
      'web/dist/',
      'dist/',
      'dist-vega/',
      'android-probe/android/',
      'android-probe/assets/',
      'android-probe/build/',
      'android-probe/.expo/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // The site's configuration and its build checks run in Node.
    files: [
      'test/**',
      'scripts/**',
      'site/*.mjs',
      'site/scripts/**',
      'web/*.ts',
      'web/test/**',
      'android-probe/scripts/**',
      'android-probe/test/**',
      'android-probe/*.cjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['android-probe/*.cjs', 'android-probe/src/**'],
    // Metro requires static require() calls for packaged assets.
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['web/src/**'],
    languageOptions: { globals: globals.browser },
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
