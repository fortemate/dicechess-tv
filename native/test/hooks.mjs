// Node module hooks for the native tests: redirect the packages that need a
// React Native runtime to local stubs, and compile TypeScript and JSX on the fly.
// Loaded with `node --import ./test/hooks.mjs`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { format } from 'node:util';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { transformSync } from 'esbuild';

// Every test renders inside act(): React 19 commits there, and create() outside
// it leaves the tree unmounted.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// An update outside act() is one the test did not wait for: a timer or a
// promise that fired on its own, which a device would have drawn and the test
// never looked at. React only warns, and a warning in the log is read by
// nobody, so it fails the test instead. The other message is react-test-renderer
// announcing on every create() that it is deprecated; there is nothing to act on.
const report = console.error;
console.error = (...args) => {
  const [message] = args;
  if (typeof message === 'string') {
    if (message.startsWith('react-test-renderer is deprecated')) return;
    if (message.includes('not wrapped in act('))
      throw new Error(format(...args));
  }
  report(...args);
};

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
  '@amazon-devices/kepler-performance-api': new URL(
    './stubs/kepler-performance-api.mjs',
    import.meta.url,
  ).href,
};

// Inlines the source map, which lets coverage (`npm run coverage`) report lines
// of the TypeScript source rather than of esbuild's output.
//
// A module's top-level range spans the whole output, and Node maps it back from
// the output's first and last positions. esbuild maps those to the first and
// the last statement it emits; in a .tsx module the first is the jsx-runtime
// import, which it maps to the first JSX element. Every line outside them,
// comments, imports, types and constants alike, came out as never run (#216).
// So the output gains an empty first and last line, mapped to the start and
// the end of the source: the top-level range then covers the whole file, as it
// does when Node runs TypeScript without a source map (`coverage:core`).
const withSourceMap = (code, map, source) => {
  const sourceMap = JSON.parse(map);
  // Split as Node's coverage splits a file. The end is past the last character,
  // or the range would stop short of the end of the last line.
  const lines = source.split(/(?<=\n)/);
  const last = lines.length - 1;
  const end = lines[last].replace(/\r?\n$/, '').length;
  // One entry for each line of esbuild's output, which ends with a line break.
  const mappings = decode(sourceMap.mappings);
  while (mappings.length < code.split('\n').length - 1) mappings.push([]);
  // A segment is [output column, source, line, column], counted from 0.
  sourceMap.mappings = encode([
    [[0, 0, 0, 0]],
    ...mappings,
    [[0, 0, last, end]],
  ]);
  const inline = Buffer.from(JSON.stringify(sourceMap)).toString('base64');
  return `\n${code}\n//# sourceMappingURL=data:application/json;base64,${inline}\n`;
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
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const { code, map } = transformSync(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      jsx: 'automatic',
      format: 'esm',
      target: 'es2022',
      sourcefile: url,
      sourcemap: 'external',
    });
    return {
      format: 'module',
      source: withSourceMap(code, map, source),
      shortCircuit: true,
    };
  },
});
