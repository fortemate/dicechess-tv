// The vendored voices are what their catalogue says, and say what the game says
// (#159, #187).
//
// scripts/vendor-voices.mjs writes voices/voices.json: the pinned commit of
// dicechess-assets, the pack's permission, and for every line of the game its
// clip, the clip's digest and the text it was recorded from. These checks make a
// hand-edited file, a stray one, a regenerated table that drifted from the
// catalogue, or a line changed in the game but not re-recorded fail here rather
// than ship.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOGUE } from '../../src/core/botVoice';
import { VOICE_FILES } from '../src/voiceFiles';

const VOICES = join(dirname(fileURLToPath(import.meta.url)), '..', 'voices');
const read = (path: string) => readFileSync(join(VOICES, path));

type Catalogue = {
  upstream: string;
  commit: string;
  pack: string;
  license: string;
  licenseFile: string;
  distribution: string;
  clients: string[] | null;
  generator: string | null;
  lines: Record<
    string,
    {
      bot: string;
      event: string;
      text: string;
      file: string;
      sha256: string;
      seconds: number;
    }
  >;
  files: Record<string, string>;
};

const catalogue = JSON.parse(read('voices.json').toString('utf8')) as Catalogue;

test('the catalogue pins one full commit of the asset repository', () => {
  assert.equal(catalogue.upstream, 'fortemate/dicechess-assets');
  assert.match(catalogue.commit, /^[0-9a-f]{40}$/);
});

test('this repository may carry the pack, and its licence travels with it', () => {
  const allowed =
    catalogue.distribution === 'public' ||
    (catalogue.distribution === 'project' &&
      Array.isArray(catalogue.clients) &&
      catalogue.clients.includes('fortemate/dicechess-tv'));
  assert.ok(allowed, `${catalogue.pack}: ${catalogue.distribution}`);
  assert.ok(catalogue.files[catalogue.licenseFile], 'licence not vendored');
  // About and THIRD_PARTY_NOTICES.md name the source of the voices.
  assert.equal(catalogue.generator, 'ElevenLabs');
});

test('every vendored file has the bytes the catalogue pinned, and nothing else is there', () => {
  for (const [name, sha256] of Object.entries(catalogue.files)) {
    const digest = createHash('sha256')
      .update(read(`${catalogue.pack}/${name}`))
      .digest('hex');
    assert.equal(digest, sha256, name);
  }
  assert.deepEqual(
    readdirSync(join(VOICES, catalogue.pack)).sort(),
    Object.keys(catalogue.files).sort(),
  );
  for (const [id, { file, sha256 }] of Object.entries(catalogue.lines)) {
    assert.equal(file, `${catalogue.pack}/${id}.mp3`);
    assert.equal(catalogue.files[`${id}.mp3`], sha256, id);
  }
});

test('every line of the game has a clip recorded from its own text', () => {
  for (const line of VOICE_CATALOGUE) {
    const clip = catalogue.lines[line.id];
    assert.ok(clip, `${line.id} has no clip: vendor a pack recorded from it`);
    assert.equal(
      clip.text,
      line.text,
      `${line.id} was recorded from another text: record it again`,
    );
    assert.equal(clip.bot, line.bot, line.id);
    assert.equal(clip.event, line.event, line.id);
  }
  // A clip for a line the game no longer has would never play.
  assert.deepEqual(
    Object.keys(catalogue.lines).sort(),
    VOICE_CATALOGUE.map((line) => line.id).sort(),
  );
});

test('the clip table the app reads is the one the catalogue records', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(VOICE_FILES).map(([id, clip]) => [id, { ...clip }]),
    ),
    Object.fromEntries(
      Object.entries(catalogue.lines).map(([id, { file, seconds, text }]) => [
        id,
        { file, seconds, text },
      ]),
    ),
  );
  for (const { file, seconds } of Object.values(VOICE_FILES)) {
    assert.match(file, /\.mp3$/, 'Vega cannot play Ogg Vorbis');
    assert.ok(seconds > 0 && seconds < 10, `${file} lasts ${seconds} s`);
  }
});
