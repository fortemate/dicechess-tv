// The picks of the voice audition (#172), counted from the voices tab of the
// answers sheet (site/answers-sheet/Code.js), downloaded as CSV.
import { csvRows } from '../csv.ts';

export const HEADER = [
  'Received',
  'Rolly',
  'Grabby',
  'Rampage',
  'Comment',
  'Audition',
  'Submission',
];
const BOTS = ['random', 'greedy', 'aggressive'] as const;
export type Bot = (typeof BOTS)[number];

// What the visits to one audition, named by its asset commit, picked.
export type Tally = {
  visits: number;
  picks: Record<Bot, Record<string, number>>;
  comments: string[];
};

export function tally(text: string): Record<string, Tally> {
  const [header, ...rows] = csvRows(text.trim()).filter((row) =>
    row.some((field) => field !== ''),
  );
  if (header?.join(',') !== HEADER.join(','))
    throw new Error(`Not the voices tab: ${header?.join(', ')}`);
  const seen = new Set<string>();
  const byAudition: Record<string, Tally> = {};
  for (const [, rolly, grabby, rampage, comment, audition, id] of rows) {
    // The sheet stores a visit once, but a tab copied together from two
    // downloads may hold it twice.
    if (seen.has(id)) continue;
    seen.add(id);
    byAudition[audition] ??= {
      visits: 0,
      picks: { random: {}, greedy: {}, aggressive: {} },
      comments: [],
    };
    const counts = byAudition[audition];
    counts.visits++;
    [rolly, grabby, rampage].forEach((pick, i) => {
      if (!pick) return;
      const bot = counts.picks[BOTS[i]];
      bot[pick] = (bot[pick] ?? 0) + 1;
    });
    if (comment) counts.comments.push(comment);
  }
  return byAudition;
}
