// The friction log is cited from outside by entry number: the submission's
// product-feedback answers link to #fl-01, #fl-02 and so on. This runs after
// the build and fails it if the built page loses one of those anchors, if the
// numbering stops running from FL-01 without a gap, or if the summary table
// stops linking to an entry.
import { readFileSync } from 'node:fs';

const CITED = 21; // FL-01 to FL-21 were cited before the log was published.

const page = readFileSync(
  new URL('../dist/friction-log/index.html', import.meta.url),
  'utf8',
);
const anchors = [...page.matchAll(/<h3\b[^>]*\bid="(fl-\d{2})"/g)].map(
  ([, id]) => id,
);
const expected = anchors.map((_, i) => `fl-${String(i + 1).padStart(2, '0')}`);
// The table between the Summary and Entries headings. The table of contents
// links to every entry too, so the whole page would not tell the two apart.
const start = page.indexOf('id="summary"');
const end = page.indexOf('id="entries"');
const summary = start >= 0 && end > start ? page.slice(start, end) : '';

const problems = [];
if (anchors.length < CITED) {
  problems.push(`${anchors.length} entries, fewer than the ${CITED} cited`);
}
if (anchors.join() !== expected.join()) {
  problems.push(`entries out of sequence: ${anchors.join(' ')}`);
}
if (!summary) problems.push('no Summary section before the Entries');
for (const id of anchors) {
  if (summary && !summary.includes(`href="#${id}"`)) {
    problems.push(`the summary does not link to #${id}`);
  }
}

if (problems.length > 0) {
  console.error(`friction log: ${problems.join('; ')}`);
  process.exit(1);
}
console.log(
  `friction log: ${anchors.length} entries, #fl-01 to #${anchors.at(-1)}, all in the summary`,
);
