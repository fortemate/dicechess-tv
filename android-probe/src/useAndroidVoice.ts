import { useEffect, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { Activity } from '../../native/src/activity';
import { lateSounds } from '../../native/src/lateAudio';
import { createSpeech } from './speech';
import { createStore } from './store';
import { SETTINGS_STORE } from './soundPreferences';
import { readAndroidVoices } from './voicePreferences';
// Generated only after every clip and license has passed its canonical hash check.
const assets = require('../assets/voice-assets') as {
  clips: Record<string, number>;
};
const report = (event: string, detail: unknown) =>
  console.info('[AndroidVoices] ' + JSON.stringify({ event, detail }));

/** Attach native speech after commit, retaining the tutorial's first pending line. */
export function useAndroidVoice(activity: Activity) {
  const [handle] = useState(lateSounds);
  useEffect(() => {
    try {
      const setting = readAndroidVoices(createStore(SETTINGS_STORE));
      const speech = createSpeech(
        activity,
        {
          configure: () =>
            setAudioModeAsync({
              playsInSilentMode: true,
              shouldPlayInBackground: false,
              interruptionMode: 'doNotMix',
            }),
          create(id, gain) {
            const source = assets.clips[id];
            if (source === undefined)
              throw new Error(`Missing packaged voice: ${id}`);
            const player = createAudioPlayer(source, { updateInterval: 50 });
            player.volume = gain;
            return player;
          },
          report,
        },
        setting,
      );
      // Effects have their own adapter; the shared late handle carries speech only.
      handle.attach({
        ...speech,
        play() {},
        setMuted() {},
        setSoundVolume() {},
      });
      return () => {
        handle.stopLine();
        handle.attach(null);
        speech.dispose();
      };
    } catch (error) {
      handle.setVoices(false);
      report('error', String(error));
    }
  }, [activity, handle]);
  return handle;
}
