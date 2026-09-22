// Renderer check screen. Every value below comes from the canonical engine
// through the shared core: the position, the legal actions and the last move
// are real, not hand-written, so the four overlay states are shown against
// state the controller would actually produce.
//
// White completes a turn, hands over, and Black rolls. That leaves the last
// move, the selection, its legal destinations and the cursor on four distinct
// sets of squares, which is what makes them worth telling apart.
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  viewGame,
} from '../../src/core/game';
import { Board } from './Board';
import { THEME } from './theme';

// Fixed instructional rolls: queen, rook, knight. Not production randomness.
const ROLL = [5, 4, 2];
const SELECTED = 'b8';
const CURSOR = 'e5';

export const BoardScreen = () => {
  const { width, height } = useWindowDimensions();
  const scene = React.useMemo(() => {
    let game = rollGame(newGame('hotseat', 'render'), ROLL);
    // The knight die allows b1c3; the rook die then allows a1b1. The queen is
    // blocked, so the turn ends with an unusable die and hands over.
    game = moveGame(game, 'b1c3');
    game = moveGame(game, 'a1b1');
    game = rollGame(nextTurn(game), ROLL);
    const state = viewGame(game);
    return {
      board: state.dfen.split(' ')[0],
      legal: state.legal,
      lastMove: game.lastMove,
    };
  }, []);

  // Landscape TV: the board takes the smaller edge, leaving room for the panel
  // the controller will own. Deriving it from the window keeps it responsive.
  const size = Math.min(height - 64, width - 64);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Board
        size={size}
        board={scene.board}
        legal={scene.legal}
        lastMove={scene.lastMove}
        selected={SELECTED}
        cursor={CURSOR}
      />
    </View>
  );
};
