import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP, CREDITS } from '../src/core/credits.ts';

const notices = readFileSync(
  new URL('../THIRD_PARTY_NOTICES.md', import.meta.url),
  'utf8',
);

test('every credit on the screen is also in the notices', () => {
  // The About screen and THIRD_PARTY_NOTICES.md say the same thing to two
  // audiences. If they disagree, one of them is wrong about a licence.
  for (const credit of CREDITS) {
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
  for (const credit of CREDITS) {
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

test('the pieces and the faces are credited to their author even though CC0 asks for nothing', () => {
  const rhosgfx = CREDITS.find(
    (credit) => credit.subject === 'Pieces and opponent faces',
  );
  assert.ok(rhosgfx, 'the pieces and the faces must be credited');
  assert.match(rhosgfx.line, /RhosGFX/);
  // Four cards fill the About screen's two columns without leaving the
  // television's safe area.
  assert.equal(CREDITS.length, 4);
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
