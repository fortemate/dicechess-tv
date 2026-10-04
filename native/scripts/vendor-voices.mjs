// Vendors the voices (#159, #187, #202, #258, #264) from fortemate/dicechess-assets
// at one pinned commit: the bots' pack, the Hot Seat hosts' packs, the tutorial's,
// and events.json, the table of when a character speaks.
//
//   node scripts/vendor-voices.mjs <dicechess-assets checkout> <commit>
//
// Like vendor-sounds.mjs, files are read with `git show <commit>:<path>` and
// checked against the digests the asset repository published. Each pack has one
// clip for each of its lines, made ahead of time with ElevenLabs and levelled to
// the music's loudness: the bots' for the lines of src/core/botVoice.ts, which
// the owner designed and picked by ear (dicechess-assets#29), and the hosts' for
// the lines of src/core/hostScripts.ts, said by Rolly (#202) and by Prowla the cat
// (#258) as the Hot Seat host, and the tutorial's for the lines of
// src/core/tutorial.ts, said by Thinkle the wizard as he teaches it (#264). Every
// pack is for Fortemate's Dice Chess apps only (dicechess-assets#27): a project
// permission that names this repository, like the music's.
//
// events.json is not in a pack and has no published digest: the commit pins it,
// and its digest is recorded in voices.json. The host's pacing is generated from
// it into src/core/hostPacing.ts, so the numbers are the ones every Dice Chess
// client shares.
//
// Each clip keeps the text it was recorded from. test/vendoredVoices.test.ts
// fails when a line of the game has no clip, or its clip says something else, so
// a line changed in the game cannot ship with the old recording.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKS = [
  'elevenlabs-dicechess-bots',
  'elevenlabs-dicechess-host',
  'elevenlabs-dicechess-host-prowla',
  'elevenlabs-dicechess-tutorial-thinkle',
];
const UPSTREAM = 'fortemate/dicechess-assets';
const CLIENT = 'fortemate/dicechess-tv';
const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [checkout, commit] = process.argv.slice(2);
if (!checkout || !/^[0-9a-f]{40}$/.test(commit ?? ''))
  throw new Error(
    'Usage: vendor-voices.mjs <dicechess-assets checkout> <full 40-character commit>',
  );

const show = (path) =>
  execFileSync('git', ['-C', checkout, 'show', `${commit}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Code-unit order, the same on every machine; localeCompare is not.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

const root = join(native, 'voices');
rmSync(root, { recursive: true, force: true });

const packs = {};
const lines = {};
for (const pack of PACKS) {
  const manifest = JSON.parse(
    show(`voices/${pack}/manifest.json`).toString('utf8'),
  );
  const allowed =
    manifest.distribution === 'public' ||
    (manifest.distribution === 'project' &&
      Array.isArray(manifest.clients) &&
      manifest.clients.includes(CLIENT));
  if (!allowed || !manifest.licenseFile)
    throw new Error(
      `${pack} may not be carried by ${CLIENT} (license ${manifest.license}, distribution ${manifest.distribution})`,
    );
  const published = JSON.parse(
    show(`voices/${pack}/checksums.json`).toString('utf8'),
  );

  mkdirSync(join(root, pack), { recursive: true });
  const files = {};
  const copy = (path) => {
    const bytes = show(`voices/${pack}/${path}`);
    const digest = sha256(bytes);
    if (published[path] !== digest)
      throw new Error(
        `${pack}/${path} does not match the digest ${UPSTREAM} published at ${commit}`,
      );
    const name = path.split('/').pop();
    writeFileSync(join(root, pack, name), bytes);
    files[name] = digest;
    return { file: `${pack}/${name}`, sha256: digest };
  };

  copy('manifest.json');
  copy(manifest.licenseFile);
  const ids = Object.keys(manifest.lines ?? {}).sort(byCodeUnit);
  if (ids.length === 0)
    throw new Error(
      `${pack} has no pack lines at ${commit}: only an audition?`,
    );
  for (const id of ids) {
    if (lines[id])
      throw new Error(`${pack}: line ${id} is already ${lines[id].pack}'s`);
    const line = manifest.lines[id];
    const { file, sha256: digest } = copy(line.export);
    if (digest !== line.sha256)
      throw new Error(`${id} does not match its record in the manifest`);
    lines[id] = {
      pack,
      bot: line.bot,
      event: line.event,
      text: line.text,
      voice: line.voice,
      file,
      sha256: digest,
      seconds: line.durationSeconds,
    };
  }

  packs[pack] = {
    title: manifest.title,
    license: manifest.license,
    licenseFile: manifest.licenseFile,
    distribution: manifest.distribution,
    clients: manifest.clients ?? null,
    attributionRequired: manifest.attributionRequired,
    generator: manifest.generator?.tool ?? null,
    // Where the lines the pack was recorded from are written: a commit of this
    // repository for the bots, the asset repository's catalogue for the host.
    texts: manifest.pack?.texts ?? null,
    // Every file vendored for the pack, with its digest.
    files,
  };
}

// When a character speaks: the tiers, priorities and pacing every Dice Chess
// client follows (dicechess-assets#38). Copied verbatim; checked for the shape
// the generated pacing relies on, since it has no published digest.
const PACING_KEYS = [
  'alwaysPerEvent',
  'notableCooldownTurns',
  'notablePerEvent',
  'frequentCooldownTurns',
  'frequentChance',
  'repeatDecay',
  'silenceBreakerTurns',
];
const TIERS = ['always', 'notable', 'frequent'];
const eventsBytes = show('voices/events.json');
const events = JSON.parse(eventsBytes.toString('utf8'));
if (events.schemaVersion !== 1)
  throw new Error(
    `events.json has schema ${events.schemaVersion} at ${commit}, not 1`,
  );
const pacing = events.pacing?.host ?? {};
if (
  Object.keys(pacing).sort(byCodeUnit).join() !==
    [...PACING_KEYS].sort(byCodeUnit).join() ||
  !PACING_KEYS.every((key) => typeof pacing[key] === 'number')
)
  throw new Error(
    `events.json: pacing.host must have exactly the numbers ${PACING_KEYS.join(', ')}`,
  );
const hostEvents = Object.entries(events.events?.host ?? {});
if (hostEvents.length === 0) throw new Error('events.json has no host events');
for (const [event, { tier, priority }] of hostEvents)
  if (!TIERS.includes(tier) || !Number.isInteger(priority) || priority < 1)
    throw new Error(
      `events.json: host event ${event} has tier ${tier} and priority ${priority}`,
    );
writeFileSync(join(root, 'events.json'), eventsBytes);

const catalogue = {
  upstream: UPSTREAM,
  commit,
  events: { file: 'events.json', sha256: sha256(eventsBytes) },
  packs,
  lines: Object.fromEntries(
    Object.keys(lines)
      .sort(byCodeUnit)
      .map((id) => [id, lines[id]]),
  ),
};
writeFileSync(
  join(root, 'voices.json'),
  JSON.stringify(catalogue, null, 2) + '\n',
);

// The app reads this at run time. It is generated, rather than importing the
// catalogue, so neither Metro nor the test runner has to be taught JSON modules.
const body = Object.entries(catalogue.lines)
  .map(
    ([id, { file, seconds, text }]) =>
      `  ${id}: { file: ${JSON.stringify(file)}, seconds: ${seconds}, text: ${JSON.stringify(text)} },`,
  )
  .join('\n');
const voiceFiles = join(native, 'src/voiceFiles.ts');
writeFileSync(
  voiceFiles,
  `// Generated by scripts/vendor-voices.mjs from voices/voices.json. Do not edit.
//
// The clip of each line, a bot's, the Hot Seat host's or the tutor's, by the
// line's id in src/core/botVoice.ts, src/core/hostVoice.ts or
// src/core/tutorial.ts: its file relative to the
// voices directory the build copies it into, how long it plays, and the text it
// was recorded from.
export type VoiceClip = {
  readonly file: string;
  readonly seconds: number;
  readonly text: string;
};

export const VOICE_FILES: Readonly<Record<string, VoiceClip>> = {
${body}
};
`,
);

// The host's pacing, as plain typed data the core compiles without JSON
// modules: Metro's Babel, Node's type stripping and the web bench all read it.
const union = (names) => names.map((name) => `  | ${JSON.stringify(name)}`);
const hostPacing = join(native, '../src/core/hostPacing.ts');
writeFileSync(
  hostPacing,
  `// Generated by native/scripts/vendor-voices.mjs from native/voices/events.json.
// Do not edit: change events.json in dicechess-assets and vendor it again.
//
// How often the Hot Seat host speaks (#202): the importance tier and priority of
// each host event, and the pacing every Dice Chess client follows, so the TV,
// the web and the phone sound alike. A lower priority number wins when events
// meet in one step. docs/CHARACTERS.md in dicechess-assets explains the tiers.
export type Tier = ${TIERS.map((tier) => JSON.stringify(tier)).join(' | ')};

export type HostEvent =
${union(hostEvents.map(([event]) => event)).join('\n')};

export type HostPacing = {
${PACING_KEYS.map((key) => `  readonly ${key}: number;`).join('\n')}
};

export const HOST_PACING: HostPacing = {
${PACING_KEYS.map((key) => `  ${key}: ${JSON.stringify(pacing[key])},`).join('\n')}
};

export const HOST_EVENTS: Readonly<
  Record<HostEvent, { readonly tier: Tier; readonly priority: number }>
> = {
${hostEvents
  .map(
    ([event, { tier, priority }]) =>
      `  ${event}: { tier: ${JSON.stringify(tier)}, priority: ${priority} },`,
  )
  .join('\n')}
};
`,
);

// Formatted like the rest of the source, so the format check passes and a
// re-run leaves no diff: by the repository's own Prettier, which is the root
// package's, not this one's.
execFileSync('npx', ['prettier', '--write', voiceFiles, hostPacing], {
  cwd: join(native, '..'),
  stdio: 'ignore',
});

console.log(
  `voices: ${Object.keys(lines).length} lines from ${PACKS.length} packs at ${commit.slice(0, 7)} -> native/voices/; host pacing -> src/core/hostPacing.ts`,
);
