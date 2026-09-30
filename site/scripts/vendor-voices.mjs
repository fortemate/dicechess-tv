// Vendors the voice audition of fortemate/dicechess-assets into the site, at one
// pinned commit, for the testers' page /voices/ (#172).
//
//   node site/scripts/vendor-voices.mjs <path-to-dicechess-assets-checkout> <commit>
//
// Like native/scripts/vendor-sounds.mjs, it reads every file with
// `git show <commit>:<path>`, so the checkout's working tree does not matter, and
// checks each against the digest the asset repository published before writing
// it. It refuses a pack that is not public: the clips go on a public site.
//
// The page shows the candidates as A, B and C, so the voice names stay out of
// what is written here: site/src/voices/audition.json has the bots, their
// candidates' ids and the clips' texts, files, digests and lengths.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM = 'fortemate/dicechess-assets';
const PACK = 'voices/polly-dicechess-bots';
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [checkout, commit] = process.argv.slice(2);
if (!checkout || !/^[0-9a-f]{40}$/.test(commit ?? ''))
  throw new Error(
    'Usage: vendor-voices.mjs <dicechess-assets checkout> <full 40-character commit>',
  );

const show = (path) =>
  execFileSync('git', ['-C', checkout, 'show', `${commit}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
const json = (path) => JSON.parse(show(path).toString('utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const manifest = json(`${PACK}/manifest.json`);
if (manifest.distribution !== 'public' || !manifest.licenseFile)
  throw new Error(
    `${PACK} is ${manifest.distribution} with licence ${manifest.license} at ${commit}: a public page may carry only a public pack`,
  );
const published = json(`${PACK}/checksums.json`);
const catalogue = json(`${PACK}/catalogue.json`);
const audition = json(`${PACK}/audition.json`);

const verified = (path) => {
  const bytes = show(`${PACK}/${path}`);
  if (published[path] !== sha256(bytes))
    throw new Error(
      `${PACK}/${path} does not match the digest ${UPSTREAM} published at ${commit}`,
    );
  return bytes;
};

// The bots in the game's order, as the catalogue lists its lines.
const order = [...new Set(catalogue.lines.map((line) => line.bot))];
const bots = order.map((mode) => ({
  mode,
  name: catalogue.bots[mode].name,
  level: catalogue.bots[mode].level,
  candidates: [],
}));

const target = join(site, 'public/voices');
rmSync(target, { recursive: true, force: true });
const byKey = Object.entries(audition.clips).sort(
  ([a], [b]) => Number(a > b) - Number(a < b),
);
for (const [key, clip] of byKey) {
  const bot = bots.find((each) => each.mode === clip.bot);
  let candidate = bot.candidates.find((each) => each.id === clip.candidate);
  if (!candidate) {
    candidate = { id: clip.candidate, clips: [] };
    bot.candidates.push(candidate);
  }
  const bytes = verified(clip.file);
  if (sha256(bytes) !== clip.sha256)
    throw new Error(`${key} does not match its record in audition.json`);
  const file = clip.file.replace(/^audition\//, '');
  mkdirSync(dirname(join(target, file)), { recursive: true });
  writeFileSync(join(target, file), bytes);
  candidate.clips.push({
    line: clip.line,
    text: clip.text,
    file: `voices/${file}`,
    sha256: clip.sha256,
    seconds: clip.durationSeconds,
  });
}
// The lines in catalogue order within each candidate.
const rank = new Map(catalogue.lines.map((line, i) => [line.id, i]));
for (const bot of bots)
  for (const candidate of bot.candidates)
    candidate.clips.sort((a, b) => rank.get(a.line) - rank.get(b.line));

writeFileSync(join(target, 'LICENSE.txt'), verified(manifest.licenseFile));
mkdirSync(join(site, 'src/voices'), { recursive: true });
writeFileSync(
  join(site, 'src/voices/audition.json'),
  JSON.stringify(
    {
      upstream: UPSTREAM,
      commit,
      pack: PACK,
      license: manifest.license,
      texts: audition.texts,
      bots,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Vendored ${byKey.length} clips of ${PACK} at ${commit} into site/public/voices/.`,
);
