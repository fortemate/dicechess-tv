// The bench: the television's app on a 16:9 stage, the controls that switch
// its marks and the colour-vision filter, and the keyboard as the remote.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { App } from '../../native/src/App';
import { Board } from '../../native/src/Board';
import { THEME } from '../../native/src/theme';
import { RULE, jump, type Direction } from '../../src/core/cursor';
import { TV_HEIGHT, TV_WIDTH } from './shims/react-native';
import { onAppExit } from './shims/kepler';
import { clearSaved } from './shims/mmkv';
import { installKeyboard } from './keyboard';
import { CvdFilters, filterOf } from './Cvd';
import { Carried } from './Square';
import {
  CVD,
  DEFAULT_MARKS,
  MARKS,
  PRESETS,
  VIEWS,
  formatBench,
  getBench,
  parseBench,
  presetOf,
  setBench,
  subscribeBench,
  type Bench,
  type BenchView,
  type MarkName,
  type Marks,
} from './marks';
import icon from '../../native/icon/icon-512.png';
import './bench.css';

// The bench plays without music: the app looks for its catalogue on the
// device's file system, and finding none it leaves music out of the menu.
const devicePath = /^file:\/\/\/pkg\//;
const fetchPage = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) =>
  devicePath.test(String(input instanceof Request ? input.url : input))
    ? Promise.resolve(new Response(null, { status: 404 }))
    : fetchPage(input, init);

setBench(parseBench(location.search));

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = icon;
document.head.append(favicon);

const useBench = () => React.useSyncExternalStore(subscribeBench, getBench);

const update = (next: Bench) => {
  setBench(next);
  history.replaceState(null, '', location.pathname + formatBench(next));
};

const setMark = <Name extends MarkName>(name: Name, value: Marks[Name]) =>
  update({ ...getBench(), marks: { ...getBench().marks, [name]: value } });

const nextOf = <T,>(options: readonly T[], value: T) =>
  options[(options.indexOf(value) + 1) % options.length];

// The largest 16:9 stage that fits under the controls.
const useScale = (host: React.RefObject<HTMLElement | null>) => {
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const fit = () =>
      setScale(
        Math.min(
          element.clientWidth / TV_WIDTH,
          element.clientHeight / TV_HEIGHT,
        ),
      );
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return scale;
};

const LABELS: Record<MarkName, string> = {
  movable: 'Can move',
  selected: 'Picked up',
  destination: 'Can go to',
  target: 'Target',
  cursor: 'Cursor',
  lastMove: 'Last move',
  palette: 'Colours',
};

const VIEW_LABELS: Record<BenchView, string> = {
  game: 'Live game',
  compare: 'Compare Step 1 & 2',
};

// Scotch position for the side-by-side comparison (#401):
// - Last move b8c6 covers one dark square (b8) and one light square (c6).
// - Step 1 has 10 movable pieces across light and dark squares.
// - Step 2 picks up the Queen on d4 (dark square), whose legal destinations
//   include captures on both light (d5) and dark (e5, a7) squares as well as
//   empty squares of both colours (c4, a4, d3, d2 light; b4, c5, b6, e3, d1 dark).
const COMPARE_BOARD = 'r1bqkbnr/ppp2ppp/2n5/3pp3/3QP3/2N2N2/PPP2PPP/R1B1KB1R';
const COMPARE_LAST_MOVE = 'b8c6';
const COMPARE_MOVABLE = [
  'a2',
  'b2',
  'c2',
  'f2',
  'g2',
  'h2',
  'e4',
  'c3',
  'f3',
  'd4',
] as const;
const COMPARE_SELECTED = 'd4';
const COMPARE_LEGAL = [
  'd4d5',
  'd4e5',
  'd4a7',
  'd4c4',
  'd4b4',
  'd4a4',
  'd4c5',
  'd4b6',
  'd4e3',
  'd4d3',
  'd4d2',
  'd4d1',
] as const;
const COMPARE_DESTINATIONS = COMPARE_LEGAL.map((move) => move.slice(2, 4));
const COMPARE_BOARD_SIZE = 432;

const DIRECTIONS: ReadonlySet<string> = new Set([
  'up',
  'down',
  'left',
  'right',
]);

// A control gives the keyboard back to the game as soon as it is used, so the
// next arrow moves the cursor instead of the choice.
const done = (event: React.SyntheticEvent<HTMLElement>) =>
  event.currentTarget.blur();

const Controls = ({
  presses,
  onReset,
}: {
  presses: number;
  onReset: () => void;
}) => {
  const bench = useBench();
  const [copied, setCopied] = React.useState(false);
  const preset = presetOf(bench.marks) ?? '';
  const testerLink = () => {
    const url = new URL(location.href);
    url.search = formatBench({
      ...bench,
      cvd: 'none',
      view: 'game',
      controls: false,
    });
    void navigator.clipboard?.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <header className="controls">
      <label>
        <span>View (B)</span>
        <select
          value={bench.view}
          onChange={(event) => {
            update({ ...bench, view: event.target.value as BenchView });
            done(event);
          }}
        >
          {VIEWS.map((option) => (
            <option key={option} value={option}>
              {VIEW_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Preset (V)</span>
        <select
          value={preset}
          onChange={(event) => {
            const marks = PRESETS[event.target.value];
            if (marks)
              update({ ...bench, marks: { ...DEFAULT_MARKS, ...marks } });
            done(event);
          }}
        >
          {preset ? null : <option value="">Custom</option>}
          {Object.keys(PRESETS).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {(Object.keys(MARKS) as MarkName[]).map((name) => (
        <label key={name}>
          <span>{LABELS[name]}</span>
          <select
            value={bench.marks[name]}
            onChange={(event) => {
              setMark(name, event.target.value as Marks[typeof name]);
              done(event);
            }}
          >
            {MARKS[name].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      ))}
      <label className="cvd">
        <span>Vision (C)</span>
        <select
          value={bench.cvd}
          onChange={(event) => {
            update({ ...bench, cvd: event.target.value as Bench['cvd'] });
            done(event);
          }}
        >
          {CVD.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <div className="presses" title="Remote presses since the last reset">
        <span>Presses</span>
        <strong>{presses}</strong>
        <button
          onClick={(event) => {
            onReset();
            done(event);
          }}
        >
          Reset
        </button>
      </div>
      <div className="actions">
        <button
          title="Copy a link with these marks and without the controls"
          onClick={(event) => {
            testerLink();
            done(event);
          }}
        >
          {copied ? 'Copied' : 'Tester link'}
        </button>
        <button
          title="Forget the saved game and settings, and start again"
          onClick={() => {
            clearSaved();
            location.reload();
          }}
        >
          New session
        </button>
      </div>
      <p className="keys">
        <kbd>←↑→↓</kbd> D-pad · <kbd>Enter</kbd> OK · <kbd>Esc</kbd> Back ·{' '}
        <kbd>B</kbd> view · <kbd>C</kbd> vision · <kbd>V</kbd> preset
      </p>
    </header>
  );
};

const CompareStage = ({
  step1Cursor,
  step2Cursor,
}: {
  step1Cursor: string;
  step2Cursor: string;
}) => (
  <div className="compare-stage">
    <section className="compare-card">
      <div className="compare-header">
        <strong>Step 1 · Choose a piece</strong>
        <span>
          10 movable pieces · cursor on <code>{step1Cursor}</code> · last move{' '}
          <code>{COMPARE_LAST_MOVE}</code>
        </span>
      </div>
      <View style={{ width: COMPARE_BOARD_SIZE, height: COMPARE_BOARD_SIZE }}>
        <Board
          size={COMPARE_BOARD_SIZE}
          board={COMPARE_BOARD}
          lastMove={COMPARE_LAST_MOVE}
          movable={COMPARE_MOVABLE}
          cursor={step1Cursor}
        />
      </View>
    </section>
    <section className="compare-card">
      <div className="compare-header">
        <strong>Step 2 · Choose a destination</strong>
        <span>
          Queen picked up on <code>{COMPARE_SELECTED}</code> · cursor on{' '}
          <code>{step2Cursor}</code> (captures <code>d5</code>, <code>e5</code>,{' '}
          <code>a7</code>)
        </span>
      </div>
      <Carried.Provider value="Q">
        <View style={{ width: COMPARE_BOARD_SIZE, height: COMPARE_BOARD_SIZE }}>
          <Board
            size={COMPARE_BOARD_SIZE}
            board={COMPARE_BOARD}
            lastMove={COMPARE_LAST_MOVE}
            selected={COMPARE_SELECTED}
            legal={COMPARE_LEGAL}
            cursor={step2Cursor}
          />
        </View>
      </Carried.Provider>
    </section>
  </div>
);

const Bench = () => {
  const bench = useBench();
  const host = React.useRef<HTMLElement>(null);
  const scale = useScale(host);
  const [presses, setPresses] = React.useState(0);
  const [exited, setExited] = React.useState(false);
  const exitedRef = React.useRef(false);
  // Coming back after Back closed the app is a new launch: the app is mounted
  // afresh and reads its saved game, as it does on the television.
  const [launch, setLaunch] = React.useState(0);
  const [step1Cursor, setStep1Cursor] = React.useState('c3');
  const [step2Cursor, setStep2Cursor] = React.useState('d5');

  React.useEffect(() => {
    onAppExit(() => {
      exitedRef.current = true;
      setExited(true);
    });
    return installKeyboard({
      onAny: () => {
        if (getBench().view === 'compare') return false;
        if (!exitedRef.current) return false;
        exitedRef.current = false;
        setExited(false);
        setLaunch((count) => count + 1);
        return true;
      },
      onPress: (button) => {
        setPresses((count) => count + 1);
        if (getBench().view === 'compare' && DIRECTIONS.has(button)) {
          const direction = button as Direction;
          setStep1Cursor(
            (from) =>
              jump(from, COMPARE_MOVABLE, direction, {
                rule: RULE,
                wrap: true,
              }) ?? from,
          );
          setStep2Cursor(
            (from) =>
              jump(from, COMPARE_DESTINATIONS, direction, {
                rule: RULE,
                wrap: true,
              }) ?? from,
          );
        }
      },
      onOther: (key) => {
        const current = getBench();
        if (key === 'b' || key === 'B') {
          update({ ...current, view: nextOf(VIEWS, current.view) });
          return true;
        }
        if (key === 'c' || key === 'C') {
          update({ ...current, cvd: nextOf(CVD, current.cvd) });
          return true;
        }
        if (key === 'v' || key === 'V') {
          const names = Object.keys(PRESETS);
          const now = names.indexOf(presetOf(current.marks) ?? '');
          const marks = PRESETS[names[(now + 1) % names.length]];
          update({ ...current, marks: { ...DEFAULT_MARKS, ...marks } });
          return true;
        }
        return false;
      },
    });
  }, []);

  return (
    <>
      <CvdFilters />
      {bench.controls ? (
        <Controls presses={presses} onReset={() => setPresses(0)} />
      ) : null}
      <main ref={host} className="host">
        <div
          className="stage"
          style={{
            width: TV_WIDTH,
            height: TV_HEIGHT,
            zoom: scale,
            background: THEME.background,
            filter: filterOf(bench.cvd),
          }}
        >
          {bench.view === 'compare' ? (
            <CompareStage step1Cursor={step1Cursor} step2Cursor={step2Cursor} />
          ) : (
            <>
              <View style={{ width: TV_WIDTH, height: TV_HEIGHT }}>
                {exited ? null : <App key={launch} />}
              </View>
              {exited ? (
                <div className="exited">
                  <p>Back here closes the app on the television.</p>
                  <p>Press any key to launch it again.</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
};

createRoot(document.getElementById('root')!).render(<Bench />);
