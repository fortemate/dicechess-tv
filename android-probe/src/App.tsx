import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
} from 'react-native';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { createActivity } from '../../native/src/activity';
import {
  applyBotReply,
  decodeGame,
  moveGame,
  newGame,
  rollGame,
  viewGame,
  type Game,
} from '../../src/core/game';
import { type BotWorker } from '../../native/src/botClient';
import { createWorker } from './worker';
import { createStore } from './store';
import { SvgGallery } from './SvgGallery';
import { HotseatScreen } from './HotseatScreen';

const store = createStore('dicechess-android-probe');
const SAVE = 'snapshot';
const fixture = (id: string) =>
  rollGame(newGame('aggressive', id, undefined, 'b'), [1, 1, 1]);
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const actions = [
  'Run bot checks',
  'Slow worker + remote',
  'Replace game / cancel worker',
  'Save partial turn',
  'Reload saved turn',
  'Play audio',
  'Seek + parallel audio',
  'Play tutorial voice',
  'SVG artwork gallery',
  'Play with a friend',
];

export default function App() {
  const [selected, setSelected] = useState(0);
  const [gallery, setGallery] = useState(false);
  const galleryOpen = useRef(false);
  const [playing, setPlaying] = useState(false);
  const gameOpen = useRef(false);
  const closeGame = useCallback(() => {
    gameOpen.current = false;
    setPlaying(false);
  }, []);
  const [events, setEvents] = useState<string[]>([]);
  const [ticks, setTicks] = useState(0);
  const [game, setGame] = useState<Game>(() => {
    const raw = store.getString(SAVE);
    try {
      return raw ? decodeGame(raw) : fixture('initial');
    } catch {
      return fixture('recovered');
    }
  });
  const [busy, setBusy] = useState(false);
  const activity = useRef(
    createActivity(AppState.currentState === 'active'),
  ).current;
  const worker = useRef<BotWorker | null>(null);
  const players = useRef<AudioPlayer[]>([]);
  const generation = useRef(0);
  const audioGeneration = useRef(0);
  const mounted = useRef(true);
  const log = (event: string, detail: unknown = '') => {
    console.info(`[AndroidProbe] ${JSON.stringify({ event, detail })}`);
    if (mounted.current)
      setEvents((old) =>
        [
          `${event}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
          ...old,
        ].slice(0, 8),
      );
  };
  const stopAudio = () => {
    audioGeneration.current++;
    players.current.forEach((player) => {
      player.pause();
      player.remove();
    });
    players.current = [];
  };
  const cancel = (reason: string) => {
    generation.current++;
    worker.current?.dispose();
    worker.current = null;
    stopAudio();
    setBusy(false);
    log('canceled', reason);
  };
  const loadSave = () => {
    const raw = store.getString(SAVE);
    if (!raw) throw new Error('No saved turn');
    const restored = decodeGame(raw);
    setGame(restored);
    log('save-restored', restored);
  };

  useEffect(() => {
    mounted.current = true;
    log('ready', {
      tv: Platform.isTV,
      os: Platform.Version,
      restored: !!store.getString(SAVE),
      game,
    });
    const timer = setInterval(() => {
      if (activity.isActive()) setTicks((n) => n + 1);
    }, 100);
    const state = AppState.addEventListener('change', (value) => {
      activity.setActive(value === 'active');
      if (value !== 'active') stopAudio();
      log('lifecycle', value);
    });
    // Android can lose window focus without changing AppState (system panels).
    const blur = AppState.addEventListener('blur', () => {
      activity.setActive(false);
      stopAudio();
      log('focus', 'blur');
    });
    const focus = AppState.addEventListener('focus', () => {
      activity.setActive(AppState.currentState === 'active');
      log('focus', 'focus');
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gameOpen.current) return false;
      if (galleryOpen.current) {
        galleryOpen.current = false;
        setGallery(false);
        log('svg-closed');
        return true;
      }
      cancel('Back');
      return true;
    });
    return () => {
      mounted.current = false;
      generation.current++;
      worker.current?.dispose();
      stopAudio();
      clearInterval(timer);
      state.remove();
      blur.remove();
      focus.remove();
      back.remove();
    };
  }, []);

  useTVEventHandler((event) => {
    if (!activity.isActive() || galleryOpen.current || gameOpen.current) return;
    log('remote', { type: event.eventType, action: event.eventKeyAction });
    // This Android TV focus target delivers D-pad releases. Handle one release
    // per press; the game's held-key/repeat policy needs its own later probe.
    if (event.eventKeyAction === 0) return;
    if (event.eventType === 'down' || event.eventType === 'right')
      setSelected((n) => (n + 1) % actions.length);
    if (event.eventType === 'up' || event.eventType === 'left')
      setSelected((n) => (n + actions.length - 1) % actions.length);
  });

  useEffect(() => {
    log('selection', selected);
  }, [selected]);

  const runBot = async (slow: boolean) => {
    cancel('new request');
    const ticket = generation.current;
    const current = fixture(`probe-${ticket}`);
    const client = createWorker(activity, slow ? 3000 : 0);
    worker.current = client;
    setBusy(true);
    const began = Date.now();
    let heartbeats = 0;
    const timer = setInterval(() => {
      heartbeats++;
    }, 50);
    log('bot-start', { slow, syntheticHoldMs: slow ? 3000 : 0 });
    try {
      const reply = await client.request(current);
      if (ticket !== generation.current) {
        log('late-reply-ignored');
        return;
      }
      const after = applyBotReply(current, reply);
      setGame(after);
      log('bot-pass', {
        elapsedMs: Date.now() - began,
        heartbeats,
        moves: reply.moves,
        phase: after.phase,
      });
      try {
        applyBotReply(fixture('replacement'), reply);
        throw new Error('Stale reply accepted');
      } catch (error) {
        if (message(error) !== 'Stale bot reply') throw error;
        log('stale-pass');
      }
      try {
        await client.request(
          newGame('aggressive', 'invalid-phase', undefined, 'b'),
        );
        throw new Error('Invalid phase accepted');
      } catch (error) {
        if (message(error) !== 'The opponent does not owe a move') throw error;
        log('error-pass', message(error));
      }
    } catch (error) {
      log(
        ticket === generation.current ? 'bot-fail' : 'dispose-pass',
        message(error),
      );
    } finally {
      clearInterval(timer);
      client.dispose();
      if (ticket === generation.current) {
        setBusy(false);
        worker.current = null;
      }
    }
  };

  const play = async (parallel: boolean, voice = false) => {
    stopAudio();
    const ticket = audioGeneration.current;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
    if (
      !activity.isActive() ||
      !mounted.current ||
      ticket !== audioGeneration.current
    )
      return;
    const count = parallel ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const player = createAudioPlayer(
        voice ? require('../assets/voice.mp3') : require('../assets/tone.wav'),
        {
          updateInterval: 50,
        },
      );
      players.current.push(player);
      player.volume = i === 0 ? 0.5 : 0.2;
      let finished = false;
      player.addListener('playbackStatusUpdate', (status) => {
        if (
          status.didJustFinish &&
          !finished &&
          ticket === audioGeneration.current
        ) {
          finished = true;
          log('audio-finished', {
            player: i,
            position: status.currentTime,
            duration: status.duration,
          });
        }
      });
      if (parallel) await player.seekTo(0.4);
      if (ticket !== audioGeneration.current) return;
      if (!activity.isActive()) {
        stopAudio();
        return;
      }
      player.play();
    }
    log('audio-start', { voice, players: count, seek: parallel ? 0.4 : 0 });
  };

  const activate = async () => {
    if (!activity.isActive()) return;
    log('activate', selected);
    try {
      if (selected < 2) {
        await runBot(selected === 1);
        return;
      }
      if (selected === 2) {
        cancel('replacement');
        setGame(fixture('replacement'));
        return;
      }
      if (selected === 3) {
        const initial = fixture('saved-partial');
        const partial = moveGame(initial, viewGame(initial).legal[0]);
        store.set(SAVE, JSON.stringify(partial));
        if (
          JSON.stringify(decodeGame(store.getString(SAVE)!)) !==
          JSON.stringify(partial)
        )
          throw new Error('Save round trip mismatch');
        setGame(partial);
        log('save-pass', partial);
        return;
      }
      if (selected === 4) {
        loadSave();
        return;
      }
      if (selected === 8) {
        cancel('SVG gallery');
        galleryOpen.current = true;
        setGallery(true);
        return;
      }
      if (selected === 9) {
        cancel('hotseat game');
        gameOpen.current = true;
        setPlaying(true);
        return;
      }
      await play(selected === 6, selected === 7);
    } catch (error) {
      log('action-fail', message(error));
    }
  };
  if (playing) return <HotseatScreen activity={activity} onExit={closeGame} />;
  if (gallery) return <SvgGallery activity={activity} />;
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Dice Chess · Android compatibility probe</Text>
      <Text style={styles.subtitle}>
        D-pad selects · OK runs · Back cancels · heartbeat {ticks} ·{' '}
        {busy ? 'WORKING' : 'IDLE'}
      </Text>
      <View style={styles.columns}>
        <Pressable
          hasTVPreferredFocus
          onPress={() => {
            void activate();
          }}
          style={styles.menu}
          accessibilityLabel={actions[selected]}
        >
          {actions.map((action, index) => (
            <Text
              key={action}
              style={[styles.action, selected === index && styles.selected]}
            >
              {index + 1}. {action}
            </Text>
          ))}
        </Pressable>
        <View style={styles.details}>
          <Text style={styles.text}>
            Game: {game.id} · phase: {game.phase}
          </Text>
          <Text style={styles.text}>
            Dice: {game.roll.join(', ')} · moves:{' '}
            {game.moves.join(', ') || 'none'}
          </Text>
          {events.map((event, index) => (
            <Text key={index} numberOfLines={2} style={styles.event}>
              {event}
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.footer}>
        Engineering prototype · Android evidence only
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#102122', padding: 30 },
  title: { fontSize: 26, color: '#ffffff', fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#a8c6c4', marginVertical: 12 },
  columns: { flex: 1, flexDirection: 'row', gap: 22 },
  menu: { width: 300 },
  action: {
    fontSize: 17,
    color: '#ffffff',
    padding: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  selected: { backgroundColor: '#bfe8a4', color: '#102122' },
  details: { flex: 1 },
  text: { color: '#ffffff', fontSize: 15, marginBottom: 8 },
  event: { color: '#a8c6c4', fontSize: 12, marginBottom: 5 },
  footer: { color: '#a8c6c4', fontSize: 12, marginTop: 8 },
});
