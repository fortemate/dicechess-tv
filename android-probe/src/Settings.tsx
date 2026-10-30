import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import type { Activity } from '../../native/src/activity';
import { SettingsPanel } from '../../native/src/SettingsPanel';
import { useRemoteInput } from '../../native/src/useRemoteInput';
import { createSoundPreferences, SETTINGS_STORE } from './soundPreferences';
import { createStore } from './store';
import { RemoteSurface } from './RemoteSurface';

const report = (event: string, detail: unknown) =>
  console.info('[AndroidSettings] ' + JSON.stringify({ event, detail }));
function open() {
  try {
    return {
      preferences: createSoundPreferences(createStore(SETTINGS_STORE)),
      error: '',
    };
  } catch (error) {
    report('load-error', String(error));
    return { preferences: null, error: String(error) };
  }
}
function Content({ onExit }: { onExit: () => void }) {
  const [opened] = useState(open);
  const [sound, setSound] = useState(() => opened.preferences?.read());
  const [error, setError] = useState(opened.error);
  useRemoteInput(
    useCallback(
      (key) => {
        if (key === 'back' || key === 'menu') return onExit();
        if (!opened.preferences || error) return;
        try {
          setSound(opened.preferences.press(key));
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
    report('state', { sound, error });
  }, [sound, error]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 56 }}>
      {error ? (
        <Text style={{ color: '#ffffff', fontSize: 22 }}>
          Sound settings could not be saved or loaded. Back: return.
        </Text>
      ) : (
        <SettingsPanel settings={{ sound }} only={['sounds']} index={0} />
      )}
      <Text style={{ color: '#aab8c9', fontSize: 20, marginTop: 24 }}>
        Back: return
      </Text>
    </View>
  );
}
export function Settings({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: () => void;
}) {
  return (
    <RemoteSurface activity={activity} label="Sound settings">
      <Content onExit={onExit} />
    </RemoteSurface>
  );
}
