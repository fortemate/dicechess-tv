import { useContext, useEffect, useRef } from 'react';
import { newGame } from '../../src/core/game';
import { musicRole, type ScreenState } from '../../native/src/screen';
import { useDanger } from '../../native/src/useDanger';
import { RESULT_SILENCE_MS, type MusicRole } from '../../native/src/audio';
import { musicHeard } from '../../native/src/musicSetting';
import { MusicContext } from './MusicContext';
const fallback = newGame('hotseat', 'music-placeholder');
const background = (run: () => void) => {
  const timer = setTimeout(run, 0);
  return () => clearTimeout(timer);
};
/** Apply Vega's role selection and result-jingle gap without writing gameplay state. */
export function useGameMusic(state: ScreenState | undefined) {
  const { music, setting } = useContext(MusicContext);
  const level = useDanger(
    state?.game ?? fallback,
    background,
    Boolean(state) && musicHeard(setting),
  );
  const last = useRef<MusicRole | null>(null);
  useEffect(() => {
    const role = state ? musicRole(state.overlay, state.game, level) : 'menu';
    if (last.current === role) return;
    const ended =
      state?.game.phase === 'ended' &&
      last.current !== null &&
      last.current !== 'menu';
    last.current = role;
    music.setRole(role, ended ? RESULT_SILENCE_MS : 0);
    console.info(
      '[AndroidMusic] ' +
        JSON.stringify({
          event: 'role',
          at: Date.now(),
          detail: { role, pauseMs: ended ? RESULT_SILENCE_MS : 0 },
        }),
    );
  }, [state, level, music]);
  return level;
}
