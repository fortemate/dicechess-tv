// The native app: the board, plus the saving and the randomness the board
// deliberately knows nothing about.
//
// The saved game is read synchronously, during the first render, so the board
// never shows a fresh position that is about to be replaced by a restored one
// and there is no loading frame. A Vega app with a loading frame does not
// receive remote input at all.
import React from 'react';
import {
  decodeGame,
  rollDice,
  randomSide,
  type Game,
} from '../../src/core/game';
import {
  decodeLedger,
  emptyLedger,
  record,
  type Ledger,
} from '../../src/core/ledger';
import { MMKV } from '@amazon-devices/react-native-mmkv';
import { useKeplerAppStateManager } from '@amazon-devices/react-native-kepler';
import { useReportFullyDrawn } from '@amazon-devices/kepler-performance-api';
import { GameScreen } from './GameScreen';
import { MmkvSnapshotStore } from './mmkvStore';
import { createSounds, type Sounds } from './sound';
import { readSound, saveSound } from './soundSetting';
import { readTurnBoard, saveTurnBoard } from './turnSetting';
import { readVoices, saveVoices } from './voiceSetting';
import { readHost, saveHost, type HostChoice } from './hostSetting';
import {
  readTutorialOffered,
  saveTutorialOffered,
} from './tutorialOfferSetting';
import { createMusic, loadCatalogue, type Music } from './music';
import {
  readMusic,
  saveMusic,
  musicGain,
  type MusicSetting,
} from './musicSetting';
import { randomSource } from './randomSource';
import type { ScreenOptions } from './screen';
import { ActivityContext, createActivity } from './activity';

const KEY = 'dicechess-tv.game.v2';
const LEDGER_KEY = 'dicechess-tv.ledger.v1';
// Where a ledger that no longer decodes is kept, unchanged.
const DAMAGED_LEDGER_KEY = 'dicechess-tv.ledger.v1.damaged';

type Opened = { game: Game | null; damaged: string | null };
type OpenedLedger = { ledger: Ledger; copyPending: boolean };

// Copies a ledger that no longer decodes aside, unchanged. False when storage
// fails: the app still opens, and the caller saves nothing over the ledger
// until a later copy succeeds.
const keptAside = (store: MmkvSnapshotStore<Ledger>): boolean => {
  try {
    store.keepAside(DAMAGED_LEDGER_KEY);
    return true;
  } catch {
    return false;
  }
};

export type AppProps = {
  // Injected by tests so a roll is known; the app builds its own from the best
  // random source the device offers.
  options?: ScreenOptions;
  onState?: (line: string) => void;
  // Injected by tests, which cannot hear; the app makes the real players.
  sounds?: Sounds;
  music?: Music;
};

export const App = ({
  options: injected,
  onState,
  sounds: injectedSounds,
  music: injectedMusic,
}: AppProps) => {
  const store = React.useMemo(
    () => new MmkvSnapshotStore<Game>({ key: KEY, decode: decodeGame }),
    [],
  );
  const ledgerStore = React.useMemo(
    () =>
      new MmkvSnapshotStore<Ledger>({
        key: LEDGER_KEY,
        decode: decodeLedger,
      }),
    [],
  );
  const options = React.useMemo<ScreenOptions>(() => {
    if (injected) return injected;
    const source = randomSource();
    return {
      roll: () => rollDice(source.fill),
      side: () => randomSide(source.fill),
      newId: () => 'g' + Date.now().toString(36),
      // Space the opponent's steps out so the player watches it roll and move
      // rather than seeing the board jump; the screen says how long each waits.
      schedule: (step, wait) => {
        const timer = setTimeout(step, wait);
        return () => clearTimeout(timer);
      },
      // One roll of the danger search per slot between frames (#76).
      background: (step) => {
        const timer = setTimeout(step, 0);
        return () => clearTimeout(timer);
      },
      // The opponent's search counts against its step wait (#253).
      now: () => Date.now(),
    };
  }, [injected]);

  // A save that no longer decodes is not silently played over: it is recorded,
  // and the board starts fresh only after that is true.
  const [opened] = React.useState<Opened>(() => {
    try {
      return { game: store.read(), damaged: null };
    } catch (error) {
      return {
        game: null,
        damaged: (error as Error)?.message ?? String(error),
      };
    }
  });

  React.useEffect(() => {
    if (opened.damaged) store.clear();
  }, [opened.damaged, store]);

  // The ledger is read once and kept here, so recording a result is one write
  // that both counts it and remembers it was counted.
  const [openedLedger] = React.useState<OpenedLedger>(() => {
    try {
      return {
        ledger: ledgerStore.read() ?? emptyLedger(),
        copyPending: false,
      };
    } catch {
      // A ledger that no longer decodes (a later build's, say) is copied aside
      // unchanged before the next result can be saved over it, and a new
      // record starts: losing a record silently is worse than showing none.
      // The copy is made here, before anything can save; a later damaged
      // ledger replaces an earlier copy. If storage fails, the app opens all
      // the same and the copy is tried again before the first result.
      return { ledger: emptyLedger(), copyPending: !keptAside(ledgerStore) };
    }
  });
  const [ledger, setLedger] = React.useState(openedLedger.ledger);
  const copyPending = React.useRef(openedLedger.copyPending);

  // A result is recorded whenever one is seen, including on the launch after a
  // game ended while the app was gone. record() is a no-op for a game already
  // counted, so running it every time is safe. Until the damaged ledger is
  // copied aside nothing is counted, so nothing is saved over it: a result
  // seen meanwhile counts only when it is seen again, as a finished game still
  // saved is at the next launch.
  const count = React.useCallback(
    (game: Game) => {
      if (copyPending.current) {
        if (!keptAside(ledgerStore)) return;
        copyPending.current = false;
      }
      setLedger((current) => {
        const next = record(current, game);
        if (next !== current)
          void ledgerStore.save(next).catch(() => undefined);
        return next;
      });
    },
    [ledgerStore],
  );

  // Launch goes through the same count() as a game finishing in play, so there
  // is one path that records a result. It sets state from an effect, once, and
  // only when a finished game was never counted: one extra render at launch.
  React.useEffect(() => {
    if (opened.game) count(opened.game);
  }, [count, opened.game]);

  // Read before the first render, like the saved game, so the menu never shows
  // one state and then flips to another.
  const settings = React.useMemo(() => new MMKV(), []);
  const [initialSound] = React.useState(() => readSound(settings));
  const [initialVoices] = React.useState(() => readVoices(settings));
  // Who hosts Hot Seat games, Rolly or no one (#202). Her voice obeys the
  // Voices setting like the bots'.
  const [initialHost] = React.useState(() => readHost(settings));
  // The adaptive music (#76), made before the sounds so that a bot's line can
  // duck it (#159).
  const music = React.useMemo(
    () => injectedMusic ?? createMusic({ report: onState }),
    // Made once, like the sound players.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [injectedMusic],
  );
  const sounds = React.useMemo(
    () =>
      injectedSounds ??
      createSounds({
        muted: !initialSound,
        voices: initialVoices,
        report: onState,
        onSpeech: (on) => music.setDucked(on),
      }),
    // Made once: the players are created and initialised up front.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [injectedSounds, music],
  );
  React.useEffect(() => {
    if (!injectedSounds) return;
    injectedSounds.setMuted(!initialSound);
    injectedSounds.setVoices(initialVoices);
  }, [injectedSounds, initialSound, initialVoices]);
  const onSound = React.useCallback(
    (on: boolean) => {
      saveSound(settings, on);
      sounds.setMuted(!on);
    },
    [settings, sounds],
  );
  const onVoices = React.useCallback(
    (on: boolean) => {
      saveVoices(settings, on);
      sounds.setVoices(on);
    },
    [settings, sounds],
  );
  const onHost = React.useCallback(
    (host: HostChoice) => saveHost(settings, host),
    [settings],
  );

  // The adaptive music (#76). The build ships a catalogue beside the tracks, or
  // none at all, and then the game plays without music.
  const [initialMusic] = React.useState(() => readMusic(settings));
  // Known once the catalogue is read; an injected player counts as music.
  const [musicAvailable, setMusicAvailable] = React.useState(
    injectedMusic !== undefined,
  );
  React.useEffect(() => {
    music.setEnabled(initialMusic.on);
    music.setVolume(musicGain(initialMusic.volume));
    if (injectedMusic) return;
    let live = true;
    void loadCatalogue().then((catalogue) => {
      if (!live) return;
      music.setCatalogue(catalogue);
      setMusicAvailable(catalogue !== null);
    });
    return () => {
      live = false;
      // The player is the app's own: nothing may go on playing without it.
      music.setSuspended(true);
    };
  }, [music, injectedMusic, initialMusic]);
  const onMusic = React.useCallback(
    (next: MusicSetting) => {
      saveMusic(settings, next);
      music.setEnabled(next.on);
      music.setVolume(musicGain(next.volume));
    },
    [settings, music],
  );

  // A first launch opens on Thinkle's offer of the tutorial (#244). It is made
  // once, and never to a player who has a game saved, even one that no longer
  // reads: they have played before.
  const [offerTutorial] = React.useState(
    () =>
      !readTutorialOffered(settings) &&
      opened.game === null &&
      opened.damaged === null,
  );
  const onTutorialOffered = React.useCallback(
    () => saveTutorialOffered(settings),
    [settings],
  );

  // Whether the board turns to the side to move in hotseat (#120).
  const [initialTurnBoard] = React.useState(() => readTurnBoard(settings));
  const onTurnBoard = React.useCallback(
    (on: boolean) => {
      saveTurnBoard(settings, on);
    },
    [settings],
  );

  // Time To Fully Drawn, one of the KPIs Amazon measures. A cool start is fully
  // drawn by the first render, since the saved game and the settings are read
  // synchronously and there is no loading frame.
  const reportFullyDrawn = useReportFullyDrawn();
  React.useEffect(() => {
    reportFullyDrawn();
  }, [reportFullyDrawn]);

  // Leaving the foreground (Home, another app, the screensaver) stops every
  // sound, which Amazon's pre-submission checks require. Coming back is a warm
  // start, reported like the cool one, and sound resumes as the setting says.
  const appState = useKeplerAppStateManager();
  const activity = React.useMemo(
    () => createActivity(appState.getCurrentState() === 'active'),
    [appState],
  );
  React.useLayoutEffect(() => {
    let away = false;
    // Sound, voices and music play only while the app is both active and
    // focused (#76, #254). Vega sends blur before the change to background and
    // focus after the return to active, so everything stops on the first sign
    // of leaving; and whatever the order, it stays stopped until both are back.
    // The Alexa overlay sends blur alone, and its answer must not be heard
    // over the game's.
    let active = appState.getCurrentState() === 'active';
    let focused = true;
    const sync = () => {
      const ready = active && focused;
      sounds.setSuspended(!ready);
      music.setSuspended(!ready);
      activity.setActive(ready);
      onState?.(`activity ${ready ? 'active' : 'paused'}`);
    };
    sync();
    const subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') {
        active = true;
        sync();
        if (away) reportFullyDrawn();
        away = false;
      } else {
        active = false;
        sync();
        away = true;
      }
    });
    const blur = appState.addEventListener('blur', () => {
      focused = false;
      sync();
    });
    const focus = appState.addEventListener('focus', () => {
      focused = true;
      sync();
    });
    return () => {
      subscription.remove();
      blur.remove();
      focus.remove();
      sounds.setSuspended(true);
      music.setSuspended(true);
      activity.setActive(false);
    };
  }, [appState, sounds, music, activity, reportFullyDrawn, onState]);

  const onCommit = React.useCallback(
    (game: Game) => {
      void store.save(game).catch(() => undefined);
      count(game);
    },
    [count, store],
  );

  return (
    <ActivityContext.Provider value={activity}>
      <GameScreen
        options={options}
        initial={opened.game}
        onCommit={onCommit}
        ledger={ledger}
        onState={onState}
        sounds={sounds}
        initialSound={initialSound}
        onSound={onSound}
        initialTurnBoard={initialTurnBoard}
        onTurnBoard={onTurnBoard}
        initialVoices={initialVoices}
        onVoices={onVoices}
        initialHost={initialHost}
        onHost={onHost}
        music={music}
        initialMusic={initialMusic}
        onMusic={onMusic}
        musicAvailable={musicAvailable}
        offerTutorial={offerTutorial}
        onTutorialOffered={onTutorialOffered}
      />
    </ActivityContext.Provider>
  );
};
