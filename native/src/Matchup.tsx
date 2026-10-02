// The matchup in the game screen HUD (#156): a badge for each side, each where
// that side sits on the board, the bot's speech zone under the top badge
// (#158), and the game's own lines between them.
//
// The side to move is framed in the turn colour, and the other side dims
// (#168). Cyan belongs to the cursor and to a focused item, so a badge never
// wears it: a frame in the focus style read as one more thing to select.
import React from 'react';
import { View, Text } from 'react-native';
import {
  isBotMode,
  opposite,
  sideName,
  type Game,
  type Side,
} from '../../src/core/game';
import { opponentOf, type Opponent } from '../../src/core/opponents';
import { FACES } from './faces';
import { FACE_OF } from './OpponentScreen';
import { PIECES } from './pieces';
import { THEME } from './theme';

export type MatchupProps = {
  game: Game;
  // The side to move.
  side: Side;
  // Whether the board is seen from Black's side, which puts Black's badge at
  // the bottom. Against the bot that is the person's side; in hotseat it
  // follows the turned board (#120). Defaults to the person's side.
  flipped?: boolean;
  thinking?: boolean;
  speechBubble?: React.ReactNode;
  // The turn line, at the foot of the speech zone.
  header?: React.ReactNode;
  children?: React.ReactNode;
};

// Room under the top badge for the bot's line: two rows of the bubble at 20 dp
// and its tail. The turn line stands at the foot of it and is left out while
// the bot speaks, so the line covers nothing and nothing below it moves
// (#168).
export const SPEECH_ZONE = 76;

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;
const PIP = 12;
const AVATAR = 40;

const NAME = {
  color: '#f0f4f8',
  fontSize: 20,
  fontWeight: '700',
  letterSpacing: 1,
} as const;
const meta = (active: boolean) => ({
  color: active ? '#8dc9b6' : '#94a3b8',
  fontSize: 20,
});

export const MatchupPips = ({ level }: { level: Opponent['level'] }) => {
  const filled = LEVELS.indexOf(level) + 1;
  return (
    <View
      testID="matchup-pips"
      style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}
    >
      {LEVELS.map((name, i) => (
        <View
          key={name}
          testID={i < filled ? 'pip-filled' : 'pip-empty'}
          style={{
            width: PIP,
            height: PIP,
            borderRadius: PIP / 2,
            borderWidth: 2,
            borderColor: i < filled ? '#f0f4f8' : 'rgba(240, 244, 248, 0.35)',
            backgroundColor: i < filled ? '#f0f4f8' : 'transparent',
            marginLeft: i ? 4 : 0,
          }}
        />
      ))}
    </View>
  );
};

// A badge's frame: the turn colour around the side to move, which also stays
// at full strength while the other side dims, so colour is not the only sign.
const frame = (active: boolean) =>
  ({
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: active ? THEME.turn : '#22384f',
    backgroundColor: active ? THEME.turnFill : 'rgba(15, 23, 42, 0.55)',
    opacity: active ? 1 : 0.6,
  }) as const;

// Who plays a side: the bot, the person against it, or in hotseat the player
// of that colour. The ids keep the bot and Player 2 as the opponent.
type Seat =
  { kind: 'bot'; opponent: Opponent } | { kind: 'person'; label: string };

const seatOf = (game: Game, side: Side): Seat => {
  if (!isBotMode(game.mode))
    return { kind: 'person', label: side === 'w' ? 'PLAYER 1' : 'PLAYER 2' };
  if (side === game.human) return { kind: 'person', label: 'YOU' };
  return { kind: 'bot', opponent: opponentOf(game.mode) };
};

const idOf = (game: Game, side: Side, seat: Seat): string => {
  const opponent =
    seat.kind === 'bot' || (!isBotMode(game.mode) && side === 'b');
  return opponent ? 'opponent' : 'player';
};

// The line beside the name: the bot's level, or what it is doing on its turn,
// or the colour a person plays.
const Meta = ({
  seat,
  side,
  id,
  active,
  thinking,
}: {
  seat: Seat;
  side: Side;
  id: string;
  active: boolean;
  thinking: boolean;
}) => {
  if (seat.kind === 'person')
    return (
      <Text testID={`${id}-side`} style={meta(active)}>
        {sideName(side)}
      </Text>
    );
  if (active && thinking)
    return (
      <Text testID="bot-status" style={meta(active)}>
        Thinking…
      </Text>
    );
  return (
    <View
      testID="opponent-meta"
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={meta(active)}>{seat.opponent.level}</Text>
      <MatchupPips level={seat.opponent.level} />
    </View>
  );
};

const Avatar = ({ seat, side }: { seat: Seat; side: Side }) => {
  if (seat.kind === 'bot') {
    const Face = FACES[FACE_OF[seat.opponent.mode]];
    return <Face size={38} />;
  }
  const King = PIECES[side === 'w' ? 'K' : 'k'];
  return <King size={32} />;
};

const SideBadge = ({
  game,
  side,
  toMove,
  thinking,
}: {
  game: Game;
  side: Side;
  toMove: Side;
  thinking: boolean;
}) => {
  const seat = seatOf(game, side);
  const id = idOf(game, side, seat);
  const active = game.phase !== 'ended' && side === toMove;
  const name =
    seat.kind === 'bot' ? seat.opponent.name.toUpperCase() : seat.label;
  return (
    <View testID={`${id}-badge`} style={frame(active)}>
      <View
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: 8,
          backgroundColor: seat.kind === 'bot' ? 'transparent' : '#1b2d40',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Avatar seat={seat} side={side} />
      </View>
      <Text
        testID={`${id}-name`}
        style={{ ...NAME, flex: 1 }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Meta
        seat={seat}
        side={side}
        id={id}
        active={active}
        thinking={thinking}
      />
    </View>
  );
};

export const Matchup = ({
  game,
  side,
  flipped = game.human === 'b',
  thinking = false,
  speechBubble,
  header,
  children,
}: MatchupProps) => {
  const bottom: Side = flipped ? 'b' : 'w';
  const withBot = isBotMode(game.mode);
  return (
    <View testID="matchup-header" style={{ flex: 1 }}>
      <SideBadge
        game={game}
        side={opposite(bottom)}
        toMove={side}
        thinking={thinking}
      />
      <View
        testID="speech-zone"
        style={{
          height: withBot ? SPEECH_ZONE : undefined,
          justifyContent: 'flex-end',
          marginBottom: 4,
        }}
      >
        {header && !speechBubble ? (
          <View testID="turn-line">{header}</View>
        ) : null}
        {speechBubble ? (
          <View
            testID="speech-bubble-slot"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
            }}
          >
            {speechBubble}
          </View>
        ) : null}
      </View>
      <View testID="matchup-center" style={{ flex: 1 }}>
        {children}
      </View>
      <SideBadge game={game} side={bottom} toMove={side} thinking={thinking} />
    </View>
  );
};
