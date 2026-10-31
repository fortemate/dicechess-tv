// Vega factory for the shared adaptive music engine. Native media stays at this boundary.
import {
  AudioPlayer,
  AudioContentType,
  AudioUsageType,
} from '@amazon-devices/react-native-w3cmedia';
import {
  createMusic as createEngine,
  type MusicOptions as EngineOptions,
} from './musicEngine';
export * from './musicEngine';
export type MusicOptions = Omit<EngineOptions, 'createPlayer'> & {
  createPlayer?: EngineOptions['createPlayer'];
};
/** Keep Vega's existing factory and injected-player test API. */
export function createMusic({
  createPlayer = () =>
    new AudioPlayer(
      AudioContentType.CONTENT_TYPE_MUSIC,
      AudioUsageType.USAGE_GAME,
    ),
  ...options
}: MusicOptions = {}) {
  return createEngine({ ...options, createPlayer });
}
