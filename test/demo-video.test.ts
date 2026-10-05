// The demo video's storyboard and Thinkle's narration (scripts/demo-video): the
// clips the storyboard names are the ones vendored, each approved line is said
// once, and no two of his lines run into each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HERE = 'scripts/demo-video';
const NARRATION = join(HERE, 'narration');

type Line = { file: string; seconds: number; text: string; sha256?: string };
type Narration = { line: string; at: number };
const board = JSON.parse(
  readFileSync(join(HERE, 'storyboard.json'), 'utf8'),
) as {
  end: {
    title: string;
    tagline?: string;
    link: string;
    footer: string;
    seconds: number;
    narration?: Narration[];
  };
  scenes: { name: string; narration?: Narration[] }[];
};
const narration = JSON.parse(
  readFileSync(join(NARRATION, 'narration.json'), 'utf8'),
) as {
  commit: string;
  pack: string;
  licenseFile: string;
  files: Record<string, string>;
  lines: Record<string, Line>;
};
const app = JSON.parse(readFileSync('native/voices/voices.json', 'utf8')) as {
  lines: Record<string, Line>;
};
const lineOf = (id: string): Line | undefined =>
  narration.lines[id] ?? app.lines[id];

const placements = [
  ...board.scenes.map((scene) => ({
    where: scene.name,
    lines: scene.narration ?? [],
  })),
  { where: 'end', lines: board.end.narration ?? [] },
];
const placed = placements.flatMap(({ lines }) => lines.map(({ line }) => line));

test('the narration is vendored as the asset repository published it', () => {
  assert.match(narration.commit, /^[0-9a-f]{40}$/);
  assert.equal(narration.pack, 'elevenlabs-dicechess-demo-thinkle');
  const sha256 = (name: string) =>
    createHash('sha256')
      .update(readFileSync(join(NARRATION, name)))
      .digest('hex');
  for (const [name, digest] of Object.entries(narration.files))
    assert.equal(sha256(name), digest, name);
  for (const [id, { file, sha256: digest }] of Object.entries(narration.lines))
    assert.equal(narration.files[file], digest, id);
  // Its licence travels with it, and nothing else is there.
  assert.ok(narration.files[narration.licenseFile]);
  assert.deepEqual(
    readdirSync(NARRATION).sort(),
    [...Object.keys(narration.files), 'narration.json'].sort(),
  );
  const manifest = JSON.parse(
    readFileSync(join(NARRATION, 'manifest.json'), 'utf8'),
  ) as { distribution: string; clients: string[] };
  assert.equal(manifest.distribution, 'project');
  assert.ok(manifest.clients.includes('fortemate/dicechess-tv'));
});

test('every line the storyboard places has a clip', () => {
  for (const id of placed) assert.ok(lineOf(id), `${id} has no clip`);
});

test('each of his approved narration lines is said once', () => {
  // The owner approved the narration as a whole (2026-10-05).
  assert.deepEqual(
    placed.filter((id) => narration.lines[id]).sort(),
    Object.keys(narration.lines).sort(),
  );
  assert.equal(new Set(placed).size, placed.length);
});

test('no two of his lines run into each other', () => {
  // In the order they are said, which the storyboard need not list them in.
  for (const { where, lines } of placements) {
    const said = [...lines].sort((a, b) => a.at - b.at);
    said.forEach(({ line, at }, index) => {
      assert.ok(at >= 0, `${where}: ${line} starts before its scene`);
      const next = said[index + 1];
      if (!next) return;
      const end = at + (lineOf(line)?.seconds ?? 0);
      assert.ok(
        end + 0.3 <= next.at,
        `${where}: ${line} runs into ${next.line}`,
      );
    });
  }
});

test('every scene names its chapter, and the end card makes no promise', () => {
  for (const scene of board.scenes) assert.ok(scene.name.trim());
  // Plans may change, so the card says nothing of price, ads or accounts
  // (owner, 2026-10-05).
  const card = [board.end.title, board.end.tagline ?? '', board.end.footer];
  for (const text of card)
    assert.doesNotMatch(text, /\b(free|ads?|accounts?)\b/i, text);
  const last = board.end.narration?.at(-1);
  assert.ok(last, 'the end card has his sign-off');
  assert.ok(
    last.at + (lineOf(last.line)?.seconds ?? 0) <= board.end.seconds,
    'his sign-off ends before the end card does',
  );
});
