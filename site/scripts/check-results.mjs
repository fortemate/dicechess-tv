// Summarises the answers of the colour-vision check (#108), per answer to the
// colour-vision question and per variant of the mark.
//
//   node scripts/check-results.mjs check.csv codes.txt
//
// It reads the check tab of the answers sheet, downloaded as CSV, and answer
// codes, the page's fallback, one per line; with no file, it reads standard
// input. Marks are counted as the page counts them (src/check/items.ts), with
// the misses on dark squares, where #105 expects them, shown apart.
import { readFileSync } from 'node:fs';
import {
  ITEMS,
  VARIANTS,
  decodeAnswers,
  isLight,
  scoreItem,
} from '../src/check/items.ts';

const inputs = process.argv.slice(2);
const text = inputs.length
  ? inputs.map((file) => readFileSync(file, 'utf8')).join('\n')
  : readFileSync(0, 'utf8');

// RFC 4180 fields: quoted fields may hold commas, quotes and line breaks.
function csvRows(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

// Each visit as { vision, taps }.
function visits(source) {
  const trimmed = source.trim();
  if (trimmed.startsWith('Received,')) {
    const [header, ...rows] = csvRows(trimmed);
    const vision = header.indexOf('Colour vision');
    const details = header.indexOf('Details');
    return rows
      .filter((row) => row.length > details)
      .map((row) => ({
        vision: row[vision],
        taps: JSON.parse(row[details]).taps,
      }));
  }
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((code) => {
      const answers = decodeAnswers(code);
      return { vision: answers.vision, taps: answers.taps };
    });
}

const all = visits(text);
const groups = new Map();
for (const visit of all) {
  const group = groups.get(visit.vision) ?? [];
  group.push(visit);
  groups.set(visit.vision, group);
}

const pad = (value, width) => String(value).padStart(width);
console.log(`${all.length} visit${all.length === 1 ? '' : 's'}\n`);
for (const [vision, group] of [...groups].sort()) {
  console.log(`Colour vision: ${vision} (${group.length})`);
  console.log(
    'variant   found  missed  missed on dark  last-move taps  other taps',
  );
  for (const variant of VARIANTS) {
    const total = { found: 0, missed: 0, dark: 0, lastMove: 0, other: 0 };
    for (const item of ITEMS.filter((each) => each.variant === variant)) {
      for (const visit of group) {
        const taps = visit.taps[item.id];
        if (!taps) continue;
        const counts = scoreItem(item, taps);
        total.found += counts.found;
        total.missed += counts.missed;
        total.lastMove += counts.lastMove;
        total.other += counts.other;
        total.dark += item.movable.filter(
          (cell) =>
            cell !== item.cursor && !isLight(cell) && !taps.includes(cell),
        ).length;
      }
    }
    console.log(
      `${variant.padEnd(7)} ${pad(total.found, 7)} ${pad(total.missed, 7)} ${pad(total.dark, 15)} ${pad(total.lastMove, 15)} ${pad(total.other, 11)}`,
    );
  }
  console.log('');
}
