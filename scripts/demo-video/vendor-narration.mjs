// Vendors Thinkle's narration of the demo video from fortemate/dicechess-assets,
// at one pinned commit, into scripts/demo-video/narration/. assemble.ts lays the
// lines under the footage where the storyboard says.
//
//   node scripts/demo-video/vendor-narration.mjs <dicechess-assets checkout> <commit>
//
// Like native/scripts/vendor-voices.mjs, every file is read with
// `git show <commit>:<path>` and checked against the digest the asset repository
// published. The pack is for Fortemate's Dice Chess apps and the videos that
// present them (dicechess-assets#27): a project permission that must name this
// repository. Its licence travels beside the clips.
//
// The lines are not the app's: they are heard in the video only, so they stay out
// of native/voices/, whose test allows no clip the game never says.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = 'elevenlabs-dicechess-demo-thinkle';
const UPSTREAM = 'fortemate/dicechess-assets';
const CLIENT = 'fortemate/dicechess-tv';
const here = dirname(fileURLToPath(import.meta.url));

const [checkout, commit] = process.argv.slice(2);
if (!checkout || !/^[0-9a-f]{40}$/.test(commit ?? ''))
  throw new Error(
    'Usage: vendor-narration.mjs <dicechess-assets checkout> <full 40-character commit>',
  );

const show = (path) =>
  execFileSync('git', ['-C', resolve(checkout), 'show', `${commit}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Code-unit order, the same on every machine; localeCompare is not.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

const manifest = JSON.parse(show(`voices/${PACK}/manifest.json`).toString());
if (
  manifest.distribution !== 'project' ||
  !manifest.clients?.includes(CLIENT) ||
  !manifest.licenseFile
)
  throw new Error(
    `${PACK} may not be carried by ${CLIENT} (license ${manifest.license}, distribution ${manifest.distribution})`,
  );
const published = JSON.parse(show(`voices/${PACK}/checksums.json`).toString());

const root = join(here, 'narration');
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const files = {};
const copy = (path) => {
  const bytes = show(`voices/${PACK}/${path}`);
  const digest = sha256(bytes);
  if (published[path] !== digest)
    throw new Error(
      `${PACK}/${path} does not match the digest ${UPSTREAM} published at ${commit}`,
    );
  const name = path.split('/').pop();
  writeFileSync(join(root, name), bytes);
  files[name] = digest;
  return { name, digest };
};

copy('manifest.json');
copy(manifest.licenseFile);
const ids = Object.keys(manifest.lines ?? {}).sort(byCodeUnit);
if (ids.length === 0) throw new Error(`${PACK} has no lines made at ${commit}`);
const lines = {};
for (const id of ids) {
  const line = manifest.lines[id];
  const { name, digest } = copy(line.export);
  if (digest !== line.sha256)
    throw new Error(`${id} does not match its record in the manifest`);
  lines[id] = {
    file: name,
    seconds: line.durationSeconds,
    text: line.text,
    sha256: digest,
  };
}

writeFileSync(
  join(root, 'narration.json'),
  JSON.stringify(
    {
      upstream: UPSTREAM,
      commit,
      pack: PACK,
      title: manifest.title,
      license: manifest.license,
      licenseFile: manifest.licenseFile,
      files,
      lines,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `narration: ${ids.length} lines of ${PACK} at ${commit.slice(0, 7)} -> scripts/demo-video/narration/`,
);
