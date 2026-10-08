// The bench's build: native/src/ as it is, on react-native-web, with the Vega
// packages replaced by the stand-ins in src/shims/. The native board's squares
// are swapped for the design variants. The bench's wrapper can add the earlier
// arrow without putting that experiment back in the native application.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
const shim = (file: string) => resolve(here, 'src/shims', file);
const board = resolve(here, '../native/src/Board.tsx');

// What native/src/Board.tsx imports, and the bench's stand-in for each.
export const SWAPPED: Record<string, string> = {
  './Square': 'src/Square.tsx',
};

const benchSquare = (): Plugin => ({
  name: 'bench-square',
  enforce: 'pre',
  resolveId(source, importer) {
    if (
      source === './Board' &&
      importer &&
      dirname(importer) === dirname(board)
    )
      return resolve(here, 'src/Board.tsx');
    if (source in SWAPPED && importer && resolve(importer) === board)
      return resolve(here, SWAPPED[source]);
    return null;
  },
});

export default defineConfig({
  // Served from wherever it is published, e.g. under the project site.
  base: './',
  // React Native has a `global` object and browsers do not. react-native-web's
  // Animated still calls global.cancelAnimationFrame when an animation is
  // stopped before it ends, as native/src/Board.tsx does with a slide the next
  // move interrupts, and without this the bench went black on the bot's turn.
  define: { global: 'globalThis' },
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
    // The bench, and the gallery of the marks compared for #121.
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        gallery: resolve(here, 'gallery.html'),
      },
    },
  },
  server: {
    fs: { allow: [resolve(here, '..')] },
  },
});
