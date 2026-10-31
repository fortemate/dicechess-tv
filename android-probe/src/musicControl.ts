import { lateMusic } from '../../native/src/lateAudio';
import type { MusicRole } from '../../native/src/audio';
/** Keep duplicate menu requests from canceling a result-jingle hold across routes. */
export function musicControl() {
  const handle = lateMusic();
  let role: MusicRole | null | undefined;
  return {
    ...handle,
    setRole(next: MusicRole | null, pauseMs = 0) {
      if (next === role && pauseMs === 0) return;
      role = next;
      handle.setRole(next, pauseMs);
    },
  };
}

/** Only this voice owner's playing/release events may change its music duck. */
export function speechDucking(setDucked: (on: boolean) => void) {
  let speaking = false;
  let disposed = false;
  return (event: string) => {
    if (disposed) return;
    if (event === 'playing' && !speaking) {
      speaking = true;
      setDucked(true);
    }
    if (['released', 'error', 'disposed'].includes(event) && speaking) {
      speaking = false;
      setDucked(false);
    }
    if (event === 'disposed') disposed = true;
  };
}
