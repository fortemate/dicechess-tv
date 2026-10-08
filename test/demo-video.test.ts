// The demo video's storyboard and Thinkle's narration (scripts/demo-video): the
// clips the storyboard names are the ones vendored, each approved line is said
// once, and no two of his lines run into each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  musicSpans,
  recordedSounds,
  unexpectedSilence,
} from '../scripts/demo-video/soundtrack.ts';
import type {
  SceneTiming,
  Soundtrack,
} from '../scripts/demo-video/soundtrack.ts';

const HERE = 'scripts/demo-video';
const NARRATION = join(HERE, 'narration');

type Line = { file: string; seconds: number; text: string; sha256?: string };
type Narration = { line: string; at: number };
const board = JSON.parse(
  readFileSync(join(HERE, 'storyboard-narrated.json'), 'utf8'),
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

// The preliminary cut uses the recorded events' assets with continuous music.
// The narrated storyboard is retained separately so it can be revisited later.
test('the preliminary cut uses cards and game audio, under three minutes', () => {
  const preview = JSON.parse(
    readFileSync(join(HERE, 'storyboard.json'), 'utf8'),
  ) as {
    scenes: {
      name: string;
      card: { kicker: string; title: string; seconds: number };
      clips: { from: number; to: number; hold?: number }[];
      narration?: Narration[];
    }[];
    end: { seconds: number; narration?: Narration[] };
  };
  let duration = preview.end.seconds;
  assert.equal(preview.end.narration?.length ?? 0, 0);
  for (const scene of preview.scenes) {
    assert.ok(scene.card.title.trim(), scene.name);
    assert.ok(scene.card.seconds > 0, scene.name);
    assert.equal(scene.narration?.length ?? 0, 0, scene.name);
    duration += scene.card.seconds;
    for (const clip of scene.clips) {
      assert.ok(clip.from >= 0 && clip.to > clip.from, scene.name);
      duration += clip.to - clip.from + (clip.hold ?? 0);
    }
  }
  assert.ok(duration >= 150 && duration < 180, `${duration} seconds`);
});

test('the preliminary soundtrack carries music across every card', () => {
  const preview = JSON.parse(
    readFileSync(join(HERE, 'storyboard.json'), 'utf8'),
  ) as {
    soundtrack: Soundtrack;
    scenes: {
      name: string;
      card: { seconds: number };
      clips: Omit<SceneTiming['clips'][number], 'start' | 'end'>[];
    }[];
    end: { seconds: number; footer: string };
  };
  assert.equal(preview.scenes[1].name, 'Learn with Thinkle');
  let at = 0;
  const scenes = preview.scenes.map(({ name, card, clips }) => {
    const start = at;
    at += card.seconds;
    return {
      name,
      start,
      clips: clips.map((clip) => {
        const start = at;
        at += clip.to - clip.from;
        return { ...clip, start, end: at };
      }),
    };
  });
  const total = at + preview.end.seconds;
  const spans = musicSpans(preview.soundtrack, scenes, total);
  assert.deepEqual(
    spans.map(({ role }) => role),
    ['menu', 'calm', 'critical'],
  );
  const game = scenes.find(({ name }) => name === 'Two players, one remote');
  assert.equal(spans[1].start, game?.clips[0].start);
  const adaptive = scenes.find(
    ({ name }) => name === 'Music that follows the game',
  );
  assert.ok(adaptive);
  assert.ok(spans[2].start > adaptive.clips[0].start);
  assert.ok(spans[2].start < adaptive.clips[0].end);
  assert.equal(
    spans[2].end,
    total,
    'game music continues through the closing card',
  );
  for (const scene of scenes) {
    const cardEnd = scene.clips[0].start;
    const bed = spans.find(
      ({ start, end }) => start <= scene.start && end >= cardEnd,
    );
    assert.ok(bed, `${scene.name}: uninterrupted music across the card`);
  }
  const assets = new Map(
    Object.entries(app.lines).map(([id, line]) => [
      id,
      { ...line, file: join('native/voices', line.file) },
    ]),
  );
  // No media runtime is needed by CI: effects are checked here for provenance;
  // the assembler probes their real durations before mixing them.
  const sounds = recordedSounds(scenes, assets, (file) => {
    assert.match(file, /^native\/sounds\/[^/]+\/[^/]+\.mp3$/);
    assert.ok(readFileSync(file).length > 0);
    return 0;
  });
  assert.equal(sounds.filter(({ voice }) => voice).length, 11);
  assert.match(preview.end.footer, /JDSherbert/);
});

test('soundtrack rejects misplaced transitions and incomplete speech', () => {
  const scenes: SceneTiming[] = [
    {
      name: 'opening',
      start: 0,
      clips: [{ take: 'example', from: 10, to: 18, start: 4, end: 12 }],
    },
  ];
  const soundtrack: Soundtrack = {
    gainDb: -6,
    crossfadeSeconds: 2,
    fadeInSeconds: 1,
    fadeOutSeconds: 3,
    changes: [{ role: 'menu', scene: 'opening' }],
  };
  const transition = (at: number) =>
    musicSpans(
      {
        ...soundtrack,
        changes: [
          ...soundtrack.changes,
          { role: 'calm', scene: 'opening', clip: 0, at },
        ],
      },
      scenes,
      20,
    );
  assert.equal(
    transition(14)[1].start,
    8,
    'source time is translated to edit time',
  );
  assert.throws(() => transition(18), /outside/);
  assert.throws(
    () =>
      musicSpans(
        { ...soundtrack, changes: [{ role: 'menu', scene: 'missing' }] },
        scenes,
        20,
      ),
    /one scene/,
  );
  const lines = new Map([['line', { file: 'line.mp3', seconds: 3 }]]);
  scenes[0].clips[0].audio = [{ line: 'line', at: 16 }];
  assert.throws(() => recordedSounds(scenes, lines, () => 0), /cuts off/);
  scenes[0].clips[0].audio = [{ line: 'unknown', at: 12 }];
  assert.throws(() => recordedSounds(scenes, lines, () => 0), /no voice asset/);
});

test('the export rejects a lost music bed after its first track ends', () => {
  const log = `
    silence_start: 0
    silence_end: 0.6 | silence_duration: 0.6
    silence_start: 44.539
    silence_end: 53.148 | silence_duration: 8.609
    silence_start: 161.5
    silence_end: 162.555 | silence_duration: 1.055
  `;
  assert.deepEqual(unexpectedSilence(log, 162.555, 1, 3), [
    { start: 44.539, end: 53.148 },
  ]);
  assert.deepEqual(unexpectedSilence('silence_start: 60', 162.555, 1, 3), [
    { start: 60, end: 162.555 },
  ]);
  assert.deepEqual(
    unexpectedSilence('silence_start: 161.5', 162.555, 1, 3),
    [],
  );
});
