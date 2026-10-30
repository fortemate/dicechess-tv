import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import type { Activity } from '../../native/src/activity';
import { SettingsPanel } from '../../native/src/SettingsPanel';
import { useRemoteInput } from '../../native/src/useRemoteInput';
import { createSoundPreferences, SETTINGS_STORE } from './soundPreferences';
import { createGamePreferences } from './gamePreferences';
import { createStore } from './store';
import { RemoteSurface } from './RemoteSurface';

const rows = [
  'sounds',
  'highlights',
  'auto-select',
  'play-as',
  'turn-board',
] as const;

const report = (event: string, detail: unknown) =>
  console.info('[AndroidSettings] ' + JSON.stringify({ event, detail }));
/** Open independent preference stores, reporting read failures without clearing saved values. */
function open() {
  try {
    return {
      preferences: createSoundPreferences(createStore(SETTINGS_STORE)),
      gamePreferences: createGamePreferences(createStore(SETTINGS_STORE)),
      error: '',
    };
  } catch (error) {
    report('load-error', String(error));
    return { preferences: null, error: String(error) };
  }
}
/** Render persisted preferences and route each remote event through the latest synchronous row selection. */
function Content({ onExit }: { onExit: () => void }) {
  const [opened] = useState(open);
  const [sound, setSound] = useState(() => opened.preferences?.read());
  const [game, setGame] = useState(() => opened.gamePreferences?.read());
  const [index, setIndex] = useState(0);
  const selectedRow = useRef(0);
  const [error, setError] = useState(opened.error);
  useRemoteInput(
    useCallback(
      (key) => {
        if (key === 'back' || key === 'menu') return onExit();
        if (!opened.preferences || error) return;
        try {
          if (key === 'up' || key === 'down') {
            selectedRow.current =
              (selectedRow.current + (key === 'up' ? rows.length - 1 : 1)) %
              rows.length;
            setIndex(selectedRow.current);
            return;
          }
          const row = rows[selectedRow.current];
          if (row === 'sounds') setSound(opened.preferences.press(key));
          else if (opened.gamePreferences)
            setGame(opened.gamePreferences.press(row, key));
        } catch (failure) {
          setError(String(failure));
          report('save-error', String(failure));
        }
      },
      [opened, error, onExit],
    ),
    {
      onBack: () => {
        onExit();
        return true;
      },
    },
  );
  useEffect(() => {
    report('state', { sound, ...game, index, error });
  }, [sound, game, index, error]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 56 }}>
      {error ? (
        <Text style={{ color: '#ffffff', fontSize: 22 }}>
          Settings could not be saved or loaded. Back: return.
        </Text>
      ) : (
        <SettingsPanel
          settings={{ sound, ...game }}
          only={rows}
          index={index}
        />
      )}
      <Text style={{ color: '#aab8c9', fontSize: 20, marginTop: 24 }}>
        Back: return
      </Text>
    </View>
  );
}
/** Own native remote focus while the shared Settings panel is visible. */
export function Settings({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: () => void;
}) {
  return (
    <RemoteSurface activity={activity} label="Settings">
      <Content onExit={onExit} />
    </RemoteSurface>
  );
}
