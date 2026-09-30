// Counts the picks of the voice audition (#172), per bot and candidate.
//
//   node scripts/voice-results.mjs voices.csv
//
// It reads the voices tab of the answers sheet, downloaded as CSV, or standard
// input with no file. Visits are grouped by the asset commit whose audition
// they heard, since the letters mean the voices of that commit's casting
// (voices/polly-dicechess-bots/casting.json in fortemate/dicechess-assets).
import { readFileSync } from 'node:fs';
import { tally } from '../src/voices/results.ts';

const text = readFileSync(process.argv[2] ?? 0, 'utf8');
const NAMES = { random: 'Rolly', greedy: 'Grabby', aggressive: 'Rampage' };
for (const [audition, counts] of Object.entries(tally(text))) {
  console.log(`Audition ${audition}: ${counts.visits} visits`);
  for (const [bot, picks] of Object.entries(counts.picks)) {
    const line = ['a', 'b', 'c']
      .map((id) => `${id.toUpperCase()} ${picks[id] ?? 0}`)
      .join(', ');
    console.log(`  ${NAMES[bot]}: ${line}`);
  }
  for (const comment of counts.comments) console.log(`  - ${comment}`);
}
