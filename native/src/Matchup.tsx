// The matchup in the game screen HUD (#156): each side where it sits on the
// board, and the game's own lines between them.
//
// Against the bot, the top of the panel is a dialogue (#213): the bot's
// portrait, its name and level, and beside them the line it says, in a bubble
// that points at its face. The block keeps one height whether the bot speaks
// or not, and the turn line stands under it, so nothing moves when a line
// starts or ends. In Hot Seat each player has a badge, and the host, while she
// says a line, shows with it in the free space above the bottom badge.
//
// A badge for the side to move is framed in the turn colour, and the other
// side's badge dims (#168). The bot's dialogue block does neither: it has no
// frame, the bubble being the only box in it, and it stays in full colour, as
// the bot moves in a moment and would otherwise sit dimmed for nearly the whole
// game. The person's badge still marks their turn. Cyan belongs to the cursor
// and to a focused item, so a badge never wears it: a frame in the focus style
// read as one more thing to select.
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
import { PORTRAIT_OF, Portrait } from './Portrait';
import { DEFAULT_HOST, hostPortrait, type HostId } from './hostSetting';
import { PIECES } from './pieces';
import {
  BUBBLE_CHROME,
  BUBBLE_LINE,
  BUBBLE_ROWS,
  HOST_BUBBLE_ROWS,
} from './SpeechBubble';
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
  // The bot's line, beside its portrait.
  speechBubble?: React.ReactNode;
  // The Hot Seat host's line, beside hers above the bottom badge.
  hostBubble?: React.ReactNode;
  // Who says it, whose portrait shows with it.
  host?: HostId;
  // The turn line, under the top of the panel.
  header?: React.ReactNode;
  children?: React.ReactNode;
};

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;
const PIP = 12;
const AVATAR = 40;

// The dialogue block: the portrait, and beside it the name row over a bubble
// of up to three rows. Its height fits the taller of the two, so a line of any
// length, or none, leaves it the same. The owner kept the portrait at 96 dp
// when the frame went, so the bubble has the frame's width as well, wider than
// the 23 characters a row measured on the Virtual Device.
export const PORTRAIT = 96;
const NAME_ROW = 26;
const NAME_GAP = 6;
export const DIALOGUE_HEIGHT = Math.max(
  PORTRAIT,
  NAME_ROW + NAME_GAP + BUBBLE_ROWS * BUBBLE_LINE + BUBBLE_CHROME,
);

// The host above the bottom badge: her portrait and two rows of her line, no
// taller than the bubble. The tallest centre she can speak over is a result
// with its menu, and on the Virtual Device a 76 dp portrait touched its last
// item.
export const HOST_PORTRAIT = 64;
export const HOST_HEIGHT = Math.max(
  HOST_PORTRAIT,
  HOST_BUBBLE_ROWS * BUBBLE_LINE + BUBBLE_CHROME,
);

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

// A side's badge: a person's king, or a bot's face where the dialogue block
// does not stand, its name, and its colour or level.
const Avatar = ({ seat, side }: { seat: Seat; side: Side }) => {
  if (seat.kind === 'bot')
    return (
      <Portrait
        character={PORTRAIT_OF[seat.opponent.mode]}
        kind="badge"
        size={38}
      />
    );
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

// The bot as a character (#213): its portrait, its name and level, and the
// line it says, on the panel itself.
const DialogueBlock = ({
  opponent,
  side,
  active,
  thinking,
  speechBubble,
}: {
  opponent: Opponent;
  side: Side;
  active: boolean;
  thinking: boolean;
  speechBubble?: React.ReactNode;
}) => (
  <View
    testID="opponent-badge"
    style={{
      height: DIALOGUE_HEIGHT,
      flexDirection: 'row',
      alignItems: 'flex-start',
    }}
  >
    <View testID="opponent-portrait">
      <Portrait
        character={PORTRAIT_OF[opponent.mode]}
        kind="card"
        size={PORTRAIT}
      />
    </View>
    <View style={{ flex: 1, marginLeft: 8 }}>
      <View
        style={{
          height: NAME_ROW,
          marginBottom: NAME_GAP,
          marginLeft: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text
          testID="opponent-name"
          style={{ ...NAME, flex: 1 }}
          numberOfLines={1}
        >
          {opponent.name.toUpperCase()}
        </Text>
        <Meta
          seat={{ kind: 'bot', opponent }}
          side={side}
          id="opponent"
          active={active}
          thinking={thinking}
        />
      </View>
      <View testID="speech-zone" style={{ flex: 1 }}>
        {speechBubble}
      </View>
    </View>
  </View>
);

// The Hot Seat host while she says a line (#213): her portrait, Rolly's or
// Prowla's (#258), and the line, in the free space above the bottom badge, over
// nothing and moving nothing. Without the portraits Prowla's place stays
// empty, so the bubble keeps its place.
const HostBlock = ({
  bubble,
  host,
}: {
  bubble: React.ReactNode;
  host: HostId;
}) => (
  <View
    testID="host-block"
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 10,
      height: HOST_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    }}
  >
    <Portrait character={hostPortrait(host)} kind="card" size={HOST_PORTRAIT} />
    <View style={{ flex: 1, marginLeft: 8 }}>{bubble}</View>
  </View>
);

export const Matchup = ({
  game,
  side,
  flipped = game.human === 'b',
  thinking = false,
  speechBubble,
  hostBubble,
  host = DEFAULT_HOST,
  header,
  children,
}: MatchupProps) => {
  const bottom: Side = flipped ? 'b' : 'w';
  const top = opposite(bottom);
  const topSeat = seatOf(game, top);
  return (
    <View testID="matchup-header" style={{ flex: 1 }}>
      {topSeat.kind === 'bot' ? (
        <DialogueBlock
          opponent={topSeat.opponent}
          side={top}
          active={game.phase !== 'ended' && side === top}
          thinking={thinking}
          speechBubble={speechBubble}
        />
      ) : (
        <SideBadge game={game} side={top} toMove={side} thinking={thinking} />
      )}
      {header ? (
        <View testID="turn-line" style={{ marginTop: 6, marginBottom: 4 }}>
          {header}
        </View>
      ) : null}
      <View testID="matchup-center" style={{ flex: 1 }}>
        {children}
        {hostBubble ? <HostBlock bubble={hostBubble} host={host} /> : null}
      </View>
      <SideBadge game={game} side={bottom} toMove={side} thinking={thinking} />
    </View>
  );
};
