// The characters' faces: Rolly, Grabby and Rampage, the opponents, Prowla
// the cat, a Hot Seat host (#258), and Thinkle the wizard, who teaches the
// tutorial (#264), drawn for Dice Chess (fortemate/dicechess-assets#31), each a
// circle in an ivory rim. An opponent without its portrait shows the RhosGFX
// emoji face the game showed before them; Prowla and Thinkle, who have no such
// face, leave their place empty.
//
// The portraits are for Fortemate's Dice Chess apps only and stay out of this
// repository while it is public. scripts/vendor-portraits.mjs copies them from
// the asset repository into portraits/, which git ignores, and the build ships
// them under assets/portraits/<version>/, which is /pkg/assets/portraits/ on
// the device.
// A checkout without them builds a game that shows the emoji faces: a portrait
// that does not load gives way to the face, so nothing else has to know.
import React from 'react';
import { Image, View } from 'react-native';
import type { BotMode } from '../../src/core/game';
import { FACES, type FaceId } from './faces';

// The characters the game shows, by their ids in the asset pack: the
// opponents in PORTRAIT_OF, the Hot Seat hosts (src/hostSetting.ts) and
// Thinkle, who teaches the tutorial (src/Teacher.tsx). The build ships the
// portraits of these characters and no others (#262), reading this list from
// the source as it reads PORTRAITS_VERSION. A portrait drawn for anyone else
// does not type-check, and test/assets.test.ts fails for a character here that
// no screen shows.
export const CHARACTERS = [
  'rolly',
  'grabby',
  'rampage',
  'cat',
  'thinkle',
] as const;
export type CharacterId = (typeof CHARACTERS)[number];

// Each opponent's emoji face, from RhosGFX's Vector Emojis (CC0).
export const FACE_OF: Readonly<Record<BotMode, FaceId>> = {
  random: 'zany-face',
  greedy: 'money-mouth-face',
  aggressive: 'smiling-face-with-horns',
};

// Each opponent's portrait.
export const PORTRAIT_OF: Readonly<Record<BotMode, CharacterId>> = {
  random: 'rolly',
  greedy: 'grabby',
  aggressive: 'rampage',
};

// The face a character shows when the build has no portraits.
const FALLBACK_FACE: Readonly<Partial<Record<CharacterId, FaceId>>> =
  Object.fromEntries(
    (Object.keys(PORTRAIT_OF) as BotMode[]).map((mode) => [
      PORTRAIT_OF[mode],
      FACE_OF[mode],
    ]),
  );

// The badge in the game's header and the opponent card have a file each, drawn
// for their size: 38 and 112 dp are 76 and 224 pixels at 1080p, and the files
// leave room for a 4K set.
export type PortraitKind = 'badge' | 'card';
const FILE: Readonly<Record<PortraitKind, string>> = {
  badge: 'badge-128',
  card: 'card-336',
};
// The version of the pack the build ships, which scripts/generate-assets.mjs
// puts in the path. A changed portrait therefore never shows the old one: on the
// Vega Virtual Device an update left the earlier package's portraits in place
// (2026-10-03). The build refuses a vendored pack of any other version, since
// its portraits would never load. 1.3.1 added Prowla the cat; 1.4.0 adds
// Thinkle's vector, which only the splash uses (scripts/splash.mjs).
export const PORTRAITS_VERSION = '1.4.0';

// An image needs the file:// URL. The bare /pkg/ path the sound players use
// fails to load in Image: on the Vega Virtual Device on 2026-10-03 the badge
// fell back to the emoji face with it, and showed the portrait with this one.
const ROOT = `file:///pkg/assets/portraits/${PORTRAITS_VERSION}`;

export const portraitPath = (
  character: CharacterId,
  kind: PortraitKind,
): string => `${ROOT}/${character}-${FILE[kind]}.png`;

export function Portrait({
  character,
  kind,
  size,
  onMissing,
}: {
  character: CharacterId;
  kind: PortraitKind;
  size: number;
  // Told when the portrait does not load, which means the build has none.
  onMissing?: () => void;
}) {
  const [missing, setMissing] = React.useState(false);
  if (missing) {
    const face = FALLBACK_FACE[character];
    if (!face)
      return (
        <View
          testID={`portrait-missing-${character}`}
          style={{ width: size, height: size }}
        />
      );
    const Face = FACES[face];
    return <Face size={size} />;
  }
  return (
    <Image
      testID={`portrait-${character}`}
      source={{ uri: portraitPath(character, kind) }}
      style={{ width: size, height: size }}
      fadeDuration={0}
      onError={() => {
        setMissing(true);
        onMissing?.();
      }}
    />
  );
}
