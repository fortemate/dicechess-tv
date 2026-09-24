// The repository is English-only. On 2026-09-24 the owner decided that no
// Russian may appear in it; a check cannot tell one Cyrillic language from
// another, and nothing here needs that script, so no Cyrillic at all is allowed.
//
// It exists because the one line that broke the rule was a pair of page titles
// copied from the private knowledge base, which is written in Russian.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Built from code points, so this file does not contain what it looks for.
const CYRILLIC = new RegExp(
  `[${String.fromCodePoint(0x0400)}-${String.fromCodePoint(0x052f)}]`,
);

test('no text file in the repository contains Cyrillic', () => {
  // Tracked files, and new files that are not ignored, so a mistake is caught
  // before it is committed as well as in CI.
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
  const found: string[] = [];
  for (const file of files) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(ROOT, file));
    } catch {
      continue; // tracked but deleted in the working tree
    }
    if (bytes.includes(0)) continue; // binary: images, sounds
    bytes
      .toString('utf8')
      .split('\n')
      .forEach((line, index) => {
        if (CYRILLIC.test(line)) found.push(`${file}:${index + 1}`);
      });
  }
  assert.deepEqual(found, [], 'this repository is English-only');
});
