// The roll as three dice, as the other Dice Chess clients draw it: each face
// shows the piece it permits, in the colour of the side to move. An unspent die
// carries a ring; a spent one dims and shrinks, so it is told apart by more than
// colour. Before the roll the three slots are empty.
import React from 'react';
import { View } from 'react-native';
import type { Die } from '../../src/core/dice';
import type { Side } from '../../src/core/game';
import { PIECES } from './pieces';
import { THEME } from './theme';

export type DiceProps = {
  dice: readonly Die[];
  side: Side;
  // Edge of one face in dp. The default reads from a sofa next to the board.
  size?: number;
};

const Face = ({ die, side, size }: { die: Die; side: Side; size: number }) => {
  const letter = side === 'w' ? die.piece : die.piece.toLowerCase();
  const Piece = PIECES[letter as keyof typeof PIECES];
  const edge = die.spent ? Math.round(size * 0.86) : size;
  return (
    <View
      style={{
        width: edge,
        height: edge,
        borderRadius: Math.round(edge / 6),
        backgroundColor: THEME.die,
        borderWidth: die.spent ? 0 : Math.max(2, Math.round(size / 24)),
        borderColor: THEME.dieRing,
        opacity: die.spent ? 0.3 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Piece ? <Piece size={Math.round(edge * 0.72)} /> : null}
    </View>
  );
};

export const Dice = ({ dice, side, size = 72 }: DiceProps) => (
  <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 12 }}>
    {[0, 1, 2].map((slot) => (
      // A fixed slot for each die, so a die that shrinks moves nothing else.
      <View
        key={slot}
        style={{
          width: size,
          height: size,
          marginRight: Math.round(size / 4),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {dice[slot] ? (
          <Face die={dice[slot]} side={side} size={size} />
        ) : (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: Math.round(size / 6),
              borderWidth: 2,
              borderColor: THEME.dieSlot,
              opacity: 0.3,
            }}
          />
        )}
      </View>
    ))}
  </View>
);
