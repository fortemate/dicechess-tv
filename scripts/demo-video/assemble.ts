// Builds the demo video from the takes record.ts saved and the storyboard: a
// title card before each scene, the scene's footage after it, one track of the
// game's music under all of it, and an end card.
//
//   node --experimental-strip-types scripts/demo-video/assemble.ts [storyboard]
//
// Run from the repository root. It reads scripts/demo-video/storyboard.json and
// dist/demo-video/takes/<take>.mp4, and writes dist/demo-video/: the video, its
// chapters for the YouTube description, and a contact sheet to check it by.
// It needs ffmpeg and ffprobe, and swift (macOS) for the stills.
//
// The music is laid in here rather than recorded, so it runs on unbroken across
// the cuts and under the cards; the takes are recorded with the game's music
// off and carry only its sound effects.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Clip = {
  take: string;
  from: number | null;
  to: number | null;
  // Seconds to keep the clip's last frame up, for a screen the app leaves up
  // until a key is pressed but the take pressed on at once, such as a result.
  hold?: number;
};
type Scene = { kicker: string; title: string; seconds?: number; clips: Clip[] };
type Storyboard = {
  music: {
    file: string;
    // The game plays its music below the effects: this is the menu theme's own
    // gain and the default volume step, so the video keeps the game's balance.
    gainDb: number;
    // Raised this much while a card is up, where there are no effects.
    cardLiftDb: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
  };
  badge: string;
  end: {
    seconds: number;
    title: string;
    tagline: string;
    link: string;
    footer: string;
  };
  scenes: Scene[];
};

const HERE = 'scripts/demo-video';
const OUT = 'dist/demo-video';
const TAKES = join(OUT, 'takes');
const WORK = join(OUT, 'work');
const VIDEO = join(OUT, 'dicechess-tv-demo.mp4');

// Seconds a picture takes to fade between a card and the footage.
const FADE = 0.25;
// The contest's limit: the video must be shorter than three minutes.
const LIMIT = 180;
// YouTube ignores chapters shorter than this.
const CHAPTER_MIN = 10;
// Integrated loudness (LUFS) and the peak ceiling (dBFS) of the finished sound.
const LOUDNESS = -16;
const CEILING = -1.5;

// The segments are kept close to lossless; the finished video is encoded once
// more, a little smaller.
const videoCodec = (crf: number): string[] =>
  [
    ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf)],
    ['-pix_fmt', 'yuv420p', '-r', '30', '-g', '60'],
  ].flat();
const AUDIO_CODEC = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

const seconds = (value: number): string => value.toFixed(3);

const ffmpeg = (args: string[]): void => {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
};

function probeDuration(file: string): number {
  const out = execFileSync(
    'ffprobe',
    [
      ['-v', 'error', '-show_entries', 'format=duration'],
      ['-of', 'csv=p=0', file],
    ].flat(),
    { encoding: 'utf8' },
  );
  return Number(out.trim());
}

// Integrated loudness in LUFS, as EBU R128 measures it. ffmpeg reports it on
// stderr, last in its summary.
function loudness(file: string): number {
  const { stderr } = spawnSync(
    'ffmpeg',
    ['-v', 'info', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const found = [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  if (!found) throw new Error(`could not measure the loudness of ${file}`);
  return Number(found[1]);
}

// How long a card stays up: time to read its title twice at an easy pace.
const cardSeconds = (scene: Scene): number =>
  scene.seconds ??
  Math.min(4.2, Math.max(2.8, 1.4 + 0.26 * scene.title.split(/\s+/).length));

// The background as a take decodes it, from the margin left of the board, so a
// card fades into the footage without a step in colour.
function backgroundOf(take: string, at: number): string {
  const pixel = execFileSync(
    'ffmpeg',
    [
      ['-v', 'error', '-ss', seconds(at), '-i', take, '-frames:v', '1'],
      ['-vf', 'crop=1:1:40:540,format=rgb24', '-f', 'rawvideo', '-'],
    ].flat(),
  );
  return [...pixel.subarray(0, 3)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function main(): void {
  // Another storyboard may be named, to try a different cut of the same takes.
  const board = JSON.parse(
    readFileSync(process.argv[2] ?? join(HERE, 'storyboard.json'), 'utf8'),
  ) as Storyboard;

  const clips = board.scenes.flatMap((scene) => scene.clips);
  const unset = clips.filter((clip) => clip.from === null || clip.to === null);
  if (unset.length) {
    console.error(
      `set "from" and "to" for every clip first: ${unset.map((clip) => clip.take).join(', ')}`,
    );
    process.exit(2);
  }
  const take = (clip: Clip): string => join(TAKES, `${clip.take}.mp4`);

  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  // Sampled mid-clip: a take may open on a fade.
  const first = clips[0];
  const background = backgroundOf(
    take(first),
    ((first.from as number) + (first.to as number)) / 2,
  );
  const colour = `0x${background}`;

  // The stills: one card per scene, the badge and the end card.
  const cards = board.scenes.map((scene, index) => ({
    file: `card-${index + 1}.png`,
    kicker: scene.kicker,
    title: scene.title,
  }));
  const spec = join(WORK, 'stills.json');
  writeFileSync(
    spec,
    JSON.stringify({
      background: `#${background}`,
      cards,
      badge: { file: 'badge.png', text: board.badge },
      end: {
        file: 'end.png',
        icon: resolve('native/icon/icon-512.png'),
        ...board.end,
      },
    }),
  );
  execFileSync('swift', [join(HERE, 'cards.swift'), spec, WORK], {
    stdio: 'inherit',
  });

  // Every segment has the same codecs, so they join without a re-encode.
  const segments: string[] = [];
  const cardSpans: { start: number; end: number }[] = [];
  const chapters: { start: number; name: string }[] = [];
  let at = 0;
  const fades = (length: number) =>
    `fade=t=in:st=0:d=${FADE}:color=${colour},` +
    `fade=t=out:st=${seconds(length - FADE)}:d=${FADE}:color=${colour}`;

  const still = (png: string, length: number, name: string) => {
    const out = join(
      WORK,
      `${String(segments.length).padStart(2, '0')}-${name}.mp4`,
    );
    ffmpeg(
      [
        ['-loop', '1', '-framerate', '30', '-t', seconds(length), '-i', png],
        [
          '-f',
          'lavfi',
          '-t',
          seconds(length),
          '-i',
          'anullsrc=r=48000:cl=stereo',
        ],
        [
          '-vf',
          fades(length),
          ...videoCodec(16),
          ...AUDIO_CODEC,
          '-shortest',
          out,
        ],
      ].flat(),
    );
    segments.push(out);
    at += probeDuration(out);
  };

  board.scenes.forEach((scene, index) => {
    chapters.push({ start: at, name: scene.kicker });
    const start = at;
    still(
      join(WORK, cards[index].file),
      cardSeconds(scene),
      `card-${index + 1}`,
    );
    cardSpans.push({ start, end: at });
    for (const clip of scene.clips) {
      const from = clip.from as number;
      const length = (clip.to as number) - from;
      const hold = clip.hold ?? 0;
      const out = join(
        WORK,
        `${String(segments.length).padStart(2, '0')}-${clip.take}.mp4`,
      );
      ffmpeg(
        [
          ['-ss', seconds(from), '-t', seconds(length), '-i', take(clip)],
          ['-i', join(WORK, 'badge.png')],
          [
            '-filter_complex',
            `[0:v][1:v]overlay=0:0,` +
              `tpad=stop_mode=clone:stop_duration=${seconds(hold)},` +
              `${fades(length + hold)}[v];` +
              `[0:a]aresample=48000,apad=pad_dur=${seconds(hold)},` +
              `afade=t=in:st=0:d=0.15,` +
              `afade=t=out:st=${seconds(length + hold - 0.25)}:d=0.25[a]`,
          ],
          [
            '-map',
            '[v]',
            '-map',
            '[a]',
            ...videoCodec(16),
            ...AUDIO_CODEC,
            out,
          ],
        ].flat(),
      );
      segments.push(out);
      at += probeDuration(out);
    }
  });
  still(join(WORK, 'end.png'), board.end.seconds, 'end');

  // The picture and the effects, joined.
  const list = join(WORK, 'segments.txt');
  writeFileSync(
    list,
    segments.map((file) => `file '${resolve(file)}'\n`).join(''),
  );
  const joined = join(WORK, 'joined.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  const total = probeDuration(joined);

  // One track of music under everything, lifted while a card is up. The lift
  // ramps over RAMP seconds at each edge of a card.
  const { music } = board;
  const RAMP = 0.6;
  const gain = 10 ** (music.gainDb / 20);
  const lift = 10 ** (music.cardLiftDb / 20) - 1;
  const up = cardSpans
    .map(
      ({ start, end }) =>
        `clip(min((t-${seconds(start)})/${RAMP},(${seconds(end)}-t)/${RAMP}),0,1)`,
    )
    .join('+');
  // The effects and the music, mixed. The joins leave the segments'
  // timestamps a few milliseconds off, so the effects are laid on their own
  // timestamps, silence filling any gap.
  const mix = join(WORK, 'mix.wav');
  ffmpeg(
    [
      ['-i', joined, '-stream_loop', '-1', '-i', music.file],
      [
        '-filter_complex',
        `[0:a]aresample=48000:async=1:first_pts=0[fx];` +
          `[1:a]atrim=0:${seconds(total)},aresample=48000,` +
          `volume='${gain.toFixed(4)}*(1+${lift.toFixed(4)}*(${up}))':eval=frame,` +
          `afade=t=in:st=0:d=${music.fadeInSeconds},` +
          `afade=t=out:st=${seconds(total - music.fadeOutSeconds)}:d=${music.fadeOutSeconds}[m];` +
          `[fx][m]amix=inputs=2:normalize=0:duration=first[a]`,
      ],
      ['-map', '[a]', '-c:a', 'pcm_f32le', mix],
    ].flat(),
  );

  // Brought to the loudness the first cut had, which is also what video sites
  // play at, with the effects' peaks held under the ceiling. The picture is
  // set to an even 30 frames a second again after the joins.
  const raise = LOUDNESS - loudness(mix);
  ffmpeg(
    [
      ['-i', joined, '-i', mix],
      [
        '-filter_complex',
        `[0:v]fps=30[v];` +
          `[1:a]volume=${raise.toFixed(2)}dB,` +
          `alimiter=limit=${(10 ** (CEILING / 20)).toFixed(4)}:level=false[a]`,
      ],
      ['-map', '[v]', '-map', '[a]', ...videoCodec(18), ...AUDIO_CODEC],
      ['-movflags', '+faststart', VIDEO],
    ].flat(),
  );

  check(VIDEO);

  const stamp = (value: number) =>
    `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  const lines = chapters.map(({ start, name }, index) => {
    const next = chapters[index + 1]?.start ?? total;
    if (next - start < CHAPTER_MIN)
      console.warn(
        `chapter "${name}" is ${(next - start).toFixed(1)} s, under YouTube's ${CHAPTER_MIN} s`,
      );
    return `${stamp(index === 0 ? 0 : start)} ${name}`;
  });
  writeFileSync(join(OUT, 'chapters.txt'), `${lines.join('\n')}\n`);

  ffmpeg(
    [
      [
        '-i',
        VIDEO,
        '-vf',
        `fps=1/2,scale=480:-1,tile=6x${Math.ceil(total / 12)}:padding=4:color=white`,
      ],
      ['-frames:v', '1', join(OUT, 'sheet.png')],
    ].flat(),
  );

  console.log(`${VIDEO}: ${total.toFixed(1)} s`);
  console.log(lines.join('\n'));
}

// What the contest asks of the file: under three minutes, 1080p at 30 frames a
// second, with sound.
function check(file: string): void {
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        file,
      ],
      { encoding: 'utf8' },
    ),
  ) as {
    format: { duration: string };
    streams: {
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }[];
  };
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  const length = Number(probe.format.duration);
  const problems = [
    length > 0 && length < LIMIT
      ? ''
      : `lasts ${length.toFixed(1)} s, not under ${LIMIT} s`,
    video?.width === 1920 && video.height === 1080
      ? ''
      : `is ${video?.width}x${video?.height}, not 1920x1080`,
    video?.r_frame_rate === '30/1'
      ? ''
      : `runs at ${video?.r_frame_rate}, not 30/1`,
    audio?.codec_name === 'aac' ? '' : 'has no AAC sound',
  ].filter(Boolean);
  if (problems.length) {
    console.error(`${file} ${problems.join('; ')}`);
    process.exit(1);
  }
}

main();
