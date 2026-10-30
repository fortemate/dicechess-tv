import { type CharacterId, type PortraitKind } from '../../native/src/Portrait';
import type { ImageSourcePropType } from 'react-native';

// Static requires let Metro package local images for offline use.
const portraits: Record<
  CharacterId,
  Record<PortraitKind, ImageSourcePropType>
> = {
  rolly: {
    card: require('../assets/portraits/rolly-card-336.png'),
    badge: require('../assets/portraits/rolly-badge-128.png'),
  },
  grabby: {
    card: require('../assets/portraits/grabby-card-336.png'),
    badge: require('../assets/portraits/grabby-badge-128.png'),
  },
  rampage: {
    card: require('../assets/portraits/rampage-card-336.png'),
    badge: require('../assets/portraits/rampage-badge-128.png'),
  },
  cat: {
    card: require('../assets/portraits/cat-card-336.png'),
    badge: require('../assets/portraits/cat-badge-128.png'),
  },
  thinkle: {
    card: require('../assets/portraits/thinkle-card-336.png'),
    badge: require('../assets/portraits/thinkle-badge-128.png'),
  },
};
/** Resolve the pinned Android pack for the shared Vega portrait renderer. */
export const portraitSource = (character: CharacterId, kind: PortraitKind) =>
  portraits[character][kind];

// Keep the original distribution notice in the Metro asset bundle.
export const portraitNotice = require('../assets/portraits/NOTICE.txt');
