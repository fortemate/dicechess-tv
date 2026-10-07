// Records the takes of the demo video on the Vega Virtual Device, into
// dist/demo-video/takes/<take>.mp4. assemble.ts cuts them together and lays
// Thinkle's narration over them.
//
//   node --experimental-strip-types scripts/demo-video/record.ts [--only] [take...]
//
// A take named on its own runs after the takes it continues from, unless
// --only says it continues from where the device already is, as after a run
// that stopped part-way.
//
// Before a run: the release build is built (`npm run build --prefix native`)
// and the Virtual Device runs with its gRPC on (`vvd enable-grpc`). The first
// take installs the build afresh, which deletes the game, the results and the
// settings saved on the device, so a first launch can be filmed. The takes keep
// the game's own music, so it follows the game, the danger themes included
// (#76): a fresh install starts with music on, and a take run on its own checks
// that the home screen is not silent.
//
// The takes run in this order, and each leaves the app where the next begins:
// tutorial, hotseat, resume, opponents, grabby, rampage, built. The dice are
// random, so a take can miss what its scene needs, such as a capture, a danger
// to a king or a turn left part-way: look through it and record it again.
//
// VVD and VEGA name the two command-line tools when they are not on the PATH,
// and VPKG the package the tutorial take installs.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const VVD = process.env.VVD ?? 'vvd';
const VEGA = process.env.VEGA ?? 'vega';
const VPKG =
  process.env.VPKG ??
  'native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg';
const APP = 'com.fortemate.dicechesstv.main';
const TAKES = 'dist/demo-video/takes';

// A person's pace, so a viewer can follow each step, a steady one for stretches
// the video skips, and a quick one for play nobody watches.
const PACE = 1150;
const STEADY = 1200;
const QUICK = 400;
// The recorder needs a moment for its first frame; the cut drops this lead.
const LEAD = 2000;
// About how long focusInPanel takes, a screenshot and a crop.
const PROBE = 300;

const vvd = (...args: string[]): string =>
  execFileSync(VVD, args, { encoding: 'utf8' });
const vega = (...args: string[]): void => {
  execFileSync(VEGA, args, { stdio: 'ignore' });
};

const press = (keys: string[], gap = PACE): void => {
  vvd('press', ...keys, '--gap', String(gap));
};

// A key `count` times, as separate presses.
const times = (key: string, count: number): string[] =>
  Array.from({ length: count }, () => key);

// Back to the home screen, whatever was open: a new launch always opens there,
// with the cursor on the first option, unless the offer of the tutorial is
// still unanswered (#244).
async function relaunch(): Promise<void> {
  vega('device', 'terminate-app', '-a', APP);
  await sleep(1500);
  vega('device', 'launch-app', '-a', APP);
  await sleep(6000);
}

// The build installed afresh and launched once, so the next launch is still a
// first one: the offer of the tutorial stays until it is answered. Launching is
// left out of the recording here: a recording started a moment before a launch
// once brought the Virtual Device down.
let fresh = false;
async function freshInstall(): Promise<void> {
  // Never take the app off the device without the package to put back.
  if (!existsSync(VPKG)) {
    console.error(
      `no package at ${VPKG}: build it first (npm run build --prefix native)`,
    );
    process.exit(2);
  }
  vega('device', 'uninstall-app', '-a', APP);
  vega('device', 'install-app', '-p', VPKG);
  await sleep(2000);
  vega('device', 'launch-app', '-a', APP);
  await sleep(8000);
  fresh = true;
}

type Area = [x: number, y: number, width: number, height: number];
type Match = (r: number, g: number, b: number) => boolean;

// The frame of whatever has the focus.
const CYAN: Match = (r, g, b) => r < 90 && g > 200 && b > 220;
// The frame of the badge whose turn it is.
const GOLD: Match = (r, g, b) => r > 210 && g > 150 && g < 205 && b < 110;

// The side panel, and in a game against the computer the person's badge, at
// its foot.
const PANEL: Area = [1050, 90, 820, 900];
const PERSON_BADGE: Area = [1074, 888, 746, 110];

// How many pixels of each area have its colour, in one screenshot.
function count(...probes: [Area, Match][]): number[] {
  const shot = join(TAKES, 'probe.png');
  vvd('screenshot', shot);
  const counts = probes.map(([[x, y, w, h], match]) => {
    const pixels = execFileSync(
      'ffmpeg',
      [
        [
          '-v',
          'error',
          '-i',
          shot,
          '-vf',
          `crop=${w}:${h}:${x}:${y},format=rgb24`,
        ],
        ['-f', 'rawvideo', '-'],
      ].flat(),
      // A crop of the panel is 2.2 MB, over execFileSync's default of 1 MB.
      { maxBuffer: 8 * 1024 * 1024 },
    );
    let matching = 0;
    for (let i = 0; i < pixels.length; i += 3)
      if (match(pixels[i], pixels[i + 1], pixels[i + 2])) matching++;
    return matching;
  });
  rmSync(shot, { force: true });
  return counts;
}

// The frame of a focused option in the side panel, as in a menu, a
// confirmation or a result. The board's own cursor is on the other side of the
// screen, and nothing in the panel has a frame during play.
const focusInPanel = (): number => count([PANEL, CYAN])[0];

// Which of the three opponent cards has the focus: they open on the opponent
// of the game in play.
function focusedCard(): number {
  const counts = count(
    [[96, 216, 544, 688], CYAN],
    [[688, 216, 544, 688], CYAN],
    [[1280, 216, 544, 688], CYAN],
  );
  return counts.indexOf(Math.max(...counts));
}

// Records `seconds` of the screen with its sound while `act` plays.
async function record(
  take: string,
  seconds: number,
  act: () => Promise<void> | void,
): Promise<void> {
  const file = join(TAKES, `${take}.mp4`);
  console.log(`recording ${file} (${seconds} s)`);
  const recorder = spawn(VVD, ['record', file, '--seconds', String(seconds)], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const done = new Promise<void>((resolve, reject) =>
    recorder.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`vvd record exited with ${code}`)),
    ),
  );
  await sleep(LEAD);
  try {
    await act();
  } catch (err) {
    recorder.kill();
    await done.catch(() => {});
    throw err;
  }
  await done;
}

// The takes keep the game's music, so it must be on. With nothing playing, the
// device sends no sound at all.
async function checkMusic(): Promise<void> {
  const file = join(TAKES, 'music.mp4');
  await record('music', 3, () => {});
  // ffmpeg reports the level on stderr.
  const probe = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  rmSync(file, { force: true });
  if (probe.status !== 0) {
    console.error(
      `ffmpeg audio probe failed (exit ${probe.status}):\n${probe.stderr}`,
    );
    process.exit(1);
  }
  const peak = /max_volume: (-?[\d.]+) dB/.exec(probe.stderr)?.[1];
  if (peak === undefined || Number(peak) < -50) {
    console.error(
      `the home screen is silent (peak ${peak ?? 'none'} dB): turn music on in Settings`,
    );
    process.exit(1);
  }
}

// Plays on against the computer: OK on the person's turn, when their badge is
// framed, since the computer's move can end the game between a look and a
// press. Only a wait that is nobody's turn by the badges, such as the OK after
// the computer's empty roll, is pressed through, after a while. It stops at the
// result, since the next OK would choose Rematch, so the opponent's last word
// is heard.
async function playOn(steps: number): Promise<void> {
  let waited = 0;
  for (let step = 0; step < steps; step++) {
    const [focus, yours] = count([PANEL, CYAN], [PERSON_BADGE, GOLD]);
    if (focus > 500) return;
    // A framed badge is about 4,700 gold pixels.
    if (yours < 3000 && ++waited < 6) {
      await sleep(PACE);
      continue;
    }
    waited = 0;
    // Looking takes about as long as the rest of a step.
    press(['ok'], PACE - PROBE);
  }
}

// A game against an opponent, from the home screen, as White, which replaces
// the game in play after its confirmation. `card` is the opponent's place among
// the cards: Rolly, Grabby, Rampage.
function startAgainst(card: number, gap = 300): void {
  press(times('up', 5), gap); // Play the computer, counted from the end
  press(['ok'], 1800);
  // The cards open on the opponent of the game in play.
  const now = focusedCard();
  if (now > card) press(times('left', now - card), 900);
  if (now < card) press(times('right', card - now), 900);
  press(['ok'], 1200); // the choice of colour
  press(['down'], 1200); // White
  press(['ok'], 1200);
  // Replacing a game in play asks first, starting on Cancel.
  if (focusInPanel() > 500) press(['down', 'ok'], 2000);
}

const takes: Record<string, () => Promise<void>> = {
  // A first launch, filmed after a fresh install: Thinkle offers the tutorial
  // aloud, and Learn to play takes the player through every lesson, at a pace
  // that lets him say what the video keeps, to the closing words and a first
  // game against Rolly, who greets the player (#244, #264).
  tutorial: async () => {
    await freshInstall();
    await record('tutorial', 130, async () => {
      // An unanswered offer is made again at the next launch.
      await relaunch();
      await sleep(3000); // the offer, said in full
      press(['ok'], 14000); // Learn to play: his welcome
      press(['ok'], 9500); // the roll: three pawns
      press(times('ok', 6), PACE); // three pawn moves
      await sleep(3500); // the turn done
      // Lessons 2 to 4, which the video skips.
      press(['ok', ...times('ok', 3)], STEADY); // next; roll, knight, leap
      press(['ok', ...times('ok', 7)], STEADY); // next; roll, three moves
      press(['ok', ...times('ok', 2)], STEADY); // next; roll, pass
      // Taking a piece: the rook takes the pawn.
      press(['ok', 'ok', 'ok', 'ok'], STEADY); // next; roll, pick up, take
      await sleep(6000); // "Splendid! The dice chose the rook..."
      // Taking the king.
      press(['ok', 'ok', 'ok', 'ok'], STEADY); // next; roll, pick up, take
      await sleep(8000); // "Victory! Taking the king wins at once..."
      press(['ok'], 13500); // finish: his closing words and the choices
      press(['ok'], 6000); // Play Rolly: she greets the player
    });
  },

  // A Hot Seat game hosted by Prowla the cat (#258), from its first roll, at a
  // person's pace, with a right press now and then to show the cursor leaping
  // between the pieces that may move. OK always does the next thing: roll, pick
  // up, put down, or pass the turn. It ends on an OK that plays a move, so the
  // turn is likely left part-way for the resume take.
  hotseat: async () => {
    await relaunch();
    // A fresh install has Prowla as the host already: she is the default.
    if (!fresh) {
      console.log('note: the Hot Seat host must be Prowla');
      await checkMusic();
    }
    const steps = Array.from({ length: 58 }, (_, index) =>
      index % 5 === 3 ? 'right' : 'ok',
    );
    await record('hotseat', 85, async () => {
      press(times('up', 6), QUICK); // New Hot Seat game, counted from the end
      press(['ok'], 1500);
      // Replacing a game in play asks first, starting on Cancel.
      if (focusInPanel() > 500) press(['down', 'ok'], 1500);
      await sleep(5000); // Prowla greets the two players
      press(steps);
    });
  },

  // The turn left part-way: the app is closed for the launcher, and a launch
  // brings the game back on the home screen, where Resume game opens it as it
  // was, dice and all. Home cannot be pressed on the Virtual Device over gRPC,
  // so the app is closed from the command line, which shows the launcher as
  // Home would.
  resume: async () => {
    await record('resume', 24, async () => {
      await sleep(1500); // the turn, left part-way
      vega('device', 'terminate-app', '-a', APP);
      await sleep(3000); // the launcher
      vega('device', 'launch-app', '-a', APP);
      await sleep(5000); // the home screen, with Resume game first
      press(['ok'], 4000);
    });
  },

  // The three opponents, and the choice of colour, which replaces the game in
  // play with one against Grabby as White.
  opponents: async () => {
    await relaunch();
    await record('opponents', 22, () => {
      press(times('up', 5), 300); // Play the computer
      press(['ok'], 1800);
      // The cards open on the opponent of the game in play: back to Rolly
      // first, which a run of all the takes never needs.
      const card = focusedCard();
      if (card) press(times('left', card), 300);
      press(['right', 'right', 'left'], 1400); // Grabby, Rampage, Grabby
      press(['ok'], 1200); // the choice of colour
      press(['down'], 1200); // White
      press(['ok'], 1200);
      if (focusInPanel() > 500) press(['down', 'ok'], 2000);
    });
  },

  // Grabby's turns, some way into the game so that there is something to take,
  // to the end of the game and his last word. The first stretch is played
  // quickly and not recorded.
  grabby: async () => {
    press(times('ok', 130), QUICK);
    await record('grabby', 80, () => playOn(72));
  },

  // A game against Rampage, who goes for the king, from its first roll, long
  // enough for the music to follow the danger to a king: tense when enough rolls
  // could take it this turn, critical when one action could (#76).
  rampage: async () => {
    await relaunch();
    startAgainst(2);
    await record('rampage', 150, () => playOn(130));
  },

  // A cool start from the launcher, then the About screen, which credits the
  // Dice Chess engine the rules come from.
  built: async () => {
    await record('built', 22, async () => {
      vega('device', 'terminate-app', '-a', APP);
      await sleep(2500); // the launcher
      vega('device', 'launch-app', '-a', APP);
      await sleep(4000); // the home screen
      press(['up'], 1200); // About, last, by wrapping
      press(['ok'], 9000);
    });
  },
};

// Takes that depend on prior app state: each entry lists the takes that must
// run before the named take when it is selected without its predecessors.
const prereqs: Partial<Record<string, string[]>> = {
  // resume leaves the hotseat game part-way through.
  resume: ['hotseat'],
  // grabby continues from the game against Grabby that opponents started.
  grabby: ['opponents'],
};

const only = process.argv.includes('--only');
const chosen = process.argv.slice(2).filter((arg) => arg !== '--only');
const unknown = chosen.filter((name) => !(name in takes));
if (unknown.length) {
  console.error(
    `unknown take: ${unknown.join(', ')}; takes: ${Object.keys(takes).join(', ')}`,
  );
  process.exit(2);
}
mkdirSync(TAKES, { recursive: true });

// Build the ordered run list: full set, or selected takes with their
// prerequisites prepended (deduplicating while preserving order).
const order = Object.keys(takes);
const toRun: string[] =
  chosen.length === 0
    ? order
    : [
        ...new Set(
          chosen.flatMap((name) => [
            ...(only ? [] : (prereqs[name] ?? [])),
            name,
          ]),
        ),
      ].sort((a, b) => order.indexOf(a) - order.indexOf(b));

if (chosen.length && toRun.length > chosen.length) {
  const added = toRun.filter((n) => !chosen.includes(n));
  console.log(`note: running prerequisites first: ${added.join(', ')}`);
}

for (const name of toRun) await takes[name]();
