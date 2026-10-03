// The opponents' faces: Rolly, Grabby and Rampage drawn for Dice Chess
// (fortemate/dicechess-assets#31), each a circle in an ivory rim, or the
// RhosGFX emoji face the game showed before them.
//
// The portraits are for Fortemate's Dice Chess apps only and stay out of this
// repository while it is public. scripts/vendor-portraits.mjs copies them from
// the asset repository into portraits/, which git ignores, and the build ships
// them under assets/portraits/<version>/, which is /pkg/assets/portraits/ on
// the device.
// A checkout without them builds a game that shows the emoji faces: a portrait
// that does not load gives way to the face, so nothing else has to know.
import React from 'react';
import { Image } from 'react-native';
import type { BotMode } from '../../src/core/game';
import { FACES, type FaceId } from './faces';

// Each opponent's emoji face, from RhosGFX's Vector Emojis (CC0).
export const FACE_OF: Readonly<Record<BotMode, FaceId>> = {
  random: 'zany-face',
  greedy: 'money-mouth-face',
  aggressive: 'smiling-face-with-horns',
};

// Each opponent's portrait, by the character's id in the asset pack.
export const PORTRAIT_OF: Readonly<Record<BotMode, string>> = {
  random: 'rolly',
  greedy: 'grabby',
  aggressive: 'rampage',
};

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
// (2026-10-03). test/assets.test.ts checks it against the vendored lock.
export const PORTRAITS_VERSION = '1.0.0';

// An image needs the file:// URL. The bare /pkg/ path the sound players use
// fails to load in Image: on the Vega Virtual Device on 2026-10-03 the badge
// fell back to the emoji face with it, and showed the portrait with this one.
const ROOT = `file:///pkg/assets/portraits/${PORTRAITS_VERSION}`;

export const portraitPath = (mode: BotMode, kind: PortraitKind): string =>
  `${ROOT}/${PORTRAIT_OF[mode]}-${FILE[kind]}.png`;

export function Portrait({
  mode,
  kind,
  size,
  onMissing,
}: {
  mode: BotMode;
  kind: PortraitKind;
  size: number;
  // Told when the portrait does not load, which means the build has none.
  onMissing?: () => void;
}) {
  const [missing, setMissing] = React.useState(false);
  if (missing) {
    const Face = FACES[FACE_OF[mode]];
    return <Face size={size} />;
  }
  return (
    <Image
      testID={`portrait-${PORTRAIT_OF[mode]}`}
      source={{ uri: portraitPath(mode, kind) }}
      style={{ width: size, height: size }}
      fadeDuration={0}
      onError={() => {
        setMissing(true);
        onMissing?.();
      }}
    />
  );
}
