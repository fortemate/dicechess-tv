// The sofa rule (#51, #168): no text on the television is smaller than 20 dp.
// The site states it (site/src/content/docs/design/sofa.md), and 20 dp is what
// the React Native TV guide by Amazon and Callstack recommends, above Amazon's
// own 14 sp. The HUD of #160 once shipped 12 dp captions past every test, so
// every font size in the app's source is read here: a number, a named constant
// of the same file, or a prop's default. Anything else, such as a size worked
// out at run time, fails too, since this test could not vouch for it.
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

// `fontSize: 12`, `fontSize: SMALL`, `fontSize={12}`, a default
// `fontSize = 12`, and the type `fontSize?: number`, which is skipped. A
// shorthand `{ fontSize }` passes a prop on: its default and its callers are
// read where they are written.
const SIZE = /fontSize\s*(\?)?\s*(?::|=)\s*\{?\s*([^,;}\n]+)/g;
const NUMBER = /^\d+(?:\.\d+)?$/;
const NAME = /^[A-Za-z_$][\w$]*$/;

// The number a font size stands for, or why it cannot be read.
const sizeOf = (value: string, text: string): number | string => {
  if (NUMBER.test(value)) return Number(value);
  if (NAME.test(value)) {
    const constant = new RegExp(
      `const\\s+${value}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*[;\\n]`,
    ).exec(text);
    return constant
      ? Number(constant[1])
      : `${value} is not a number constant of this file`;
  }
  return `${value} is not a number or a named constant`;
};

test('no font size in the app is below 20 dp', () => {
  const problems: string[] = [];
  let seen = 0;
  for (const file of sources(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(SIZE)) {
      const value = match[2].trim();
      if (match[1] || value === 'number') continue;
      seen++;
      const size = sizeOf(value, text);
      if (typeof size === 'number' && size >= MIN_TEXT_DP) continue;
      const line = text.slice(0, match.index).split('\n').length;
      const where = `${file.slice(SRC.length + 1)}:${line}`;
      problems.push(
        typeof size === 'number'
          ? `${where} fontSize ${size}`
          : `${where} ${size}`,
      );
    }
  }
  assert.ok(seen > 20, `expected to read the app's font sizes, saw ${seen}`);
  assert.deepEqual(problems, []);
});

test('the reader catches a small size behind a constant or a sum', () => {
  const text = 'const SMALL = 12;\nconst big = { fontSize: 24 };\n';
  assert.equal(sizeOf('SMALL', text), 12);
  assert.equal(sizeOf('24', text), 24);
  assert.match(String(sizeOf('LARGE', text)), /not a number constant/);
  assert.match(String(sizeOf('size * 0.5', text)), /not a number or a named/);
});
