import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Board } from '../../native/src/Board';
import { Dice } from '../../native/src/Dice';
import { Option } from '../../native/src/Option';
import { scheduleActive, type Activity } from '../../native/src/activity';
import { useRemoteInput } from '../../native/src/useRemoteInput';
import { randomSource } from '../../native/src/randomSource';
import {
  colourOptions,
  resultItems,
  HOTSEAT_OPTION,
  COMPUTER_OPTION,
  flipped,
  OK_GUARD_MS,
  type ScreenOptions,
  type ScreenState,
} from '../../native/src/screen';
import { boardSide, safeInsets } from '../../native/src/layout';
import { diceOf } from '../../src/core/dice';
import { movableSquares } from '../../src/core/boardInput';
import {
  emptyRoll,
  isBotMode,
  opposite,
  randomSide,
  rollDice,
  sideName,
  viewGame,
} from '../../src/core/game';
import { outcome, reasonOf } from '../../src/core/announcements';
import { OPPONENTS, opponentOf } from '../../src/core/opponents';
import { botToAct } from '../../src/core/bot';
import { createWorker } from './worker';
import { createBotDriver } from './botDriver';
import { createStore } from './store';
import { cues } from '../../src/core/cues';
import { createAndroidEffects } from './androidEffects';
import { RemoteSurface } from './RemoteSurface';
import { RulesContent } from './RulesReference';
import {
  createGameSession,
  gameMenu,
  GAME_STORE,
  type GameIntent,
  type GameAction,
  type ProbeMode,
} from './gameSession';

const report = (event: string, detail: unknown) =>
  console.info(`[AndroidHotseat] ${JSON.stringify({ event, detail })}`);
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function overlayChoices({ overlay, game }: ScreenState, exitLabel: string) {
  switch (overlay.kind) {
    case 'menu':
      return gameMenu(game).map(({ id, label, index }) => ({
        label: id === 'main-menu' ? exitLabel : label,
        index,
      }));
    case 'result':
      return resultItems.map(({ id, label }, index) => ({
        label: id === 'main-menu' ? exitLabel : label,
        index,
      }));
    case 'opponent':
      return OPPONENTS.map(({ name, level }, index) => ({
        label: `${name} · ${level}`,
        index,
      }));
    case 'colour':
      return colourOptions.map((label, index) => ({ label, index }));
    case 'confirm':
      return [
        { label: 'Cancel', index: 0 },
        { label: 'Yes', index: 1 },
      ];
    case 'promotion':
      return overlay.moves.map((move, index) => ({
        label: `Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[move[4]]}`,
        index,
      }));
    default:
      return [];
  }
}

function overlayHeading(overlay: ScreenState['overlay']) {
  switch (overlay.kind) {
    case 'result':
      return 'Game over';
    case 'opponent':
      return 'Choose your opponent';
    case 'colour':
      return `Choose your side against ${opponentOf(overlay.mode).name}`;
    case 'confirm':
      return overlay.action === 'replace'
        ? 'Replace this game?'
        : 'Resign this game?';
    case 'promotion':
      return 'Choose a promotion';
    default:
      return 'Game menu';
  }
}

function makeSession(mode: ProbeMode, intent: GameIntent) {
  const source = randomSource();
  let ids = 0;
  const options: ScreenOptions = {
    roll: () => rollDice(source.fill),
    newId: () => `android-${Date.now()}-${++ids}`,
    side: () => randomSide(source.fill),
    // Mark this as asynchronous so the shared reducer never searches on RN.
    reply: () => {
      throw new Error('Opponent reply must come from the worker');
    },
    schedule: (step, ms) => {
      const timer = setTimeout(step, ms);
      return () => clearTimeout(timer);
    },
  };
  report('random-source', source.name);
  try {
    return {
      session: createGameSession(
        createStore(GAME_STORE),
        options,
        mode,
        intent,
      ),
      error: '',
    };
  } catch (error) {
    report('load-error', errorText(error));
    return { session: null, error: errorText(error) };
  }
}

function Game({
  activity,
  onExit,
  mode,
  intent,
  exitLabel,
}: {
  activity: Activity;
  onExit: () => void;
  mode: ProbeMode;
  intent: GameIntent;
  exitLabel: string;
}) {
  const [opened] = useState(() => makeSession(mode, intent));
  const [state, setState] = useState(() => opened.session?.getState());
  const [error, setError] = useState(opened.error);
  const effects = useRef<ReturnType<typeof createAndroidEffects> | null>(null);
  useEffect(() => {
    if (error) return;
    const owned = createAndroidEffects(activity);
    effects.current = owned;
    return () => {
      effects.current = null;
      owned.dispose();
    };
  }, [activity, error]);
  const { width, height } = useWindowDimensions();
  const send = useCallback(
    (action: GameAction) => {
      if (!opened.session || error) return;
      try {
        const before = opened.session.getState().game;
        const next = opened.session.dispatch(action);
        setState(next);
        if (next.game !== before)
          effects.current?.play(cues(before, next.game));
      } catch (failure) {
        setError(errorText(failure));
        report('save-error', errorText(failure));
      }
    },
    [opened, error],
  );
  const playingBot = state ? isBotMode(state.game.mode) : false;
  const driver = useRef<ReturnType<typeof createBotDriver> | null>(null);
  useEffect(() => {
    if (!playingBot || !opened.session || error) return;
    const owned = createBotDriver({
      activity,
      worker: createWorker(activity),
      read: opened.session.getState,
      send,
      fail: (failure) => {
        setError(errorText(failure));
        report('bot-error', errorText(failure));
      },
      report: (event, detail) => report(`bot-${event}`, detail),
    });
    driver.current = owned;
    return () => {
      driver.current = null;
      owned.dispose();
    };
  }, [activity, opened, playingBot, error, send]);
  useEffect(() => {
    if (state) driver.current?.update(state);
  }, [state]);
  useRemoteInput(
    (key, repeat) => {
      // RulesScreen owns the remote while this mounted game keeps its session.
      if (state?.overlay.kind === 'rules') return;
      if (error) {
        if (key === 'back' || key === 'select') onExit();
        return;
      }
      send({ kind: 'key', key, repeat });
    },
    {
      scope: `${state?.overlay.kind}:${state?.game.revision}:${state?.focus.selected}`,
    },
  );
  useEffect(() => {
    if (state?.overlay.kind === 'home') onExit();
  }, [state?.overlay.kind, onExit]);
  useEffect(() => {
    if (!state?.guarded || error) return;
    return scheduleActive(
      activity,
      (step, ms) => {
        const timer = setTimeout(step, ms);
        return () => clearTimeout(timer);
      },
      () => send({ kind: 'unguard' }),
      OK_GUARD_MS,
    );
  }, [state?.guarded, error, activity, send]);
  useEffect(() => {
    if (state)
      report('state', {
        game: state.game,
        focus: state.focus,
        overlay: state.overlay,
        guarded: state.guarded,
        view: viewGame(state.game),
      });
  }, [state]);
  if (!state || error)
    return (
      <View style={styles.error}>
        <Text style={styles.title}>Could not continue the game</Text>
        <Text style={styles.body}>{error}</Text>
        <Text style={styles.body}>
          Saved data has not been cleared. Back or OK returns to{' '}
          {exitLabel.toLowerCase()}.
        </Text>
      </View>
    );
  if (state.overlay.kind === 'rules')
    return <RulesContent onExit={() => send({ kind: 'key', key: 'back' })} />;
  const { game, focus, overlay } = state;
  const view = viewGame(game);
  const choosing = game.phase === 'move' && !botToAct(game);
  const insets = safeInsets(width, height);
  const opponent = isBotMode(game.mode) ? opponentOf(game.mode) : null;
  const selecting = overlay.kind === 'opponent' || overlay.kind === 'colour';
  const saved = opened.session?.hasSave();
  const choices = overlayChoices(state, exitLabel);
  const heading = overlayHeading(overlay);
  const prompt =
    botToAct(game) && !emptyRoll(game)
      ? `${opponent?.name} is playing · Back: game menu`
      : game.phase === 'roll'
        ? 'OK: roll the dice'
        : game.phase === 'handoff'
          ? emptyRoll(game)
            ? game.mode === 'hotseat'
              ? 'No legal move · OK: next player rolls'
              : 'No legal move · OK: continue'
            : game.mode === 'hotseat'
              ? 'Turn complete · OK: next player rolls'
              : `Turn complete · OK: ${opponent?.name} plays`
          : game.phase === 'ended'
            ? 'OK: main menu'
            : focus.selected
              ? 'Choose a destination · OK: move · Back: cancel'
              : 'Choose a highlighted piece · OK: select';
  return (
    <View
      style={[
        styles.game,
        { paddingHorizontal: insets.x, paddingVertical: insets.y },
      ]}
    >
      <Board
        size={boardSide(width, height)}
        board={view.dfen.split(' ')[0]}
        legal={view.legal}
        lastMove={game.lastMove}
        flipped={flipped(game)}
        cursor={choosing ? focus.cursor : null}
        selected={focus.selected}
        movable={choosing ? movableSquares(view.legal) : []}
      />
      <View style={styles.panel}>
        <Text style={styles.title}>
          {selecting
            ? COMPUTER_OPTION
            : game.mode === 'hotseat'
              ? HOTSEAT_OPTION
              : !saved
                ? COMPUTER_OPTION
                : `Play against ${opponent?.name}`}
        </Text>
        <Text style={styles.body}>
          {saved
            ? `${sideName(view.side)} · Turn ${game.turn}`
            : 'D-pad: choose · OK: select · Back: cancel'}
        </Text>
        {game.result && choices.length ? (
          <Text style={styles.heading}>
            {outcome(game, game.result)} · {reasonOf(game, game.result)}
          </Text>
        ) : null}
        {choices.length ? (
          <>
            <Text style={styles.heading}>{heading}</Text>
            {choices.map((choice) => (
              <Option
                key={choice.index}
                label={choice.label}
                focused={'index' in overlay && overlay.index === choice.index}
                fontSize={20}
              />
            ))}
            {overlay.kind === 'opponent' ? (
              <Text style={styles.body}>{OPPONENTS[overlay.index].style}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Dice
              dice={diceOf(game.roll, view.remaining, view.playable)}
              side={view.side}
              size={64}
            />
            {game.result ? (
              <Text style={styles.heading}>
                {outcome(game, game.result)} · {reasonOf(game, game.result)}
              </Text>
            ) : null}
            <Text style={styles.heading}>{prompt}</Text>
            {state.guarded ? (
              <Text style={styles.body}>
                No legal move with this roll. Wait a moment, then press OK.
              </Text>
            ) : null}
            <Text style={styles.body}>D-pad: choose · Back: game menu</Text>
          </>
        )}
        <Text style={styles.saved}>
          {saved
            ? 'Saved on this device · '
            : 'Choose an opponent and side to start'}
          {saved &&
            (game.human
              ? `You: ${sideName(game.human)} · ${opponent?.name}: ${sideName(opposite(game.human))}`
              : 'Two players share the remote')}
        </Text>
      </View>
    </View>
  );
}

export const GameScreen = React.memo(function GameScreen({
  activity,
  onExit,
  mode,
  intent = 'continue',
  exitLabel = 'Main menu',
}: {
  activity: Activity;
  onExit: () => void;
  mode: ProbeMode;
  intent?: GameIntent;
  exitLabel?: string;
}) {
  return (
    <RemoteSurface
      activity={activity}
      label={
        mode === 'hotseat'
          ? 'Two-player Dice Chess'
          : 'Dice Chess against computer'
      }
    >
      <Game
        activity={activity}
        onExit={onExit}
        mode={mode}
        intent={intent}
        exitLabel={exitLabel}
      />
    </RemoteSurface>
  );
});

const styles = StyleSheet.create({
  game: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  panel: { flex: 1, paddingLeft: 28 },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  heading: { color: '#ffffff', fontSize: 22, marginVertical: 16 },
  body: { color: '#c7d5e1', fontSize: 18, marginVertical: 8 },
  saved: { color: '#a8c6c4', fontSize: 14, marginTop: 20 },
  error: { flex: 1, justifyContent: 'center', padding: 48 },
});
