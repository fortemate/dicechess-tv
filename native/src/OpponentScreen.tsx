// The choice of local opponent (#115): one card each, side by side, walked with
// the arrows. A card shows the opponent's face, name and level, and one line on
// how it plays. It shows no record against the opponent: the results are kept,
// but a count by side cannot tell who was holding the remote, and the people
// who play on one TV change from one evening to the next.
//
// Like the menus, the screen only draws what the reducer in screen.ts says:
// the focused card and whether OK is held on it.
import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { OPPONENTS } from '../../src/core/opponents';
import type { Opponent } from '../../src/core/opponents';
import { PORTRAIT_OF, Portrait } from './Portrait';
import { THEME } from './theme';
import { safeInsets } from './layout';

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

const Card = ({
  opponent,
  width,
  focused,
  pressed,
}: {
  opponent: Opponent;
  width: number;
  focused: boolean;
  pressed: boolean;
}) => {
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
      <Portrait character={PORTRAIT_OF[opponent.mode]} kind="card" size={112} />
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
    </View>
  );
};

export const OpponentScreen = ({
  index,
  pressed,
}: {
  // The focused card.
  index: number;
  // OK is held on it.
  pressed: boolean;
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
          />
        ))}
      </View>
      <Text style={{ color: '#aab8c9', fontSize: 20, marginTop: 20 }}>
        Arrows: choose · OK: play · Back: return
      </Text>
    </View>
  );
};
