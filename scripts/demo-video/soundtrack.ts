// Music follows the edit as a whole. Picture cuts and cards never restart it.
// Game voices and effects are the app's assets, synchronized to the recorded
// events so the music baked into separate takes need not be spliced together.
export type RecordedSound = {
  at: number; // Absolute time in the source take, not time in the finished edit.
  line?: string;
  file?: string;
  gainDb?: number;
};

export type MusicChange = {
  role: string;
  scene: string;
  clip?: number; // Omit to start at the scene's card.
  at?: number; // Absolute time in that clip's take; defaults to its first frame.
};

export type Soundtrack = {
  gainDb: number;
  crossfadeSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  changes: MusicChange[];
};

export type ClipTiming = {
  take: string;
  from: number;
  to: number;
  start: number;
  end: number;
  audio?: RecordedSound[];
};

export type SceneTiming = {
  name: string;
  start: number;
  clips: ClipTiming[];
};

export type MusicSpan = {
  role: string;
  start: number;
  end: number;
  fadeIn: number;
  fadeOut: number;
};

export function musicSpans(
  soundtrack: Soundtrack,
  scenes: SceneTiming[],
  total: number,
): MusicSpan[] {
  const { crossfadeSeconds, fadeInSeconds, fadeOutSeconds } = soundtrack;
  if (crossfadeSeconds <= 0 || fadeInSeconds <= 0 || fadeOutSeconds <= 0)
    throw new Error('soundtrack fades must be positive');
  const changes = soundtrack.changes.map(({ role, scene, clip, at }) => {
    const matches = scenes.filter(({ name }) => name === scene);
    if (matches.length !== 1)
      throw new Error(`music: expected one scene named ${scene}`);
    const timing = matches[0];
    if (clip === undefined) {
      if (at !== undefined)
        throw new Error(`music: ${scene} needs a clip for at`);
      return { role, start: timing.start };
    }
    const source = timing.clips[clip];
    if (!source) throw new Error(`music: ${scene} has no clip ${clip}`);
    const position = at ?? source.from;
    if (position < source.from || position >= source.to)
      throw new Error(`music: ${scene} transition lies outside its clip`);
    return { role, start: source.start + position - source.from };
  });
  if (!changes.length || changes[0].start !== 0)
    throw new Error('music must start with the first frame');
  return changes.map(({ role, start }, index) => {
    const next = changes[index + 1];
    const fadeIn = index === 0 ? fadeInSeconds : crossfadeSeconds;
    const fadeOut = next ? crossfadeSeconds : fadeOutSeconds;
    const end = next ? next.start + crossfadeSeconds : total;
    if (next && next.start <= start)
      throw new Error('music transitions must be in chronological order');
    if (end > total || end - start < fadeIn + fadeOut)
      throw new Error(`music: ${role} is too short for its fades`);
    return { role, start, end, fadeIn, fadeOut };
  });
}

export type SoundAsset = { file: string; seconds: number };
export type PlacedSound = SoundAsset & {
  start: number;
  gainDb: number;
  voice: boolean;
};

export function recordedSounds(
  scenes: SceneTiming[],
  lines: Map<string, SoundAsset>,
  duration: (file: string) => number,
): PlacedSound[] {
  return scenes.flatMap(({ name, clips }) =>
    clips.flatMap((clip) =>
      (clip.audio ?? []).map(({ at, line, file, gainDb }) => {
        if ((line === undefined) === (file === undefined))
          throw new Error(
            `${name}: a sound needs either a voice line or a file`,
          );
        const asset = line
          ? lines.get(line)
          : { file: file as string, seconds: duration(file as string) };
        if (!asset) throw new Error(`${name}: no voice asset for ${line}`);
        if (at < clip.from || at >= clip.to)
          throw new Error(`${name}: ${line ?? file} starts outside its clip`);
        if (line && at + asset.seconds > clip.to + 0.05)
          throw new Error(`${name}: the edit cuts off ${line}`);
        return {
          ...asset,
          seconds: Math.min(asset.seconds, clip.to - at),
          start: clip.start + at - clip.from,
          gainDb: gainDb ?? 0,
          voice: line !== undefined,
        };
      }),
    ),
  );
}

// Check the encoded export, not just the planned filter graph. Only the
// intentional opening and closing fades may contain sustained silence.
export function unexpectedSilence(
  log: string,
  total: number,
  fadeIn: number,
  fadeOut: number,
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  let start: number | undefined;
  for (const match of log.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    const at = Number(match[2]);
    if (match[1] === 'start') start = at;
    else if (start !== undefined) {
      gaps.push({ start, end: at });
      start = undefined;
    }
  }
  if (start !== undefined) gaps.push({ start, end: total });
  return gaps.filter(
    ({ start, end }) =>
      !(start <= 0.1 && end <= fadeIn + 0.1) &&
      !(start >= total - fadeOut - 0.1 && end >= total - 0.1),
  );
}
