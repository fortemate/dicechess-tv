import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { Activity } from '../../native/src/activity';
import type { Catalogue } from '../../native/src/audio';
import { musicControl } from './musicControl';
import { createMusic, loadCatalogue } from '../../native/src/musicEngine';
import {
  DEFAULT_MUSIC,
  musicGain,
  musicHeard,
  type MusicSetting,
} from '../../native/src/musicSetting';
import { musicPlayer } from './musicPlayer';
import { readAndroidMusic } from './musicPreferences';
import { createStore } from './store';
import { SETTINGS_STORE } from './soundPreferences';
const bundle = require('../assets/music-assets') as {
  assets: Record<string, number>;
  catalogue: Catalogue;
};
const report = (event: string, detail: unknown) =>
  console.info(
    '[AndroidMusic] ' + JSON.stringify({ event, detail, at: Date.now() }),
  );
/** Own music for the app lifetime, applying initial preferences before any catalogue can play. */
export function useAndroidMusic(activity: Activity) {
  const [music] = useState(musicControl);
  const [setting, setSetting] = useState<MusicSetting>({
    ...DEFAULT_MUSIC,
    on: false,
  });
  const apply = useCallback(
    (next: MusicSetting) => {
      music.setVolume(musicGain(next.volume));
      music.setEnabled(musicHeard(next));
      setSetting(next);
      report('setting', next);
    },
    [music],
  );
  useEffect(() => {
    let owned: ReturnType<typeof createMusic> | undefined;
    let unsubscribe: (() => void) | undefined;
    try {
      const initial = readAndroidMusic(createStore(SETTINGS_STORE));
      const configuration = setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
      });
      void configuration.catch((error) => report('error', String(error)));
      owned = createMusic({
        root: 'android-music',
        report: (line) => report('engine', line),
        createPlayer: () =>
          musicPlayer({
            configure: () => configuration,
            create(file) {
              const source = bundle.assets[file.replace('android-music/', '')];
              if (source === undefined)
                throw new Error(`Missing packaged music: ${file}`);
              return createAudioPlayer(source, { updateInterval: 50 });
            },
            report,
          }),
      });
      owned.setSuspended(!activity.isActive());
      owned.setVolume(musicGain(initial.volume));
      owned.setEnabled(musicHeard(initial));
      music.attach(owned);
      setSetting(initial);
      void loadCatalogue('android-music', async () => ({
        ok: true,
        json: async () => bundle.catalogue,
      })).then((catalogue) => owned?.setCatalogue(catalogue));
      unsubscribe = activity.subscribe(() => {
        const suspended = !activity.isActive();
        owned?.setSuspended(suspended);
        report('suspended', suspended);
      });
    } catch (error) {
      owned?.dispose();
      music.attach(null);
      report('error', String(error));
    }
    return () => {
      unsubscribe?.();
      music.attach(null);
      owned?.dispose();
    };
  }, [activity, music]);
  return useMemo(() => ({ music, setting, apply }), [music, setting, apply]);
}
