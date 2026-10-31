import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { createActivity } from '../../native/src/activity';
import { Diagnostics } from './Diagnostics';
import { GameScreen } from './GameScreen';
import { RulesReference } from './RulesReference';
import { LearnToPlay } from './LearnToPlay';
import { Settings } from './Settings';
import { About } from './About';
import { HomeScreen } from './HomeScreen';
import { useAndroidMusic } from './useAndroidMusic';
import { MusicContext } from './MusicContext';
import { RecoveryBoundary } from './RecoveryBoundary';
import { FirstLaunch } from './FirstLaunch';
import type { HomeItem } from './homeMenu';

/** Explicit engineering fault link exercises a real render failure without modifying saved data. */
function RecoveryFault(): React.ReactElement {
  throw new Error('Requested diagnostic render failure');
}

/** Own route recovery and app-lifetime music while keeping platform lifecycle subscriptions stable. */
export default function App() {
  const [activity] = useState(() =>
    createActivity(AppState.currentState === 'active'),
  );
  const music = useAndroidMusic(activity);
  const [route, setRoute] = useState<
    HomeItem['action'] | { kind: 'diagnostics' } | null
  >(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [fault, setFault] = useState(false);
  useEffect(() => {
    let mounted = true;
    /** Accept only explicit engineering links; ordinary launches keep the current route. */
    const open = (url: string | null) => {
      if (mounted && url === 'dicechess-probe://diagnostics')
        setRoute({ kind: 'diagnostics' });
      if (mounted && url === 'dicechess-probe://diagnostics/recovery')
        setFault(true);
    };
    const link = Linking.addEventListener('url', ({ url }) => open(url));
    void Linking.getInitialURL()
      .then(open)
      .catch(() => {})
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      link.remove();
    };
  }, []);
  const homeFocus = useRef<string | undefined>(undefined);
  const goHome = useCallback(() => setRoute(null), []);
  useEffect(() => {
    const state = AppState.addEventListener('change', (value) =>
      activity.setActive(value === 'active'),
    );
    const blur = AppState.addEventListener('blur', () =>
      activity.setActive(false),
    );
    const focus = AppState.addEventListener('focus', () =>
      activity.setActive(AppState.currentState === 'active'),
    );
    return () => {
      state.remove();
      blur.remove();
      focus.remove();
      activity.setActive(false);
    };
  }, [activity]);
  useEffect(() => {
    if (recovering) {
      music.music.setRole(null);
      music.music.setSuspended(true);
    } else if (route?.kind !== 'game') music.music.setRole('menu');
  }, [route?.kind, music.music, recovering]);
  const screen = () => {
    if (!ready) return null;
    if (route?.kind === 'diagnostics')
      return <Diagnostics activity={activity} onExit={goHome} />;
    if (route?.kind === 'rules')
      return <RulesReference activity={activity} onExit={goHome} />;
    if (route?.kind === 'settings')
      return <Settings activity={activity} onExit={goHome} />;
    if (route?.kind === 'about')
      return <About activity={activity} onExit={goHome} />;
    if (route?.kind === 'tutorial')
      return (
        <LearnToPlay
          activity={activity}
          onExit={(choice) =>
            setRoute(
              choice
                ? {
                    kind: 'game',
                    mode: choice.mode === 'hotseat' ? 'hotseat' : 'bot',
                    intent: { kind: 'tutorial', choice },
                  }
                : null,
            )
          }
        />
      );
    if (route?.kind === 'game')
      return (
        <GameScreen
          activity={activity}
          onExit={goHome}
          mode={route.mode}
          intent={route.intent}
        />
      );
    return (
      <HomeScreen
        activity={activity}
        initialFocus={homeFocus.current}
        onChoose={(item) => {
          homeFocus.current = item.id;
          setRoute(item.action);
        }}
      />
    );
  };
  return (
    <MusicContext.Provider value={music}>
      <RecoveryBoundary
        activity={activity}
        onFailure={() => setRecovering(true)}
        onRecover={() => {
          setFault(false);
          setRecovering(false);
          homeFocus.current = undefined;
          goHome();
        }}
      >
        {fault ? (
          <RecoveryFault />
        ) : ready ? (
          <FirstLaunch
            activity={activity}
            enabled={route === null}
            onLearn={() => setRoute({ kind: 'tutorial' })}
          >
            {screen()}
          </FirstLaunch>
        ) : null}
      </RecoveryBoundary>
    </MusicContext.Provider>
  );
}
