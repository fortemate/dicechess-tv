// The bench's build: native/src/ as it is, on react-native-web, with the Vega
// packages replaced by the stand-ins in src/shims/. One import is swapped by
// importer rather than by name: native/src/Board.tsx draws its squares with
// src/Square.tsx here, which can draw every variant of the marks.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
const shim = (file: string) => resolve(here, 'src/shims', file);
const board = resolve(here, '../native/src/Board.tsx');

const benchSquare = (): Plugin => ({
  name: 'bench-square',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === './Square' && importer && resolve(importer) === board)
      return resolve(here, 'src/Square.tsx');
    return null;
  },
});

export default defineConfig({
  // Served from wherever it is published, e.g. under the project site.
  base: './',
  plugins: [benchSquare(), react()],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: shim('react-native.ts') },
      {
        find: '@amazon-devices/react-native-kepler',
        replacement: shim('kepler.ts'),
      },
      {
        find: '@amazon-devices/react-native-mmkv',
        replacement: shim('mmkv.ts'),
      },
      {
        find: '@amazon-devices/react-native-svg',
        replacement: shim('svg.tsx'),
      },
      {
        find: '@amazon-devices/react-native-w3cmedia',
        replacement: shim('w3cmedia.ts'),
      },
      {
        find: '@amazon-devices/kepler-performance-api',
        replacement: shim('performance.ts'),
      },
    ],
    // native/src/ lives outside this package and has React of its own only on a
    // machine that installed native/, so React always resolves from here. The
    // engine is not in this list: src/core/ imports it from the root install,
    // the one the game itself is checked against, so the bench cannot drift to
    // another version.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // The engine is one module of about 1 MB, and the bench loads nothing else
    // worth splitting from it.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    fs: { allow: [resolve(here, '..')] },
  },
});
