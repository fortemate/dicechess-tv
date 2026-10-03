import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APP,
  CREDITS,
  ENGINE,
  PIECES,
  PIECES_AND_FACES,
  PORTRAITS,
  VOICES,
  creditsFor,
} from '../src/core/credits.ts';

const notices = readFileSync(
  new URL('../THIRD_PARTY_NOTICES.md', import.meta.url),
  'utf8',
);

// Every credit the About screen can show, with the portraits or without them.
const SHOWN = [
  ...creditsFor(true),
  ...creditsFor(false),
  ENGINE,
  VOICES,
  PORTRAITS,
];

test('every credit on the screen is also in the notices', () => {
  // The About screen and THIRD_PARTY_NOTICES.md say the same thing to two
  // audiences. If they disagree, one of them is wrong about a licence.
  for (const credit of SHOWN) {
    assert.ok(
      notices.includes(credit.source),
      `${credit.subject}: ${credit.source} is not in THIRD_PARTY_NOTICES.md`,
    );
    assert.ok(
      notices.includes(credit.licence.replace(' ', '-')) ||
        notices.includes(credit.licence),
      `${credit.subject}: ${credit.licence} is not in THIRD_PARTY_NOTICES.md`,
    );
  }
});

test('every credit is complete and readable from a sofa', () => {
  assert.ok(CREDITS.length > 0);
  for (const credit of SHOWN) {
    for (const [field, value] of Object.entries(credit))
      assert.ok(value.trim().length > 0, `${credit.subject}: empty ${field}`);
    // A source is read off a television, not followed, so no scheme.
    assert.doesNotMatch(credit.source, /^https?:\/\//, credit.subject);
    // One line each in half the width of a television screen: the line at
    // 22dp, and the licence and the source at 16dp, each on a line of its own.
    // A longer one wraps, and a link wraps at a hyphen.
    assert.ok(credit.line.length <= 36, `${credit.subject}: line too long`);
    assert.ok(
      credit.licence.length <= 48,
      `${credit.subject}: licence too long`,
    );
    assert.ok(credit.source.length <= 48, `${credit.subject}: source too long`);
  }
  assert.ok(APP.title.length > 0 && APP.maker.length > 0);
});

test('the pieces, and the faces where they show, are credited to their author even though CC0 asks for nothing', () => {
  // A build with the portraits shows no RhosGFX face, and one without them
  // shows the faces in their place (#212).
  assert.deepEqual(creditsFor(true), CREDITS);
  assert.ok(CREDITS.includes(PIECES));
  assert.ok(creditsFor(false).includes(PIECES_AND_FACES));
  assert.ok(!creditsFor(false).includes(PIECES));
  for (const credit of [PIECES, PIECES_AND_FACES])
    assert.match(credit.line, /RhosGFX/);
  assert.doesNotMatch(`${PIECES.subject} ${PIECES.line}`, /face/);
  assert.match(PIECES_AND_FACES.line, /faces/);
  // Four cards fill the About screen's two columns without leaving the
  // television's safe area.
  for (const portraits of [true, false])
    assert.equal(creditsFor(portraits).length, 4);
});

test('the portraits are named as Fortemate’s own and AI-generated, as the voices are', () => {
  assert.match(PORTRAITS.line, /made with Recraft/);
  assert.equal(PORTRAITS.licence, VOICES.licence);
  assert.ok(!CREDITS.includes(PORTRAITS), 'not on a card of other authors');
});

test('the vendored music is credited as its permission asks', () => {
  // The catalogue repeats the pack's credit, worded like a sound pack's as
  // "<who> – <link>": the words are a card's line, and the link, without its
  // scheme, is where its source starts.
  const catalogue = JSON.parse(
    readFileSync(
      new URL('../native/music/music.json', import.meta.url),
      'utf8',
    ),
  ) as { attribution: string };
  const [words, link = ''] = catalogue.attribution.split(' – ');
  const credit = CREDITS.find((candidate) => candidate.line === words);
  assert.ok(credit, `"${words}" is not on the About screen`);
  assert.ok(
    link
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .startsWith(credit.source),
    `${link} is not where ${credit.source} points`,
  );
});

test('every vendored sound pack is credited as its manifest asks', () => {
  // The lock repeats each pack's attribution terms from the asset repository,
  // worded as "<who> – <link>". A pack that requires credit must be credited in
  // exactly its words, and with its link; the others are credited too, as a
  // courtesy their licences invite. The screen shows the words as the line and
  // the link, without its scheme, at the start of the source.
  const lock = JSON.parse(
    readFileSync(
      new URL('../native/sounds/sounds.lock.json', import.meta.url),
      'utf8',
    ),
  ) as {
    packs: Record<
      string,
      { attribution: string; attributionRequired: boolean }
    >;
  };
  for (const [pack, { attribution, attributionRequired }] of Object.entries(
    lock.packs,
  )) {
    const [words, link = ''] = attribution.split(' – ');
    const credit = CREDITS.find((candidate) => candidate.line === words);
    assert.ok(
      credit,
      `${pack}: "${words}" is not on the About screen` +
        (attributionRequired ? ' — and its licence requires it' : ''),
    );
    assert.ok(
      credit.source.startsWith(link.replace(/^https?:\/\//, '')),
      `${pack}: ${link} is not the start of the source ${credit.source}`,
    );
  }
});

// The voice packs vendored from one commit of dicechess-assets: the bots' and
// the Hot Seat host's (#187, #202).
const voicePacks = (
  JSON.parse(
    readFileSync(
      new URL('../native/voices/voices.json', import.meta.url),
      'utf8',
    ),
  ) as {
    packs: Record<
      string,
      { generator: string; license: string; licenseFile: string }
    >;
  }
).packs;

test('the vendored voices are named with their source', () => {
  // Every pack is Fortemate's, made with ElevenLabs and licensed to
  // Fortemate's Dice Chess apps only: the About screen says so beside the
  // engine, once for all of them.
  assert.ok(Object.keys(voicePacks).length > 0);
  for (const [pack, { generator, license }] of Object.entries(voicePacks)) {
    assert.ok(VOICES.line.includes(generator), pack);
    assert.equal(VOICES.licence, license, pack);
  }
});

test('the notices name the licence of every vendored voice pack', () => {
  for (const [pack, { licenseFile }] of Object.entries(voicePacks))
    assert.ok(
      notices.includes(`native/voices/${pack}/${licenseFile}`),
      `THIRD_PARTY_NOTICES.md does not name native/voices/${pack}/${licenseFile}`,
    );
});
