import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transformSync } from '@babel/core';
import { buildSync } from 'esbuild';

const native = fileURLToPath(new NodeURL('..', import.meta.url));
const repository = join(native, '..');
const artwork = ['pieces', 'faces'].flatMap((directory) =>
  readdirSync(join(native, 'src', directory))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => join('src', directory, file)),
);

const compile = (source: string, filename: string) => {
  const output = transformSync(source, {
    cwd: native,
    filename: join(native, filename),
    configFile: join(native, 'babel.config.js'),
    babelrc: false,
    comments: false,
    compact: true,
  });
  assert.ok(output?.code);
  return output.code;
};

test('all shared artwork imports the standard SVG module without a Vega backend', () => {
  assert.equal(artwork.length, 15);
  const bundle = buildSync({
    absWorkingDir: native,
    entryPoints: ['src/pieces/index.ts', 'src/faces/index.ts'],
    outdir: 'build/svg-contract',
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    platform: 'neutral',
    format: 'esm',
  });
  const imports = new Set(
    Object.values(bundle.metafile.outputs).flatMap((output) =>
      output.imports.map((entry) => entry.path),
    ),
  );
  assert.deepEqual([...imports].sort(), [
    'react',
    'react-native-svg',
    'react/jsx-runtime',
  ]);
  for (const filename of artwork) {
    assert.ok(Object.hasOwn(bundle.metafile.inputs, filename));
  }
});

test('the Vega Babel configuration maps every artwork import to the installed SVG backend', () => {
  for (const filename of artwork) {
    const output = compile(
      readFileSync(join(native, filename), 'utf8'),
      filename,
    );
    assert.match(
      output,
      /require\(["']@amazon-devices\/react-native-svg["']\)/,
      filename,
    );
    assert.doesNotMatch(
      output,
      /require\(["']react-native-svg["']\)/,
      filename,
    );
  }
});

test('regenerating pieces and faces reproduces their compiled geometry and module imports', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'dicechess-svg-'));
  try {
    mkdirSync(join(fixture, 'native/scripts'), { recursive: true });
    for (const script of [
      'generate-pieces.mjs',
      'generate-faces.mjs',
      'rhosgfx-svg.mjs',
    ]) {
      cpSync(
        join(native, 'scripts', script),
        join(fixture, 'native/scripts', script),
      );
    }
    for (const kind of ['pieces', 'faces']) {
      cpSync(
        join(repository, 'src/assets', kind, 'rhosgfx'),
        join(fixture, 'src/assets', kind, 'rhosgfx'),
        { recursive: true },
      );
      mkdirSync(join(fixture, 'native/src', kind), { recursive: true });
      execFileSync(
        process.execPath,
        [join(fixture, 'native/scripts', `generate-${kind}.mjs`)],
        { stdio: 'pipe' },
      );
    }
    for (const filename of [
      ...artwork,
      'src/pieces/index.ts',
      'src/faces/index.ts',
    ]) {
      const generated = readFileSync(join(fixture, 'native', filename), 'utf8');
      assert.doesNotMatch(generated, /@amazon-devices/);
      assert.equal(
        compile(generated, filename),
        compile(readFileSync(join(native, filename), 'utf8'), filename),
        filename,
      );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
