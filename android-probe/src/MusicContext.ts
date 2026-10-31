import React from 'react';
import { lateMusic } from '../../native/src/lateAudio';
import {
  DEFAULT_MUSIC,
  type MusicSetting,
} from '../../native/src/musicSetting';
/** Stable music control plus the setting currently applied to the app. */
export const MusicContext = React.createContext({
  music: lateMusic(),
  setting: DEFAULT_MUSIC,
  apply: (_setting: MusicSetting) => {
    void _setting;
  },
});
