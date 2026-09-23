// The About screen: who made what the player sees.
//
// It exists because a licence requires it. The sound pack's licence asks for
// visible credit, and the asset repository asks every client to show it on an
// About or Licenses screen. So this is a place a viewer can actually reach with
// a remote, not a file in the source.
//
// One page, nothing to navigate. OK or Back leaves.
import React from 'react';
import { View, Text } from 'react-native';
import { APP, CREDITS } from '../../src/core/credits';
import type { BoardKey } from '../../src/core/boardInput';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';

export type AboutScreenProps = {
  onExit: () => void;
  onState?: (report: string) => void;
};

export const AboutScreen = ({ onExit, onState }: AboutScreenProps) => {
  // Leaving is decided once. A second press arriving before the parent has
  // swapped this screen out must not leave twice.
  const [leaving, leave] = React.useReducer(
    (done: boolean, key: BoardKey) =>
      done || key === 'select' || key === 'back',
    false,
  );

  useRemoteInput(leave, {
    onBack: () => {
      leave('back');
      return true;
    },
  });

  React.useEffect(() => {
    if (leaving) onExit();
  }, [leaving, onExit]);

  React.useEffect(() => {
    onState?.(`about | credits ${CREDITS.length}`);
  }, [onState]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.background,
        paddingHorizontal: 56,
        paddingVertical: 40,
      }}
    >
      <Text
        style={{
          color: '#8dc9b6',
          fontSize: 18,
          letterSpacing: 2,
          marginBottom: 14,
        }}
      >
        ABOUT
      </Text>
      <Text style={{ color: '#f0f4f8', fontSize: 36 }}>{APP.title}</Text>
      <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 28 }}>
        {APP.maker}
      </Text>

      {CREDITS.map((credit) => (
        <View key={credit.subject} style={{ marginBottom: 20 }}>
          <Text style={{ color: '#8dc9b6', fontSize: 18, letterSpacing: 1 }}>
            {credit.subject}
          </Text>
          <Text style={{ color: '#f0f4f8', fontSize: 24 }}>{credit.line}</Text>
          <Text style={{ color: '#aab8c9', fontSize: 18 }}>
            {`${credit.licence} · ${credit.source}`}
          </Text>
        </View>
      ))}

      <Text style={{ color: '#98a9ba', fontSize: 20, marginTop: 'auto' }}>
        OK or Back: return
      </Text>
    </View>
  );
};
