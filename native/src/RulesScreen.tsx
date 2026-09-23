// The rules guide: topics on the left, the chosen one on the right.
//
// One level of navigation, because a remote makes every extra level expensive.
// Up and down move between topics and the text changes as they do, so nothing
// has to be opened and closed. Back leaves.
//
// The shape follows what the Chess Hero beta does well — a reference split into
// short named topics rather than one long page. The content does not: theirs
// describes their game, and this is checked against our engine in
// test/rules.test.ts.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { RULES } from '../../src/core/rules';
import type { BoardKey } from '../../src/core/boardInput';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';

export type RulesScreenProps = {
  onExit: () => void;
  onState?: (report: string) => void;
};

type State = { index: number; exit: boolean };

const reducer = (state: State, key: BoardKey): State => {
  if (state.exit) return state;
  if (key === 'back' || key === 'select') return { ...state, exit: true };
  if (key === 'left' || key === 'right') return state;
  const step = key === 'up' ? -1 : 1;
  return {
    ...state,
    index: (state.index + step + RULES.length) % RULES.length,
  };
};

export const RulesScreen = ({ onExit, onState }: RulesScreenProps) => {
  const { height } = useWindowDimensions();
  const [state, onKey] = React.useReducer(reducer, { index: 0, exit: false });

  useRemoteInput(onKey as (key: BoardKey) => void, {
    onBack: () => {
      (onKey as (key: BoardKey) => void)('back');
      return true;
    },
  });

  React.useEffect(() => {
    if (state.exit) onExit();
  }, [state.exit, onExit]);

  const current = RULES[state.index];

  React.useEffect(() => {
    onState?.(`rules ${state.index + 1}/${RULES.length} | topic ${current.id}`);
  }, [onState, state.index, current.id]);

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: THEME.background,
        padding: 40,
      }}
    >
      <View style={{ width: '38%', paddingRight: 32 }}>
        <Text
          style={{
            color: '#8dc9b6',
            fontSize: 18,
            letterSpacing: 2,
            marginBottom: 14,
          }}
        >
          RULES
        </Text>
        {RULES.map((entry, i) => (
          <Text
            key={entry.id}
            style={{
              color: i === state.index ? THEME.cursor : '#aab8c9',
              fontSize: 24,
              marginBottom: 6,
            }}
          >
            {(i === state.index ? '> ' : '  ') + entry.title}
          </Text>
        ))}
      </View>

      <View style={{ flex: 1, maxHeight: height - 80 }}>
        <Text style={{ color: '#f0f4f8', fontSize: 36, marginBottom: 18 }}>
          {current.title}
        </Text>
        {current.lines.map((line) => (
          <Text
            key={line}
            style={{ color: '#d7dce5', fontSize: 24, marginBottom: 12 }}
          >
            {line}
          </Text>
        ))}
        <Text style={{ color: '#98a9ba', fontSize: 20, marginTop: 20 }}>
          Arrows: another topic · Back: return
        </Text>
      </View>
    </View>
  );
};
