import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createActivity } from '../../native/src/activity';
import { Diagnostics } from './Diagnostics';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import type { HomeItem } from './homeMenu';

export default function App() {
  const [activity] = useState(() =>
    createActivity(AppState.currentState === 'active'),
  );
  const [route, setRoute] = useState<HomeItem['action'] | null>(null);
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
  if (route?.kind === 'diagnostics')
    return <Diagnostics activity={activity} onExit={goHome} />;
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
