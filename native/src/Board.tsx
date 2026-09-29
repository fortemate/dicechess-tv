// The board renderer. It draws what boardView() describes and nothing else:
// it does not know the rules, does not decide legality and emits no moves.
// A controller supplies the position, cursor, selection, legal actions and last
// move, and reads move intent from the input layer instead of from here.
//
// When the position changes by one action, the piece that moved slides to its
// square (#131): src/core/moveAnimation.ts works out what travelled, and the
// slide runs on the native driver. It is presentation only: the game has
// already moved on, and the remote is never held up.
import React from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { fileOf, rankOf } from '../../src/core/board';
import {
  boardView,
  type BoardInput,
  type SquareView,
} from '../../src/core/boardView';
import {
  movePlan,
  type MovePlan,
  type Slide,
} from '../../src/core/moveAnimation';
import { PIECES } from './pieces';
import { Square } from './Square';

export type BoardProps = BoardInput & {
  // Edge length of the whole board in pixels. The caller decides it from the
  // space available, so the board stays responsive on any panel.
  size: number;
};

// How long a piece takes to reach its square. The TV guidance of #51 keeps a
// transition under about 300 ms, and a turn has up to three of them.
export const SLIDE_MS = 220;

// Where a square's top-left corner is, from White's side or, flipped, from
// Black's: the same order boardView() renders in.
const cornerOf = (square: string, flipped: boolean, edge: number) => ({
  x: (flipped ? 7 - fileOf(square) : fileOf(square)) * edge,
  y: (flipped ? rankOf(square) : 7 - rankOf(square)) * edge,
});

// A piece in flight, drawn above the grid.
const Flight = ({
  slide,
  progress,
  edge,
  flipped,
}: {
  slide: Slide;
  progress: Animated.Value;
  edge: number;
  flipped: boolean;
}) => {
  const Piece = PIECES[slide.piece as keyof typeof PIECES];
  const start = cornerOf(slide.from, flipped, edge);
  const end = cornerOf(slide.to, flipped, edge);
  const along = (from: number, to: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  return (
    <Animated.View
      testID="flight"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: edge,
        height: edge,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { translateX: along(start.x, end.x) },
          { translateY: along(start.y, end.y) },
        ],
      }}
    >
      {Piece ? <Piece size={Math.round(edge * 0.92)} /> : null}
    </Animated.View>
  );
};

// While pieces are in flight, their destinations show what stood there before:
// the taken piece, or nothing. En passant keeps the taken pawn on its own
// square. Everything is as the new position has it once they land.
const inFlight = (rows: SquareView[][], plan: MovePlan): SquareView[][] => {
  const landing = new Set(plan.slides.map((slide) => slide.to));
  return rows.map((row) =>
    row.map((view) => {
      if (plan.taken?.square === view.square)
        return { ...view, piece: plan.taken.piece };
      return landing.has(view.square) ? { ...view, piece: null } : view;
    }),
  );
};

// Whether the platform asks for less motion, or null until it has answered.
// Where it cannot answer, because the query fails or the platform lacks it,
// pieces slide.
const useReducedMotion = (): boolean | null => {
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let live = true;
    const answer = (value: boolean) => {
      if (live) setReduced(value);
    };
    let subscription: { remove(): void } | undefined;
    try {
      AccessibilityInfo.isReduceMotionEnabled().then(answer, () =>
        answer(false),
      );
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        answer,
      );
    } catch {
      // The platform does not offer the setting: keep the slides.
      answer(false);
    }
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
};

type Motion = { id: number; plan: MovePlan; progress: Animated.Value };

// The slide for the latest change of position, when it was one action. It is
// worked out while rendering, so the first frame of the new position already
// shows the piece on its old square instead of flashing it on the new one.
const useMotion = (board: string, lastMove: string | null): Motion | null => {
  const reduced = useReducedMotion();
  const [state, setState] = React.useState<{
    board: string;
    motion: Motion | null;
  }>({ board, motion: null });
  if (state.board !== board) {
    // Nothing slides until the platform has said it does not ask for less
    // motion: a move before that answer is simply drawn.
    const plan =
      reduced === false ? movePlan(state.board, board, lastMove) : null;
    setState({
      board,
      motion: plan
        ? {
            id: (state.motion?.id ?? 0) + 1,
            plan,
            progress: new Animated.Value(0),
          }
        : null,
    });
  }
  const motion = state.board === board ? state.motion : null;
  React.useEffect(() => {
    if (!motion) return;
    const slide = Animated.timing(motion.progress, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    slide.start(({ finished }) => {
      if (finished)
        setState((current) =>
          current.motion === motion ? { ...current, motion: null } : current,
        );
    });
    return () => slide.stop();
  }, [motion]);
  return motion;
};

export const Board = ({ size, ...input }: BoardProps) => {
  const edge = Math.floor(size / 8);
  const motion = useMotion(input.board, input.lastMove ?? null);
  const rows = boardView(input);
  const shown = motion ? inFlight(rows, motion.plan) : rows;
  return (
    <View style={{ width: edge * 8, height: edge * 8 }}>
      {shown.map((row) => (
        <View key={row[0].square} style={{ flexDirection: 'row' }}>
          {row.map((view) => (
            <Square key={view.square} view={view} edge={edge} />
          ))}
        </View>
      ))}
      {motion?.plan.slides.map((slide) => (
        <Flight
          key={`${motion.id}-${slide.from}`}
          slide={slide}
          progress={motion.progress}
          edge={edge}
          flipped={input.flipped ?? false}
        />
      ))}
    </View>
  );
};
