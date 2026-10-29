import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { createActivity } from '../../native/src/activity';
import { Diagnostics } from './Diagnostics';
import { GameScreen } from './GameScreen';
import { RulesReference } from './RulesReference';
import { LearnToPlay } from './LearnToPlay';
import { About } from './About';
import { HomeScreen } from './HomeScreen';
import type { HomeItem } from './homeMenu';

export default function App() {
  const [activity] = useState(() =>
    createActivity(AppState.currentState === 'active'),
  );
  const [route, setRoute] = useState<
    HomeItem['action'] | { kind: 'diagnostics' } | null
  >(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const open = (url: string | null) => {
      if (mounted && url === 'dicechess-probe://diagnostics')
        setRoute({ kind: 'diagnostics' });
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
  if (!ready) return null;
  if (route?.kind === 'diagnostics')
    return <Diagnostics activity={activity} onExit={goHome} />;
  if (route?.kind === 'rules')
    return <RulesReference activity={activity} onExit={goHome} />;
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
}
