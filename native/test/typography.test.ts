// The sofa rule (#51, #168): no text on the television is smaller than 20 dp.
// The site states it (site/src/content/docs/design/sofa.md), and 20 dp is what
// the React Native TV guide by Amazon and Callstack recommends, above Amazon's
// own 14 sp. The HUD of #160 once shipped 12 dp captions past every test, so
// every literal font size in the app's source is read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_TEXT_DP = 20;
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

// `fontSize: 12`, `fontSize={12}` and a default `fontSize = 12`.
const SIZE = /fontSize\s*(?::|=)\s*\{?\s*(\d+(?:\.\d+)?)/g;

test('no literal font size in the app is below 20 dp', () => {
  const small: string[] = [];
  let seen = 0;
  for (const file of sources(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(SIZE)) {
      seen++;
      if (Number(match[1]) < MIN_TEXT_DP) {
        const line = text.slice(0, match.index).split('\n').length;
        small.push(
          `${file.slice(SRC.length + 1)}:${line} fontSize ${match[1]}`,
        );
      }
    }
  }
  assert.ok(seen > 20, `expected to read the app's font sizes, saw ${seen}`);
  assert.deepEqual(small, []);
});
