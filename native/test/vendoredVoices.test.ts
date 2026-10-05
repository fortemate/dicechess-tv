// The vendored voices are what their catalogue says, and say what the game says
// (#159, #187, #202, #258, #264).
//
// scripts/vendor-voices.mjs writes voices/voices.json: the pinned commit of
// dicechess-assets, the digest of events.json, each pack's permission and files,
// and for every line of the game, a bot's, the Hot Seat host's or the tutor's, its clip, the
// clip's digest and the text it was recorded from. These checks make a
// hand-edited file, a stray one, a regenerated table that drifted from the
// catalogue, pacing that drifted from events.json, or a line changed in the game
// but not re-recorded fail here rather than ship.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_CATALOGUE } from '../../src/core/botVoice';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';
import { TUTOR_CATALOGUE } from '../../src/core/tutorial';
import { HOST_EVENTS, HOST_PACING } from '../../src/core/hostPacing';
import { VOICE_FILES } from '../src/voiceFiles';

const VOICES = join(dirname(fileURLToPath(import.meta.url)), '..', 'voices');
const read = (path: string) => readFileSync(join(VOICES, path));
const sha256 = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

const BOTS = 'elevenlabs-dicechess-bots';
const HOST = 'elevenlabs-dicechess-host';
const PROWLA = 'elevenlabs-dicechess-host-prowla';
const TUTOR = 'elevenlabs-dicechess-tutorial-thinkle';
// Each host's lines are in her own pack.
const HOST_PACK = { rolly: HOST, prowla: PROWLA } as const;

type Pack = {
  title: string;
  license: string;
  licenseFile: string;
  distribution: string;
  clients: string[] | null;
  generator: string | null;
  files: Record<string, string>;
};

type Catalogue = {
  upstream: string;
  commit: string;
  events: { file: string; sha256: string };
  packs: Record<string, Pack>;
  lines: Record<
    string,
    {
      pack: string;
      bot: string;
      event: string;
      text: string;
      file: string;
      sha256: string;
      seconds: number;
    }
  >;
};

const catalogue = JSON.parse(read('voices.json').toString('utf8')) as Catalogue;

test('the catalogue pins one full commit of the asset repository', () => {
  assert.equal(catalogue.upstream, 'fortemate/dicechess-assets');
  assert.match(catalogue.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(catalogue.packs).sort(), [
    BOTS,
    HOST,
    PROWLA,
    TUTOR,
  ]);
});

test('this repository may carry every pack, and its licence travels with it', () => {
  for (const [name, pack] of Object.entries(catalogue.packs)) {
    const allowed =
      pack.distribution === 'public' ||
      (pack.distribution === 'project' &&
        Array.isArray(pack.clients) &&
        pack.clients.includes('fortemate/dicechess-tv'));
    assert.ok(allowed, `${name}: ${pack.distribution}`);
    assert.ok(pack.files[pack.licenseFile], `${name}: licence not vendored`);
    // About and THIRD_PARTY_NOTICES.md name the source of the voices.
    assert.equal(pack.generator, 'ElevenLabs', name);
  }
});

test('every vendored file has the bytes the catalogue pinned, and nothing else is there', () => {
  assert.deepEqual(readdirSync(VOICES).sort(), [
    BOTS,
    HOST,
    PROWLA,
    TUTOR,
    'events.json',
    'voices.json',
  ]);
  for (const [name, pack] of Object.entries(catalogue.packs)) {
    for (const [file, digest] of Object.entries(pack.files))
      assert.equal(sha256(read(`${name}/${file}`)), digest, `${name}/${file}`);
    assert.deepEqual(
      readdirSync(join(VOICES, name)).sort(),
      Object.keys(pack.files).sort(),
      name,
    );
  }
  for (const [id, { pack, file, sha256: digest }] of Object.entries(
    catalogue.lines,
  )) {
    assert.equal(file, `${pack}/${id}.mp3`);
    assert.equal(catalogue.packs[pack].files[`${id}.mp3`], digest, id);
  }
  assert.equal(catalogue.events.file, 'events.json');
  assert.equal(sha256(read('events.json')), catalogue.events.sha256);
});

test('every line of the game has a clip recorded from its own text, in its own pack', () => {
  const said = [
    ...VOICE_CATALOGUE.map((line) => ({ ...line, pack: BOTS })),
    ...HOST_CATALOGUE.map((line) => ({ ...line, pack: HOST_PACK[line.host] })),
    ...TUTOR_CATALOGUE.map((line) => ({ ...line, bot: 'tutor', pack: TUTOR })),
  ];
  for (const line of said) {
    const clip = catalogue.lines[line.id];
    assert.ok(clip, `${line.id} has no clip: vendor a pack recorded from it`);
    assert.equal(
      clip.text,
      line.text,
      `${line.id} was recorded from another text: record it again`,
    );
    assert.equal(clip.bot, line.bot, line.id);
    assert.equal(clip.event, line.event, line.id);
    assert.equal(clip.pack, line.pack, line.id);
  }
  // A clip for a line the game no longer has would never play.
  assert.deepEqual(
    Object.keys(catalogue.lines).sort(),
    said.map((line) => line.id).sort(),
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

test("the host's pacing is the one events.json sets", () => {
  const events = JSON.parse(read('events.json').toString('utf8')) as {
    pacing: { host: Record<string, number> };
    events: { host: Record<string, { tier: string; priority: number }> };
  };
  assert.deepEqual({ ...HOST_PACING }, events.pacing.host);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(HOST_EVENTS).map(([event, { tier, priority }]) => [
        event,
        { tier, priority },
      ]),
    ),
    Object.fromEntries(
      Object.entries(events.events.host).map(([event, { tier, priority }]) => [
        event,
        { tier, priority },
      ]),
    ),
  );
  // In the same order, which the generated union keeps.
  assert.deepEqual(Object.keys(HOST_EVENTS), Object.keys(events.events.host));
});

test("the tutor's lines are said in order: each point's clips number from 1", () => {
  // useTutorialVoice says an event's lines one after another, by their ids.
  const byEvent = new Map<string, string[]>();
  for (const line of TUTOR_CATALOGUE)
    byEvent.set(line.event, [...(byEvent.get(line.event) ?? []), line.id]);
  for (const [event, ids] of byEvent)
    assert.deepEqual(
      ids,
      ids.map((_, i) => `thinkle_tutor_${event}_${i + 1}`),
      event,
    );
  assert.equal(TUTOR_CATALOGUE.length, 48);
});
