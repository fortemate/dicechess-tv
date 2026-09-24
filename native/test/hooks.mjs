// Node module hooks for the native tests: redirect the packages that need a
// React Native runtime to local stubs, and compile TypeScript and JSX on the fly.
// Loaded with `node --import ./test/hooks.mjs`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { transformSync } from 'esbuild';

const STUBS = {
  'react-native': new URL('./stubs/react-native.mjs', import.meta.url).href,
  '@amazon-devices/react-native-svg': new URL(
    './stubs/react-native-svg.mjs',
    import.meta.url,
  ).href,
  '@amazon-devices/react-native-kepler': new URL(
    './stubs/react-native-kepler.mjs',
    import.meta.url,
  ).href,
  '@amazon-devices/react-native-mmkv': new URL(
    './stubs/react-native-mmkv.mjs',
    import.meta.url,
  ).href,
  '@amazon-devices/react-native-w3cmedia': new URL(
    './stubs/react-native-w3cmedia.mjs',
    import.meta.url,
  ).href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) return { url: stub, format: 'module', shortCircuit: true };
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      // Metro fills in extensions and index files; Node's ESM resolver does
      // not, so do it here rather than writing imports the bundler would
      // never see.
      if (!specifier.startsWith('.')) throw error;
      for (const suffix of ['.tsx', '.ts', '/index.ts', '/index.tsx']) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next candidate
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (!/\.tsx?($|\?)/.test(url)) return nextLoad(url, context);
    const { code } = transformSync(readFileSync(fileURLToPath(url), 'utf8'), {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      jsx: 'automatic',
      format: 'esm',
      target: 'es2022',
      sourcefile: url,
      // Lets coverage (`npm run coverage`) report lines of the TypeScript
      // source rather than of esbuild's output.
      sourcemap: 'inline',
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
