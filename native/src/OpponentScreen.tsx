// The choice of local opponent (#115): one card each, side by side, walked with
// the arrows. A card shows the opponent's face, name and level, one line on how
// it plays, and the person's record against it, so the home screen need not.
//
// Like the menus, the screen only draws what the reducer in screen.ts says:
// the focused card and whether OK is held on it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { OPPONENTS, recordAgainst } from '../../src/core/opponents';
import type { Opponent } from '../../src/core/opponents';
import type { BotMode, Side } from '../../src/core/game';
import type { BotRecord, Ledger } from '../../src/core/ledger';
import { FACES, type FaceId } from './faces';
import { THEME } from './theme';
import { safeInsets } from './layout';

// Each opponent's face, from RhosGFX's Vector Emojis (CC0).
export const FACE_OF: Readonly<Record<BotMode, FaceId>> = {
  random: 'zany-face',
  greedy: 'money-mouth-face',
  aggressive: 'smiling-face-with-horns',
};

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;
const GAP = 24;

// The level as filled and empty rings, which read the same whatever the
// viewer's colour vision; the word beside them says it outright.
const Pips = ({ level }: { level: Opponent['level'] }) => {
  const filled = LEVELS.indexOf(level) + 1;
  return (
    <View style={{ flexDirection: 'row', marginLeft: 10 }}>
      {LEVELS.map((name, i) => (
        <View
          key={name}
          testID={i < filled ? 'pip-filled' : 'pip-empty'}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: '#f0f4f8',
            backgroundColor: i < filled ? '#f0f4f8' : 'transparent',
            marginRight: 6,
          }}
        />
      ))}
    </View>
  );
};

const line = (side: string, record: BotRecord): string =>
  `As ${side}: ${record.wins}W ${record.draws}D ${record.losses}L`;

// The record against one opponent, one line per side played.
export const recordLines = (
  sides: Partial<Record<Side, BotRecord>>,
): string[] => {
  const lines = [
    ...(sides.w ? [line('White', sides.w)] : []),
    ...(sides.b ? [line('Black', sides.b)] : []),
  ];
  return lines.length ? lines : ['Not played yet'];
};

const Card = ({
  opponent,
  width,
  focused,
  pressed,
  ledger,
}: {
  opponent: Opponent;
  width: number;
  focused: boolean;
  pressed: boolean;
  ledger?: Ledger;
}) => {
  const Face = FACES[FACE_OF[opponent.mode]];
  const fill = pressed ? THEME.pressedFill : THEME.focusFill;
  return (
    <View
      testID="opponent"
      style={{
        width,
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: focused ? THEME.cursor : '#2f4d66',
        backgroundColor: focused ? fill : 'transparent',
        alignItems: 'center',
        transform: [{ scale: focused && pressed ? 0.97 : 1 }],
      }}
    >
      <Face size={112} />
      <Text style={{ color: '#f0f4f8', fontSize: 32, marginTop: 10 }}>
        {opponent.name}
      </Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
      >
        <Text style={{ color: '#f0f4f8', fontSize: 22 }}>{opponent.level}</Text>
        <Pips level={opponent.level} />
      </View>
      <Text
        style={{
          color: '#aab8c9',
          fontSize: 20,
          textAlign: 'center',
          marginTop: 10,
          minHeight: 78,
        }}
      >
        {opponent.style}
      </Text>
      {recordLines(ledger ? recordAgainst(ledger, opponent.mode) : {}).map(
        (text) => (
          <Text key={text} style={{ color: '#8dc9b6', fontSize: 20 }}>
            {text}
          </Text>
        ),
      )}
    </View>
  );
};

export const OpponentScreen = ({
  index,
  pressed,
  ledger,
}: {
  // The focused card.
  index: number;
  // OK is held on it.
  pressed: boolean;
  ledger?: Ledger;
}) => {
  const { width, height } = useWindowDimensions();
  const insets = safeInsets(width, height);
  const card = Math.floor(
    (width - 2 * insets.x - GAP * (OPPONENTS.length - 1)) / OPPONENTS.length,
  );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.background,
        paddingHorizontal: insets.x,
        paddingVertical: insets.y,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#f0f4f8', fontSize: 38, marginBottom: 20 }}>
        Choose your opponent
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {OPPONENTS.map((opponent, i) => (
          <Card
            key={opponent.mode}
            opponent={opponent}
            width={card}
            focused={i === index}
            pressed={pressed}
            ledger={ledger}
          />
        ))}
      </View>
      <Text style={{ color: '#aab8c9', fontSize: 20, marginTop: 20 }}>
        Arrows: choose · OK: play · Back: return
      </Text>
    </View>
  );
};
