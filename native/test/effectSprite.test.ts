// The effects joined into one file (#374) are made from the vendored sounds the
// lock pins, and their table says where each clip is.
//
// scripts/sprite-effects.mjs makes the sprite with ffmpeg, which CI does not
// run. So these checks hold the committed sprite to the files it was made from:
// a sound changed in sounds/ without making the sprite again fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUE_FILES } from '../src/cueFiles';
import { EFFECT_CLIPS, EFFECT_SPRITE } from '../src/effectSprite';

// Plain paths: this project's types reject a URL object where a path is expected.
const NATIVE = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (path: string) =>
  JSON.parse(readFileSync(join(NATIVE, path), 'utf8'));
const sha256 = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

type SpriteLock = {
  file: string;
  sha256: string;
  gapSeconds: number;
  sources: Record<string, string>;
};
const lock: SpriteLock = json('sprite/sprite.lock.json');

test('the sprite was made from the files the sounds lock pins', () => {
  const sounds: {
    packs: Record<string, { files: Record<string, { sha256: string }> }>;
  } = json('sounds/sounds.lock.json');
  const pinned: Record<string, string> = {};
  for (const [pack, { files }] of Object.entries(sounds.packs))
    for (const [name, { sha256: digest }] of Object.entries(files))
      if (name.endsWith('.mp3')) pinned[`${pack}/${name}`] = digest;
  assert.deepEqual(lock.sources, pinned);
});

test('the sprite has the bytes its lock records', () => {
  assert.equal(lock.file, EFFECT_SPRITE);
  assert.equal(
    sha256(readFileSync(join(NATIVE, 'sprite', lock.file))),
    lock.sha256,
  );
});

test('every cue file has a clip, and each clip has its silence before and after', () => {
  for (const file of Object.values(CUE_FILES).flat())
    assert.ok(EFFECT_CLIPS[file], file);
  assert.deepEqual(
    Object.keys(EFFECT_CLIPS).sort(),
    Object.keys(lock.sources).sort(),
  );
  const clips = Object.values(EFFECT_CLIPS).sort((a, b) => a.start - b.start);
  let end = 0;
  for (const clip of clips) {
    assert.ok(clip.seconds > 0);
    assert.ok(clip.start - end >= lock.gapSeconds - 1e-3, `${clip.start}`);
    end = clip.start + clip.seconds;
  }
});
