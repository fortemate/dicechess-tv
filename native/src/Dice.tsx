// The roll as three dice, as the other Dice Chess clients draw it: each face
// shows the piece it permits, in the colour of the side to move. An unspent die
// carries a ring; a spent one dims and shrinks, so it is told apart by more than
// colour. A die that no legal turn can spend loses its ring and dims but keeps
// its size: it was never played, and it will not be (#85, #140). Before the roll
// the three slots are empty.
//
// A roll tumbles in (#99): each die turns and grows onto its face, a beat after
// the one on its left, on the native driver. The dice tumble lit, and the ones
// no legal turn can spend dim as they land. It is presentation only: the roll is
// already made, and the remote is never held up. A roll thrown over dice still
// showing tumbles too: the person's, after the bot's roll with nothing to play.
// Dice that were there when the screen opened, such as a resumed game's, do not
// tumble; an action during the tumble ends it; and it is skipped when the
// platform asks for less motion.
import React from 'react';
import { Animated, Easing, View } from 'react-native';
import type { Die } from '../../src/core/dice';
import type { Side } from '../../src/core/game';
import { PIECES } from './pieces';
import { THEME } from './theme';
import { useReducedMotion } from './useReducedMotion';

export type DiceProps = {
  dice: readonly Die[];
  side: Side;
  // Edge of one face in dp. The default reads from a sofa next to the board.
  size?: number;
};

// How long one die tumbles, and how long after the die on its left it starts.
export const TUMBLE_MS = 200;
export const TUMBLE_STAGGER_MS = 30;
// From the roll until the last die lands: inside the TV guidance of #51, about
// 300 ms.
export const ROLL_MS = TUMBLE_MS + 2 * TUMBLE_STAGGER_MS;

// The turn each die makes on its way in, so that the three do not move in step.
const TURNS = ['-100deg', '80deg', '-60deg'];

const Face = ({ die, side, size }: { die: Die; side: Side; size: number }) => {
  const letter = side === 'w' ? die.piece : die.piece.toLowerCase();
  const Piece = PIECES[letter as keyof typeof PIECES];
  const edge = die.spent ? Math.round(size * 0.86) : size;
  const ringed = !die.spent && !die.leftover;
  return (
    <View
      style={{
        width: edge,
        height: edge,
        borderRadius: Math.round(edge / 6),
        backgroundColor: THEME.die,
        borderWidth: ringed ? Math.max(2, Math.round(size / 24)) : 0,
        borderColor: THEME.dieRing,
        opacity: die.spent ? 0.3 : die.leftover ? 0.45 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Piece ? <Piece size={Math.round(edge * 0.72)} /> : null}
    </View>
  );
};

// A die on its way in: turned and small at first, faint for the first third.
const Tumbling = ({
  progress,
  slot,
  children,
}: {
  progress: Animated.Value;
  slot: number;
  children: React.ReactNode;
}) => (
  <Animated.View
    testID="tumble"
    style={{
      opacity: progress.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0.2, 1, 1],
      }),
      transform: [
        {
          rotate: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [TURNS[slot], '0deg'],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 1],
          }),
        },
      ],
    }}
  >
    {children}
  </Animated.View>
);

// What the dice show, as a key: a tumble lasts only while they show what they
// showed when they were rolled. There are no dice before the roll, so the key
// is empty then.
const keyOf = (dice: readonly Die[]): string => dice.map(keyOfDie).join('');

// One die in the key: lower case once spent, in brackets while no turn can
// spend it.
const keyOfDie = ({ piece, spent, leftover }: Die): string => {
  if (spent) return piece.toLowerCase();
  return leftover ? `(${piece})` : piece;
};

type Tumble = { id: number; progress: Animated.Value[] };

// The tumble of the latest roll. It is worked out while rendering, so the first
// frame of the roll already shows the dice on their way in instead of flashing
// them in place.
//
// A roll is dice where there were none, or dice of the other side: a turn
// passes with its dice cleared, except when OK passes the bot's roll with
// nothing to play, which throws the person's dice over its dimmed ones (#149).
// Within a turn the side never changes, so an action is never taken for a roll.
const useTumble = (dice: readonly Die[], side: Side): Tumble | null => {
  const reduced = useReducedMotion();
  const key = keyOf(dice);
  const [state, setState] = React.useState<{
    key: string;
    side: Side;
    tumble: Tumble | null;
  }>({ key, side, tumble: null });
  if (state.key !== key || state.side !== side) {
    // Nothing tumbles until the platform has said it does not ask for less
    // motion: a roll before that answer is simply drawn.
    const rolled =
      key !== '' &&
      (state.key === '' || state.side !== side) &&
      reduced === false;
    setState({
      key,
      side,
      tumble: rolled
        ? {
            id: (state.tumble?.id ?? 0) + 1,
            progress: dice.map(() => new Animated.Value(0)),
          }
        : null,
    });
  }
  const tumble = state.key === key && state.side === side ? state.tumble : null;
  React.useEffect(() => {
    if (!tumble) return;
    let rolling = tumble.progress.length;
    const throws = tumble.progress.map((progress, slot) =>
      Animated.timing(progress, {
        toValue: 1,
        duration: TUMBLE_MS,
        delay: slot * TUMBLE_STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    for (const thrown of throws)
      thrown.start(({ finished }) => {
        rolling -= 1;
        if (finished && rolling === 0)
          setState((current) =>
            current.tumble === tumble ? { ...current, tumble: null } : current,
          );
      });
    return () => {
      for (const thrown of throws) thrown.stop();
    };
  }, [tumble]);
  return tumble;
};

// What a slot holds: before the roll an empty outline, then its die, on its
// way in or at rest.
const SlotContent = ({
  die,
  tumble,
  slot,
  side,
  size,
}: {
  die: Die | undefined;
  tumble: Tumble | null;
  slot: number;
  side: Side;
  size: number;
}) => {
  if (!die)
    return (
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
    );
  if (!tumble) return <Face die={die} side={side} size={size} />;
  return (
    <Tumbling key={tumble.id} progress={tumble.progress[slot]} slot={slot}>
      {/* Lit on the way in: a lost die dims as it lands. */}
      <Face die={{ ...die, leftover: false }} side={side} size={size} />
    </Tumbling>
  );
};

export const Dice = ({ dice, side, size = 72 }: DiceProps) => {
  const tumble = useTumble(dice, side);
  return (
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
          <SlotContent
            die={dice[slot]}
            tumble={tumble}
            slot={slot}
            side={side}
            size={size}
          />
        </View>
      ))}
    </View>
  );
};
