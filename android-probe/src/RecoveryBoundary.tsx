import React, { useContext, useState } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { GameBoundary, type Recovery } from '../../native/src/Recovery';
import { safeInsets } from '../../native/src/layout';
import type { Activity } from '../../native/src/activity';
import type { KeyValueStore } from '../../native/src/keyValueStore';
import { RemoteSurface } from './RemoteSurface';
import { MusicContext } from './MusicContext';
import { GAME_STORE } from './gameSession';
import { createStore } from './store';
import { recoverCurrentGame } from './recovery';

const openCurrentStore = () => createStore(GAME_STORE);
const report = (event: string, detail: unknown) =>
  console.info('[AndroidRecovery] ' + JSON.stringify({ event, detail }));

/** Keep Vega's fallback usable after child input, speech, effects and workers unmount. */
export function RecoveryBoundary({
  activity,
  onFailure,
  onRecover,
  children,
  openStore = openCurrentStore,
}: {
  activity: Activity;
  onFailure(): void;
  onRecover(): void;
  children: React.ReactNode;
  openStore?: () => KeyValueStore;
}) {
  const { music } = useContext(MusicContext);
  const [attempt, setAttempt] = useState(0);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);
  const [error, setError] = useState('');
  const { width, height } = useWindowDimensions();
  const insets = safeInsets(width, height);
  /** Stop the app-lifetime music while React disposes the failed screen's services. */
  const failed = (failure: unknown) => {
    music.setRole(null);
    music.setSuspended(true);
    onFailure();
    report('error', String(failure));
  };
  /** Return home after the chosen storage action succeeds, or leave the fallback retryable. */
  const recover = (choice: Recovery) => {
    try {
      if (choice === 'fresh') recoverCurrentGame(openStore(), choice);
    } catch (failure) {
      report('reset-error', String(failure));
      setError(
        'Could not reset the saved game. Try again or return to the menu.',
      );
      setFallbackAttempt((n) => n + 1);
      return;
    }
    setError('');
    music.setRole('menu');
    music.setSuspended(!activity.isActive());
    onRecover();
    setAttempt((n) => n + 1);
    report('recovered', choice);
  };
  return (
    <GameBoundary
      key={attempt}
      onError={failed}
      onRecover={recover}
      onState={(line) => report('state', line)}
      renderFallback={(screen) => (
        <RemoteSurface
          key={fallbackAttempt}
          activity={activity}
          label="Game recovery"
        >
          {screen}
          {error ? (
            <Text
              style={{
                color: '#ffffff',
                fontSize: 20,
                paddingHorizontal: insets.x,
                paddingBottom: insets.y,
              }}
            >
              {error}
            </Text>
          ) : null}
        </RemoteSurface>
      )}
    >
      {children}
    </GameBoundary>
  );
}
