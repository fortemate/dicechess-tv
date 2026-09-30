// The voice catalogue export (#171): what the voice generator in
// fortemate/dicechess-assets reads is exactly the game's catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { VOICE_CATALOGUE } from '../src/core/botVoice.ts';
import { catalogueDocument } from '../scripts/voice-catalogue.ts';

test('the export lists every catalogue line, in order, with its text', () => {
  const document = catalogueDocument('0'.repeat(40), false);
  assert.equal(document.schemaVersion, 1);
  assert.deepEqual(
    document.lines,
    VOICE_CATALOGUE.map(({ id, bot, event, text }) => ({
      id,
      bot,
      event,
      text,
    })),
  );
  assert.deepEqual(document.source, {
    repository: 'fortemate/dicechess-tv',
    commit: '0'.repeat(40),
    path: 'src/core/botVoice.ts',
    dirty: false,
  });
  assert.deepEqual(document.bots, {
    random: { name: 'Rolly', level: 'Easy' },
    greedy: { name: 'Grabby', level: 'Medium' },
    aggressive: { name: 'Rampage', level: 'Hard' },
  });
});

test('the command prints the document for the current commit', () => {
  const printed = JSON.parse(
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/voice-catalogue.ts'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  );
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  assert.equal(printed.source.commit, head);
  assert.equal(printed.lines.length, VOICE_CATALOGUE.length);
});
