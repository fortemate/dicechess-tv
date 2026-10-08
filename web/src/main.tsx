// The bench: the television's app on a 16:9 stage, the controls that switch
// its marks and the colour-vision filter, and the keyboard as the remote.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { App } from '../../native/src/App';
import { THEME } from '../../native/src/theme';
import { TV_HEIGHT, TV_WIDTH } from './shims/react-native';
import { onAppExit } from './shims/kepler';
import { clearSaved } from './shims/mmkv';
import { installKeyboard } from './keyboard';
import { CvdFilters, filterOf } from './Cvd';
import {
  CVD,
  DEFAULT_MARKS,
  MARKS,
  PRESETS,
  formatBench,
  getBench,
  parseBench,
  presetOf,
  setBench,
  subscribeBench,
  type Bench,
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
  cursor: 'Cursor',
  lastMove: 'Last move',
  palette: 'Colours',
};

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
    url.search = formatBench({ ...bench, cvd: 'none', controls: false });
    void navigator.clipboard?.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <header className="controls">
      <label>
        <span>Preset</span>
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
        <kbd>C</kbd> vision · <kbd>V</kbd> next preset
      </p>
    </header>
  );
};

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

  React.useEffect(() => {
    onAppExit(() => {
      exitedRef.current = true;
      setExited(true);
    });
    return installKeyboard({
      onAny: () => {
        if (!exitedRef.current) return false;
        exitedRef.current = false;
        setExited(false);
        setLaunch((count) => count + 1);
        return true;
      },
      onPress: () => setPresses((count) => count + 1),
      onOther: (key) => {
        const current = getBench();
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
          <View style={{ width: TV_WIDTH, height: TV_HEIGHT }}>
            {exited ? null : <App key={launch} />}
          </View>
          {exited ? (
            <div className="exited">
              <p>Back here closes the app on the television.</p>
              <p>Press any key to launch it again.</p>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
};

createRoot(document.getElementById('root')!).render(<Bench />);
