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
    // One line each at television size.
    assert.ok(credit.line.length <= 60, `${credit.subject}: line too long`);
    assert.ok(
      `${credit.licence} · ${credit.source}`.length <= 70,
      `${credit.subject}: licence and source too long`,
    );
  }
  assert.ok(APP.title.length > 0 && APP.maker.length > 0);
});

test('the pieces are credited to their author even though CC0 asks for nothing', () => {
  const pieces = CREDITS.find((credit) => credit.subject === 'Chess pieces');
  assert.ok(pieces, 'the pieces must be credited');
  assert.match(pieces.line, /RhosGFX/);
});

test('every vendored sound pack is credited as its manifest asks', () => {
  // The lock repeats each pack's attribution terms from the asset repository.
  // A pack that requires credit must be credited in exactly its wording; the
  // others are credited too, as a courtesy their licences invite.
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
  const lines = new Set(CREDITS.map((credit) => credit.line));
  for (const [pack, { attribution, attributionRequired }] of Object.entries(
    lock.packs,
  )) {
    assert.ok(
      lines.has(attribution),
      `${pack}: "${attribution}" is not on the About screen` +
        (attributionRequired ? ' — and its licence requires it' : ''),
    );
  }
});
