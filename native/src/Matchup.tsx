// The matchup badges in the game screen HUD (#156): showing the player and
// the opponent side by side, with an active turn highlight and bot thinking
// status.
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
  side: Side;
  thinking?: boolean;
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

export const Matchup = ({ game, side, thinking = false }: MatchupProps) => {
  const isBot = isBotMode(game.mode);
  const human = game.human ?? 'w';
  const playerSide: Side = isBot ? human : 'w';
  const opponentSide: Side = isBot ? opposite(human) : 'b';

  const opponent = isBotMode(game.mode) ? opponentOf(game.mode) : null;
  const live = game.phase !== 'ended';
  const playerActive = live && side === playerSide;
  const opponentActive = live && side === opponentSide;

  const playerLabel = isBot ? 'YOU' : 'PLAYER 1';
  const opponentLabel = opponent ? opponent.name.toUpperCase() : 'PLAYER 2';

  const PlayerPiece = PIECES[playerSide === 'w' ? 'K' : 'k'];
  const OpponentPiece = PIECES[opponentSide === 'w' ? 'K' : 'k'];
  const BotFace = opponent ? FACES[FACE_OF[opponent.mode]] : null;

  return (
    <View
      testID="matchup-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      {/* Player badge */}
      <View
        testID="player-badge"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginRight: 10,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: playerActive ? THEME.cursor : '#22384f',
          backgroundColor: playerActive
            ? THEME.focusFill
            : 'rgba(15, 23, 42, 0.55)',
          opacity: playerActive ? 1 : 0.72,
        }}
      >
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

      {/* Opponent badge */}
      <View
        testID="opponent-badge"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
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
          {BotFace ? <BotFace size={38} /> : <OpponentPiece size={32} />}
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
          {isBot && opponentActive && thinking ? (
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
          ) : isBot && opponent ? (
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
          ) : (
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
          )}
        </View>
      </View>
    </View>
  );
};
