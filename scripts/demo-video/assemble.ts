// Builds the demo video from the takes record.ts saved and the storyboard:
// each scene's optional title card and footage with its own sound, optional
// narration, and an end card.
//
//   node --experimental-strip-types scripts/demo-video/assemble.ts [storyboard]
//
// Run from the repository root. It reads scripts/demo-video/storyboard.json,
// dist/demo-video/takes/<take>.mp4 and the narration vendored in
// scripts/demo-video/narration/, and writes dist/demo-video/: the video, its
// chapters for the YouTube description, and a contact sheet to check it by.
// It needs ffmpeg and ffprobe, and swift (macOS) for the stills.
//
// A scene can open with a title card or add narration. The
// takes are recorded with the game's music on, so a scene keeps the music the
// game played there, the danger themes included (#76). Under each line of his
// the take's sound dips, as the game's music dips under a character's line
// (#159).
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
  // Built splash artwork is shown as an asset, without the device badge.
  badge?: boolean;
};
// One of Thinkle's lines, `at` seconds into its scene (or the end card).
type Narration = { line: string; at: number };
type Scene = {
  name: string;
  card?: { kicker: string; title: string; seconds: number };
  clips: Clip[];
  narration?: Narration[];
};
type Storyboard = {
  badge: string;
  // How far the take's sound dips under Thinkle's line: the game's own duck.
  duckDb: number;
  // His lines are packed at -16 LUFS; this moves them against the takes.
  narrationGainDb: number;
  end: {
    seconds: number;
    title: string;
    tagline?: string;
    link: string;
    footer: string;
    // The menu theme under the end card, where no take plays.
    music: {
      file: string;
      gainDb: number;
      fadeInSeconds: number;
      fadeOutSeconds: number;
    };
    narration?: Narration[];
  };
  scenes: Scene[];
};

const HERE = 'scripts/demo-video';
const OUT = process.env.OUT ?? 'dist/demo-video';
const TAKES = process.env.TAKES ?? join(OUT, 'takes');
const WORK = join(OUT, 'work');
const VIDEO = join(OUT, 'dicechess-tv-demo.mp4');

// Seconds a picture takes to fade through the background between two clips.
const FADE = 0.25;
// The contest's limit: the video must be shorter than three minutes.
const LIMIT = 180;
// YouTube ignores chapters shorter than this.
const CHAPTER_MIN = 10;
// How long the take's sound takes to dip before a line and to come back after
// it, as the game's music does (native/src/music.ts).
const DUCK_IN = 0.2;
const DUCK_OUT = 0.6;
// The least breath between two of his lines, as the tutorial leaves one
// (LINE_TAIL_MS in native/src/sound.ts).
const BREATH = 0.3;
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

// The background as a take decodes it, from the margin left of the board, so
// the fades and the end card have no step in colour.
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

// Where each of his lines is: the narration vendored for the video, or a line
// the app itself has, such as his tutorial sign-off.
type Line = { file: string; seconds: number; text: string };
function lineCatalogue(): Map<string, Line> {
  const lines = new Map<string, Line>();
  const narration = JSON.parse(
    readFileSync(join(HERE, 'narration/narration.json'), 'utf8'),
  ) as { lines: Record<string, Line> };
  for (const [id, line] of Object.entries(narration.lines))
    lines.set(id, { ...line, file: join(HERE, 'narration', line.file) });
  const app = JSON.parse(readFileSync('native/voices/voices.json', 'utf8')) as {
    lines: Record<string, Line>;
  };
  for (const [id, line] of Object.entries(app.lines))
    if (!lines.has(id))
      lines.set(id, { ...line, file: join('native/voices', line.file) });
  return lines;
}

// His lines in a stretch that lasts `length` seconds and starts `start` seconds
// into the video: placed in the order they are said, whatever the order the
// storyboard lists them in, and checked to keep apart and inside it.
type Placed = { line: string; file: string; start: number; end: number };
function place(
  where: string,
  narration: Narration[],
  start: number,
  length: number,
  lines: Map<string, Line>,
): Placed[] {
  const placed = narration
    .map(({ line, at }) => {
      const found = lines.get(line);
      if (!found) throw new Error(`${where}: no clip for ${line}`);
      return {
        line,
        file: found.file,
        start: start + at,
        end: start + at + found.seconds,
      };
    })
    .sort((a, b) => a.start - b.start);
  placed.forEach((each, index) => {
    const next = placed[index + 1];
    if (each.start < start)
      throw new Error(`${where}: ${each.line} starts before the scene`);
    if (next && each.end + BREATH > next.start)
      throw new Error(
        `${where}: ${each.line} runs into ${next.line}; start it at least ${BREATH} s later`,
      );
    if (each.end > start + length + 0.05)
      console.warn(
        `${where}: ${each.line} ends ${(each.end - start - length).toFixed(2)} s after the scene`,
      );
  });
  return placed;
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
  const catalogue = lineCatalogue();

  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  // Sampled mid-clip: a take may open on a fade.
  const first = clips[0];
  const background = backgroundOf(
    take(first),
    ((first.from as number) + (first.to as number)) / 2,
  );
  const colour = `0x${background}`;

  // The stills: the badge and the end card.
  const spec = join(WORK, 'stills.json');
  writeFileSync(
    spec,
    JSON.stringify({
      background: `#${background}`,
      cards: board.scenes.flatMap((scene, index) =>
        scene.card ? [{ file: `card-${index}.png`, ...scene.card }] : [],
      ),
      badge: { file: 'badge.png', text: board.badge },
      end: {
        file: 'end.png',
        icon: resolve('native/icon/icon-512.png'),
        title: board.end.title,
        tagline: board.end.tagline ?? null,
        link: board.end.link,
        footer: board.end.footer,
      },
    }),
  );
  execFileSync('swift', [join(HERE, 'cards.swift'), spec, WORK], {
    stdio: 'inherit',
  });

  // Every segment has the same codecs, so they join without a re-encode.
  const segments: string[] = [];
  const spoken: Placed[] = [];
  const chapters: { start: number; name: string }[] = [];
  let at = 0;
  const fades = (length: number) =>
    `fade=t=in:st=0:d=${FADE}:color=${colour},` +
    `fade=t=out:st=${seconds(length - FADE)}:d=${FADE}:color=${colour}`;
  const segmentName = (name: string) =>
    join(WORK, `${String(segments.length).padStart(2, '0')}-${name}.mp4`);

  for (const [index, scene] of board.scenes.entries()) {
    chapters.push({ start: at, name: scene.name });
    const start = at;
    if (scene.card) {
      const length = scene.card.seconds;
      const out = segmentName(`card-${index}`);
      const music = board.end.music;
      ffmpeg([
        '-loop',
        '1',
        '-framerate',
        '30',
        '-t',
        seconds(length),
        '-i',
        join(WORK, `card-${index}.png`),
        '-stream_loop',
        '-1',
        '-ss',
        seconds(at),
        '-i',
        music.file,
        '-filter_complex',
        `[0:v]${fades(length)}[v];` +
          `[1:a]atrim=0:${seconds(length)},aresample=48000,` +
          `volume=${music.gainDb}dB,afade=t=in:st=0:d=0.25,` +
          `afade=t=out:st=${seconds(length - FADE)}:d=${FADE}[a]`,
        '-map',
        '[v]',
        '-map',
        '[a]',
        ...videoCodec(16),
        ...AUDIO_CODEC,
        '-shortest',
        out,
      ]);
      segments.push(out);
      at += probeDuration(out);
    }
    for (const clip of scene.clips) {
      const from = clip.from as number;
      const length = (clip.to as number) - from;
      const hold = clip.hold ?? 0;
      const out = segmentName(clip.take);
      ffmpeg(
        [
          ['-ss', seconds(from), '-t', seconds(length), '-i', take(clip)],
          ['-i', join(WORK, 'badge.png')],
          [
            '-filter_complex',
            (clip.badge === false ? '[0:v]' : '[0:v][1:v]overlay=0:0,') +
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
    spoken.push(
      ...place(scene.name, scene.narration ?? [], start, at - start, catalogue),
    );
  }

  // The end card, silent here: the menu theme is laid under it in the mix.
  const endStart = at;
  const endCard = segmentName('end');
  ffmpeg(
    [
      [
        '-loop',
        '1',
        '-framerate',
        '30',
        '-t',
        seconds(board.end.seconds),
        '-i',
        join(WORK, 'end.png'),
      ],
      [
        '-f',
        'lavfi',
        '-t',
        seconds(board.end.seconds),
        '-i',
        'anullsrc=r=48000:cl=stereo',
      ],
      [
        '-vf',
        `fade=t=in:st=0:d=${FADE}:color=${colour}`,
        ...videoCodec(16),
        ...AUDIO_CODEC,
        '-shortest',
        endCard,
      ],
    ].flat(),
  );
  segments.push(endCard);
  const endLength = probeDuration(endCard);
  at += endLength;
  spoken.push(
    ...place('end', board.end.narration ?? [], endStart, endLength, catalogue),
  );

  // The picture and the takes' sound, joined.
  const list = join(WORK, 'segments.txt');
  writeFileSync(
    list,
    segments
      .map((file) => `file '${resolve(file).replaceAll("'", "\\'")}'\n`)
      .join(''),
  );
  const joined = join(WORK, 'joined.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  const total = probeDuration(joined);

  // The takes' sound dips under each of his lines, down before it starts and
  // back after it ends. His lines go in at their times, and the menu theme
  // under the end card. The joins leave the segments' timestamps a few
  // milliseconds off, so the takes' sound is laid on its own timestamps,
  // silence filling any gap.
  const dip = 1 - 10 ** (board.duckDb / 20);
  const down =
    spoken
      .map(
        ({ start, end }) =>
          `clip(min((t-${seconds(start - DUCK_IN)})/${DUCK_IN},(${seconds(end + DUCK_OUT)}-t)/${DUCK_OUT}),0,1)`,
      )
      .join('+') || '0';
  const { music } = board.end;
  const inputs = ['-i', joined];
  const graph = [
    `[0:a]aresample=48000:async=1:first_pts=0,` +
      `volume='1-${dip.toFixed(4)}*clip(${down},0,1)':eval=frame[takes]`,
  ];
  const mixed = ['[takes]'];
  spoken.forEach(({ file, start }, index) => {
    inputs.push('-i', file);
    const delay = Math.round(start * 1000);
    graph.push(
      `[${index + 1}:a]aresample=48000,aformat=channel_layouts=stereo,` +
        `volume=${board.narrationGainDb}dB,adelay=${delay}|${delay}[line${index}]`,
    );
    mixed.push(`[line${index}]`);
  });
  inputs.push('-stream_loop', '-1', '-i', music.file);
  const endDelay = Math.round(endStart * 1000);
  graph.push(
    `[${spoken.length + 1}:a]atrim=0:${seconds(endLength)},` +
      `aresample=48000,aformat=channel_layouts=stereo,volume=${music.gainDb}dB,` +
      `afade=t=in:st=0:d=${music.fadeInSeconds},` +
      `afade=t=out:st=${seconds(endLength - music.fadeOutSeconds)}:d=${music.fadeOutSeconds},` +
      `adelay=${endDelay}|${endDelay}[theme]`,
  );
  mixed.push('[theme]');
  graph.push(
    `${mixed.join('')}amix=inputs=${mixed.length}:normalize=0:duration=first[a]`,
  );
  const mix = join(WORK, 'mix.wav');
  ffmpeg(
    [
      inputs,
      ['-filter_complex', graph.join(';')],
      ['-map', '[a]', '-c:a', 'pcm_f32le', mix],
    ].flat(),
  );

  // Brought to the loudness the earlier cuts had, which is also what video
  // sites play at, with the peaks held under the ceiling. The picture is set to
  // an even 30 frames a second again after the joins.
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
  const chapterLines = chapters.map(({ start, name }, index) => {
    const next = chapters[index + 1]?.start ?? endStart;
    if (next - start < CHAPTER_MIN)
      console.warn(
        `chapter "${name}" is ${(next - start).toFixed(1)} s, under YouTube's ${CHAPTER_MIN} s`,
      );
    return `${stamp(index === 0 ? 0 : start)} ${name}`;
  });
  writeFileSync(join(OUT, 'chapters.txt'), `${chapterLines.join('\n')}\n`);

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

  const words = spoken.map(({ line, start }) => `${stamp(start)} ${line}`);
  console.log(`${VIDEO}: ${total.toFixed(1)} s`);
  console.log(chapterLines.join('\n'));
  console.log(`narration:\n${words.join('\n')}`);
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
