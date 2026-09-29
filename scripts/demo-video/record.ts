// Records the takes of the demo video on the Vega Virtual Device, into
// dist/demo-video/takes/<take>.mp4. assemble.ts cuts them together.
//
//   node --experimental-strip-types scripts/demo-video/record.ts [take...]
//
// Before a run: the release build is installed and open on the Virtual
// Device, its gRPC is on (`vvd enable-grpc`), and in the app's Settings music
// is off, sound effects are on and "Turn board in hotseat" is on. The takes
// carry the game's sound effects only; assemble.ts lays the music under the
// whole video, so it does not break at the cuts.
//
// The takes run in this order, and each leaves the app where the next begins:
// home, hotseat, opponents, grabby, tutorial, rules. The dice are random, so a
// take can miss what its scene needs, such as a dimmed die: look through it and
// record that take again. Recording replaces the game saved on the device.
//
// VVD and VEGA name the two command-line tools when they are not on the PATH.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const VVD = process.env.VVD ?? 'vvd';
const VEGA = process.env.VEGA ?? 'vega';
const APP = 'com.fortemate.dicechesstv.main';
const TAKES = 'dist/demo-video/takes';

// A person's pace, so a viewer can follow each step, and a quick one for play
// nobody watches.
const PACE = 1150;
const QUICK = 400;
// The recorder needs a moment for its first frame; the cut drops this lead.
const LEAD = 2000;

const vvd = (...args: string[]): string =>
  execFileSync(VVD, args, { encoding: 'utf8' });

const press = (keys: string[], gap = PACE): void => {
  vvd('press', ...keys, '--gap', String(gap));
};

// A key `count` times, as separate presses.
const times = (key: string, count: number): string[] =>
  Array.from({ length: count }, () => key);

// Back to the home screen, whatever was open: a new launch always opens there,
// with the cursor on the first option.
async function relaunch(): Promise<void> {
  execFileSync(VEGA, ['device', 'terminate-app', '-a', APP], {
    stdio: 'ignore',
  });
  await sleep(1500);
  execFileSync(VEGA, ['device', 'launch-app', '-a', APP], { stdio: 'ignore' });
  await sleep(6000);
}

// Cyan pixels in the side panel: the frame of a focused option, as in a menu or
// a confirmation. The board's own cursor is on the other side of the screen.
function focusInPanel(): number {
  const shot = join(TAKES, 'probe.png');
  vvd('screenshot', shot);
  const pixels = execFileSync(
    'ffmpeg',
    [
      ['-v', 'error', '-i', shot, '-vf', 'crop=820:900:1050:90,format=rgb24'],
      ['-f', 'rawvideo', '-'],
    ].flat(),
    // The crop is 2.2 MB, over execFileSync's default of 1 MB.
    { maxBuffer: 8 * 1024 * 1024 },
  );
  rmSync(shot, { force: true });
  let cyan = 0;
  for (let i = 0; i < pixels.length; i += 3)
    if (pixels[i] < 90 && pixels[i + 1] > 200 && pixels[i + 2] > 220) cyan++;
  return cyan;
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
  await act();
  await done;
}

// The game's music must be off: the video lays its own under the cuts. With
// nothing playing, the device sends no sound at all.
async function checkSilent(): Promise<void> {
  const file = join(TAKES, 'silence.mp4');
  await record('silence', 3, () => {});
  // ffmpeg reports the level on stderr.
  const { stderr: report } = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  rmSync(file, { force: true });
  const peak = /max_volume: (-?[\d.]+) dB/.exec(report)?.[1];
  if (peak !== undefined && Number(peak) > -50) {
    console.error(
      `the home screen is not silent (peak ${peak} dB): turn music off in Settings`,
    );
    process.exit(1);
  }
}

// A fresh hotseat game, not yet rolled, so the home screen shows the starting
// position and no game to resume. "Resume game" leads the home list only when
// there is a game to resume, so the other options are counted from the end.
async function freshHotseat(): Promise<void> {
  await relaunch();
  await checkSilent();
  press(times('up', 6), QUICK); // New hotseat game
  press(['ok'], 1500);
  // Replacing a game in play asks first, starting on Cancel.
  if (focusInPanel() > 500) press(['down', 'ok'], 1500);
  await relaunch();
}

const takes: Record<string, () => Promise<void>> = {
  // The home screen: the cursor walks the options and starts a hotseat game.
  home: async () => {
    await freshHotseat();
    await record('home', 11, () => {
      press(['down', 'down', 'down', 'up', 'up', 'up'], 800);
      press(['ok'], 2000);
    });
  },

  // A hotseat game from its first roll, at a person's pace, with a right press
  // now and then to show the cursor moving between the pieces it may play. OK
  // always does the next thing: roll, pick up, put down, or pass the turn.
  hotseat: async () => {
    const steps = Array.from({ length: 64 }, (_, index) =>
      index % 5 === 3 ? 'right' : 'ok',
    );
    await record('hotseat', 80, () => press(steps));
  },

  // The three opponents, and the choice of colour, which replaces the hotseat
  // game with one against Grabby as White.
  opponents: async () => {
    await relaunch();
    await record('opponents', 20, () => {
      press(times('up', 5), 300); // Play the computer
      press(['ok'], 1800);
      press(['right', 'right', 'left'], 1400); // Grabby, Rampage, Grabby
      press(['ok'], 1200); // the choice of colour
      press(['down'], 1200); // White
      press(['ok'], 1200);
      if (focusInPanel() > 500) press(['down', 'ok'], 2000);
    });
  },

  // Grabby's turns, some way into the game so that there is something to take.
  // The first stretch is played quickly and not recorded; while Grabby plays,
  // the board ignores OK. When a game ends, the next OK chooses Rematch, so a
  // result screen shows only briefly: the storyboard's `hold` keeps it up.
  grabby: async () => {
    press(times('ok', 160), QUICK);
    await record('grabby', 60, () => press(times('ok', 48)));
  },

  // The first lesson played through, and the start of the second.
  tutorial: async () => {
    await relaunch();
    await record('tutorial', 22, () => {
      press(times('up', 4), 300); // How to play
      press(['ok'], 3200);
      press(['ok'], 1200); // pick up the pawn
      press(['ok'], 2800); // and put it down
      press(['ok'], 4000); // the next lesson
    });
  },

  // A few topics of the rules guide, then Castling and Draws, the topics the
  // card names.
  rules: async () => {
    press(['back'], 1500);
    await record('rules', 17, async () => {
      press(times('up', 3), 300); // Rules
      press(['ok'], 2400);
      press(['down', 'down'], 2000); // Your turn, What the dice mean
      press(times('down', 3), 250); // Castling
      await sleep(2200);
      press(times('down', 3), 250); // Draws
      await sleep(2200);
    });
  },
};

const chosen = process.argv.slice(2);
const unknown = chosen.filter((name) => !(name in takes));
if (unknown.length) {
  console.error(
    `unknown take: ${unknown.join(', ')}; takes: ${Object.keys(takes).join(', ')}`,
  );
  process.exit(2);
}
mkdirSync(TAKES, { recursive: true });
for (const name of chosen.length ? chosen : Object.keys(takes))
  await takes[name]();
