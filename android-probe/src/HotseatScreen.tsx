import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
  useWindowDimensions,
} from 'react-native';
import { Board } from '../../native/src/Board';
import { Dice } from '../../native/src/Dice';
import { Option } from '../../native/src/Option';
import {
  ActivityContext,
  scheduleActive,
  type Activity,
} from '../../native/src/activity';
import {
  createRemoteChannel,
  RemoteInputContext,
} from '../../native/src/remoteInput';
import { useRemoteInput } from '../../native/src/useRemoteInput';
import { randomSource } from '../../native/src/randomSource';
import { OK_GUARD_MS, type ScreenOptions } from '../../native/src/screen';
import { boardSide, safeInsets } from '../../native/src/layout';
import { THEME } from '../../native/src/theme';
import { diceOf } from '../../src/core/dice';
import { movableSquares } from '../../src/core/boardInput';
import { emptyRoll, rollDice, sideName, viewGame } from '../../src/core/game';
import { outcome, reasonOf } from '../../src/core/announcements';
import { createStore } from './store';
import { cues } from '../../src/core/cues';
import { createAndroidEffects } from './androidEffects';
import { androidDirection, pulseKey } from './androidRemote';
import {
  createHotseatSession,
  hotseatMenu,
  type HotseatAction,
} from './hotseat';

const report = (event: string, detail: unknown) =>
  console.info(`[AndroidHotseat] ${JSON.stringify({ event, detail })}`);
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function makeSession() {
  const source = randomSource();
  let ids = 0;
  const options: ScreenOptions = {
    roll: () => rollDice(source.fill),
    newId: () => `android-${Date.now()}-${++ids}`,
    side: () => 'w',
    schedule: (step, ms) => {
      const timer = setTimeout(step, ms);
      return () => clearTimeout(timer);
    },
  };
  report('random-source', source.name);
  try {
    return {
      session: createHotseatSession(
        createStore('dicechess-android-hotseat'),
        options,
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
}: {
  activity: Activity;
  onExit: () => void;
}) {
  const [opened] = useState(makeSession);
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
    (action: HotseatAction) => {
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
  useRemoteInput(
    (key, repeat) => {
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
        <Text style={styles.title}>Could not load or save the game</Text>
        <Text style={styles.body}>{error}</Text>
        <Text style={styles.body}>
          Saved data has not been cleared. Back or OK returns to diagnostics.
        </Text>
      </View>
    );
  const { game, focus, overlay } = state;
  const view = viewGame(game);
  const choosing = game.phase === 'move';
  const insets = safeInsets(width, height);
  const menu = hotseatMenu(game);
  const choices =
    overlay.kind === 'menu'
      ? menu.map((item) => ({ label: item.label, index: item.index }))
      : overlay.kind === 'confirm'
        ? [
            { label: 'Cancel', index: 0 },
            { label: 'Yes', index: 1 },
          ]
        : overlay.kind === 'promotion'
          ? overlay.moves.map((move, index) => ({
              label: `Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[move[4]]}`,
              index,
            }))
          : [];
  const heading =
    overlay.kind === 'confirm'
      ? overlay.action === 'replace'
        ? 'Replace this game?'
        : 'Resign this game?'
      : overlay.kind === 'promotion'
        ? 'Choose a promotion'
        : 'Game menu';
  const prompt =
    game.phase === 'roll'
      ? 'OK: roll the dice'
      : game.phase === 'handoff'
        ? emptyRoll(game)
          ? 'No legal move · OK: next player rolls'
          : 'Turn complete · OK: next player rolls'
        : game.phase === 'ended'
          ? 'OK: game menu'
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
        cursor={choosing ? focus.cursor : null}
        selected={focus.selected}
        movable={choosing ? movableSquares(view.legal) : []}
      />
      <View style={styles.panel}>
        <Text style={styles.title}>Play with a friend</Text>
        <Text style={styles.body}>
          {sideName(view.side)} · Turn {game.turn}
        </Text>
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
          Saved on this device · Two players share the remote
        </Text>
      </View>
    </View>
  );
}

export const HotseatScreen = React.memo(function HotseatScreen({
  activity,
  onExit,
}: {
  activity: Activity;
  onExit: () => void;
}) {
  const [channel] = useState(createRemoteChannel);
  useTVEventHandler((event) => {
    const key = androidDirection(event);
    if (key && activity.isActive()) pulseKey(channel.emit, key);
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      channel.back,
    );
    return () => subscription.remove();
  }, [channel]);
  return (
    <RemoteInputContext.Provider value={channel.input}>
      <ActivityContext.Provider value={activity}>
        <Pressable
          style={styles.root}
          hasTVPreferredFocus
          accessibilityLabel="Two-player Dice Chess"
          onPress={() => {
            if (activity.isActive()) pulseKey(channel.emit, 'select');
          }}
        >
          <Game activity={activity} onExit={onExit} />
        </Pressable>
      </ActivityContext.Provider>
    </RemoteInputContext.Provider>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.background },
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
