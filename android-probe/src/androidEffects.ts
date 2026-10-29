import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { CUE_FILES } from '../../native/src/cueFiles';
import type { Activity } from '../../native/src/activity';
import { EFFECT_ASSETS } from './effectAssets';
import { createEffects } from './effects';

export function createAndroidEffects(activity: Activity) {
  return createEffects(activity, {
    configure: () =>
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      }),
    create(cue) {
      const files = CUE_FILES[cue];
      const file = files[Math.floor(Math.random() * files.length)];
      const source = EFFECT_ASSETS[file];
      if (source === undefined)
        throw new Error(`Missing packaged effect: ${file}`);
      const player = createAudioPlayer(source, { updateInterval: 50 });
      player.volume = 0.5;
      return player;
    },
    report: (event, detail) =>
      console.info(`[AndroidEffects] ${JSON.stringify({ event, detail })}`),
  });
}
