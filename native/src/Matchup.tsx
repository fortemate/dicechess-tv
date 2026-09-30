// The matchup badges in the game screen HUD (#156): showing the opponent at the
// top (mirroring black on the board) with a speech bubble hook (#158), game action
// in the middle, and the player at the bottom (mirroring white on the board).
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

export type OpponentBadgeProps = {
  game: Game;
  side: Side;
  thinking?: boolean;
  speechBubble?: React.ReactNode;
};

export type PlayerBadgeProps = {
  game: Game;
  side: Side;
};

export type MatchupProps = {
  game: Game;
  side: Side;
  thinking?: boolean;
  speechBubble?: React.ReactNode;
  children?: React.ReactNode;
};

const LEVELS = ['Easy', 'Medium', 'Hard'] as const;

export const MatchupPips = ({ level }: { level: Opponent['level'] }) => {
  const filled = LEVELS.indexOf(level) + 1;
  return (
    <View
      testID="matchup-pips"
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      {LEVELS.map((name, i) => (
        <View
          key={name}
          testID={i < filled ? 'pip-filled' : 'pip-empty'}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            borderWidth: 1.5,
            borderColor: i < filled ? '#f0f4f8' : 'rgba(240, 244, 248, 0.35)',
            backgroundColor: i < filled ? '#f0f4f8' : 'transparent',
            marginRight: 4,
          }}
        />
      ))}
    </View>
  );
};

const OpponentAvatar = ({
  opponent,
  opponentSide,
}: {
  opponent: Opponent | null;
  opponentSide: Side;
}) => {
  if (opponent) {
    const BotFace = FACES[FACE_OF[opponent.mode]];
    return <BotFace size={38} />;
  }
  const OpponentPiece = PIECES[opponentSide === 'w' ? 'K' : 'k'];
  return <OpponentPiece size={32} />;
};

const OpponentSubtitle = ({
  opponent,
  opponentSide,
  opponentActive,
  thinking,
}: {
  opponent: Opponent | null;
  opponentSide: Side;
  opponentActive: boolean;
  thinking: boolean;
}) => {
  if (opponent && opponentActive && thinking) {
    return (
      <Text
        testID="bot-status"
        style={{
          color: '#5eead4',
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        }}
      >
        Thinking…
      </Text>
    );
  }

  if (opponent) {
    return (
      <View
        testID="opponent-meta"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 2,
        }}
      >
        <Text
          style={{
            color: opponentActive ? '#8dc9b6' : '#94a3b8',
            fontSize: 12,
            marginRight: 6,
          }}
        >
          {opponent.level}
        </Text>
        <MatchupPips level={opponent.level} />
      </View>
    );
  }

  return (
    <Text
      testID="opponent-side"
      style={{
        color: opponentActive ? '#8dc9b6' : '#94a3b8',
        fontSize: 12,
        marginTop: 2,
      }}
    >
      {sideName(opponentSide)}
    </Text>
  );
};

export const OpponentBadge = ({
  game,
  side,
  thinking = false,
  speechBubble,
}: OpponentBadgeProps) => {
  const isBot = isBotMode(game.mode);
  const human = game.human ?? 'w';
  const opponentSide: Side = isBot ? opposite(human) : 'b';
  const opponent = isBotMode(game.mode) ? opponentOf(game.mode) : null;
  const live = game.phase !== 'ended';
  const opponentActive = live && side === opponentSide;
  const opponentLabel = opponent ? opponent.name.toUpperCase() : 'PLAYER 2';

  return (
    <View
      testID="opponent-section"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <View
        testID="opponent-badge"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: opponentActive ? THEME.cursor : '#22384f',
          backgroundColor: opponentActive
            ? THEME.focusFill
            : 'rgba(15, 23, 42, 0.55)',
          opacity: opponentActive ? 1 : 0.72,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: isBot ? 'transparent' : '#1b2d40',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <OpponentAvatar opponent={opponent} opponentSide={opponentSide} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text
              testID="opponent-name"
              style={{
                color: '#f0f4f8',
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 1,
              }}
              numberOfLines={1}
            >
              {opponentLabel}
            </Text>
            <OpponentSubtitle
              opponent={opponent}
              opponentSide={opponentSide}
              opponentActive={opponentActive}
              thinking={thinking}
            />
          </View>
        </View>
      </View>
      {speechBubble ? (
        <View
          testID="speech-bubble-slot"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 20,
          }}
        >
          {speechBubble}
        </View>
      ) : null}
    </View>
  );
};

export const PlayerBadge = ({ game, side }: PlayerBadgeProps) => {
  const isBot = isBotMode(game.mode);
  const human = game.human ?? 'w';
  const playerSide: Side = isBot ? human : 'w';
  const live = game.phase !== 'ended';
  const playerActive = live && side === playerSide;
  const playerLabel = isBot ? 'YOU' : 'PLAYER 1';
  const PlayerPiece = PIECES[playerSide === 'w' ? 'K' : 'k'];

  return (
    <View
      testID="player-badge"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: playerActive ? THEME.cursor : '#22384f',
        backgroundColor: playerActive
          ? THEME.focusFill
          : 'rgba(15, 23, 42, 0.55)',
        opacity: playerActive ? 1 : 0.72,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: '#1b2d40',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
          }}
        >
          <PlayerPiece size={32} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text
            testID="player-name"
            style={{
              color: '#f0f4f8',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 1,
            }}
            numberOfLines={1}
          >
            {playerLabel}
          </Text>
          <Text
            testID="player-side"
            style={{
              color: playerActive ? '#8dc9b6' : '#94a3b8',
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {sideName(playerSide)}
          </Text>
        </View>
      </View>
      {playerActive ? (
        <View
          testID="player-active-indicator"
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: THEME.cursor,
            marginRight: 4,
          }}
        />
      ) : null}
    </View>
  );
};

export const Matchup = ({
  game,
  side,
  thinking = false,
  speechBubble,
  children,
}: MatchupProps) => {
  return (
    <View
      testID="matchup-header"
      style={{
        flex: 1,
        justifyContent: 'space-between',
      }}
    >
      <OpponentBadge
        game={game}
        side={side}
        thinking={thinking}
        speechBubble={speechBubble}
      />
      {children}
      <PlayerBadge game={game} side={side} />
    </View>
  );
};
