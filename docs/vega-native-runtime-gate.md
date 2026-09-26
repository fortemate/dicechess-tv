# Native runtime gate — 22 September 2026

First checkpoint of [#12](https://github.com/fortemate/dicechess-tv/issues/12): can the
canonical engine and the extracted core run in React Native for Vega without a WebView,
DOM, Svelte or Chessground?

## Result

Yes, on a Vega Virtual Device. A native package containing
`@fortemate/dicechess-engine` 0.12.2 and `src/core` installs, launches, renders and stays
running on SDK 0.24.12112, and a complete Dice Chess turn executes with output identical
to the same fixture on the development host. The crash buffer stayed empty — the WebView
probe's `SIGSEGV` is not reproduced on the native path.

No Metro configuration change was needed. The generated template resolved the
ES-module-only engine on its default config.

## What this does not show

This ran on the **Virtual Device, not on Fire TV hardware**. It renders a text report, not
a board: nothing here draws a piece or accepts a remote key. The one timing number below
is the device's own launch metric for this probe, not a board measurement, and there is no
memory measurement. No visual capture was taken, because the CLI has no screenshot
command.

The remote-input, board-rendering and measurement criteria of #12 remain open. Only the
runtime question is answered.

## Device run

### Environment

- Host: Apple Silicon macOS 26.7, Node 26.8.2 (the version in `mise.toml`).
- Vega CLI **1.3.4**; SDK **0.24.12112**, released 21 September 2026, installed fresh on
  this machine and set active. This is one build newer than the 0.24.12044 whose WebView
  crash is recorded in [the SDK experiment](vega-sdk-experiment.md).
- Vega Virtual Device, 1920 × 1080, aarch64, OS 1.2. It stayed up for the whole session;
  the earlier note's silent first-launch exit did not recur.
- Template `helloWorld` — the **native** template, not `vegaWebview` — generated as
  `DiceChessGateProbe`, package id `com.fortemate.dicechessgateprobe`, under
  `~/vega/samples`. React Native 0.83.0, React 19.2.0,
  `@amazon-devices/react-native-kepler` 4.0.0.
- Core under test: `src/core/{board,game,model}.ts`, copied unmodified. That directory
  arrives with [#13](https://github.com/fortemate/dicechess-tv/pull/13); before it merges,
  take the three files from that branch.

As with the earlier SDK work, the generated template is not committed. Installing the
template's dependencies reported **27 npm audit findings (14 moderate, 13 high)**, the
same count the earlier note recorded; they still need review before a shell is adopted.

> Superseded on 2026-09-23. The application is now built from `native/` in this
> repository and nothing is scaffolded. Both questions this paragraph left open —
> redistribution licensing and the audit findings — are answered in the open-items
> list below and in `native/README.md`.

### Steps

```bash
vega project generate --template helloWorld --name DiceChessGateProbe \
  --packageId com.fortemate.dicechessgateprobe \
  --outputDir ~/vega/samples/DiceChessGateProbe
cd ~/vega/samples/DiceChessGateProbe
vega exec npm install
vega exec npm install @fortemate/dicechess-engine@0.12.2
# copy src/core/{board,game,model}.ts to src/core/, add the fixture below as src/gate.ts,
# and replace src/App.tsx with a View/Text screen that renders runGate()
vega exec npx react-native build-vega --build-type Release --target aarch64 --max-workers 2
vega virtual-device start --display-res=1920,1080
vega device install-app -d VirtualDevice -p build/aarch64-release/dicechessgateprobe_aarch64.vpkg
vega device launch-app -d VirtualDevice -a com.fortemate.dicechessgateprobe.main
```

`metro.config.js` was left exactly as generated.

### Observations

| Check                                  | Result                                       |
| -------------------------------------- | -------------------------------------------- |
| Metro resolves the engine              | yes, on the template's default config        |
| Release aarch64 package                | built, 2,327,157 bytes, OS version 1.2       |
| Install and launch                     | success, reached `FOREGROUND in state READY` |
| App stays running                      | yes, still running after the run             |
| `vlcm crash-history`                   | `AppCrashInfoBuffer: Size: 0`                |
| Rendering                              | `Volta: Shader cache has been saved to disk` |
| JS errors in the log stream            | none                                         |
| `cool_app_launch_time` (device metric) | 404 ms, then 426 ms                          |

The gate report, sent by the app from the device:

```
engine rules module: object
rolled dice: QRN
  legal 4 dice QRN -> b1a3
  legal 1 dice QR -> a1b1
phase handoff moves b1a3,a1b1 left "Q"
dfen rnbqkbnr/pppppppp/8/8/8/N7/PPPPPPPP/1RBQKBNR w Kkq - 2 1 Q
handoff -> side b turn 2
GATE PASS
```

This is byte-identical to the host pre-gate below. The turn is canonical throughout: four
legal actions on the opening roll, one after the knight moves, the queen die left unusable
so the turn ends in `handoff` rather than a fourth action, castling rights updated from
`KQkq` to `Kkq` because the a1 rook moved, and `endTurn` handing play to Black on turn 2.

### Reading the result off the device

A Release build does **not** route `console.log` to `vega device start-log-stream`; only
system and graphics lines appear. The CLI has no screenshot command, so the rendered
screen could not be captured either.

The report was therefore retrieved the way the earlier experiment retrieved DOM
diagnostics: a loopback-only receiver on the development Mac, reached through
`vega device start-port-forwarding --port 8099 --forward false`, with a single `fetch`
from the app. The receiver, the forwarding rule and the `fetch` were removed after the
run; the fixture below contains no network call. This is development instrumentation, not
a game server, and nothing about the eventual offline requirement changes.

Anyone reproducing this should plan for the same problem: decide up front how the device
will report, because neither logs nor screenshots will do it.

## Host pre-gate

Before the SDK was installed, the same fixture was run against both React Native
toolchains that the two Vega SDK lines correspond to. It is kept here because it isolates
the bundler question from the device, and because it found the one real obstacle.

| Toolchain            | Corresponds to | Versions                                                         |
| -------------------- | -------------- | ---------------------------------------------------------------- |
| React Native 0.83.10 | SDK 0.24 line  | React 19.2.0, Metro 0.83.8, `@react-native/metro-config` 0.83.10 |
| React Native 0.72.17 | SDK 0.23.9221  | React 18.2.0, Metro 0.76.9, `@react-native/metro-config` 0.72.11 |

| Check                               | RN 0.83             | RN 0.72                                 |
| ----------------------------------- | ------------------- | --------------------------------------- |
| Metro resolves `@fortemate/…/rules` | yes, default config | **no** without configuration; see below |
| Complete turn executes              | `GATE PASS`         | `GATE PASS`, identical output           |
| `hermesc -emit-binary`              | no errors           | no errors                               |

Sizes, as an input to a later device measurement rather than a measurement:

| Bundle                            | JavaScript | Hermes bytecode |
| --------------------------------- | ---------- | --------------- |
| `/rules` + core (RN 0.83)         | 374,766 B  | 838,295 B       |
| `/rules` + core (RN 0.72)         | 374,121 B  | 809,168 B       |
| full engine entry point (RN 0.83) | 498,048 B  | 1,057,691 B     |

The board needs only `/rules`, which is what `src/core/game.ts` imports. The full entry
point is what `src/bot.worker.ts` imports today, so a native bot would carry the larger
payload.

> **Since engine 0.13.0 (#101)**, `src/core/game.ts` imports the full entry for the legal
> turn tree, and `src/core/bot.ts` imported it already, so every build carries the full
> entry. The sizes above are the record of the gate.

### The Metro resolution obstacle

The engine is published as ES modules only, with a `./rules` subpath in `exports` and no
`require` or `react-native` condition. Metro 0.76, which ships with React Native 0.72,
does not read `exports` by default and fails with:

```
Unable to resolve module @fortemate/dicechess-engine/rules
```

Metro 0.76 implements the resolution; it is off by default. Enabling it is sufficient:

```js
resolver: {
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['require', 'import', 'react-native'],
}
```

Metro 0.83, including the version in the SDK 0.24 template, needs none of this.

### Host globals

Grepping the production bundles for globals a restricted engine may lack, then reading
each reference in context:

| Global                                     | Where                                       | Reachable?                             |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------- |
| `BigInt`                                   | a `case 'bigint'` arm of a typeof switch    | no — the API takes strings and numbers |
| `window`                                   | `typeof window !== 'undefined' ? …`         | guarded global detection               |
| `performance`                              | `… && performance.now ? performance : Date` | guarded, falls back to `Date`          |
| `process`                                  | Metro's own prelude                         | Metro supplies it                      |
| `Reflect`, `WeakMap`, `Symbol.iterator`    | engine                                      | present in Hermes-class engines        |
| `Math.imul`/`clz32`/`fround`, typed arrays | engine                                      | present in Hermes-class engines        |

No `Proxy`, `Intl`, `TextDecoder`, `eval`, `Function` constructor, `SharedArrayBuffer`,
`Atomics`, `WeakRef` or `FinalizationRegistry`. `performance` does not appear in the
`/rules` bundle at all, so the board path never reaches it.

## Fixture

```ts
import { DiceChess } from '@fortemate/dicechess-engine/rules';
import { newGame, rollGame, moveGame, viewGame, nextTurn } from './core/game';

export function runGate(): string[] {
  const lines: string[] = [];
  try {
    lines.push('engine rules module: ' + typeof DiceChess);
    let game = newGame('hotseat', 'gate');
    // Fixed instructional roll: queen, rook, knight.
    game = rollGame(game, [5, 4, 2]);
    lines.push('rolled dice: ' + viewGame(game).remaining);
    let guard = 0;
    while (game.phase === 'move' && guard++ < 4) {
      const state = viewGame(game);
      const move = state.legal[0];
      lines.push(
        '  legal ' +
          state.legal.length +
          ' dice ' +
          state.remaining +
          ' -> ' +
          move,
      );
      game = moveGame(game, move);
    }
    const end = viewGame(game);
    lines.push(
      'phase ' +
        game.phase +
        ' moves ' +
        game.moves.join(',') +
        ' left "' +
        end.remaining +
        '"',
    );
    lines.push('dfen ' + end.dfen);
    if (game.phase === 'handoff') {
      const handed = nextTurn(game);
      lines.push(
        'handoff -> side ' + viewGame(handed).side + ' turn ' + handed.turn,
      );
    }
    lines.push('GATE PASS');
  } catch (error) {
    lines.push('GATE FAIL: ' + (error as Error).message);
  }
  return lines;
}
```

The fixture chooses `legal[0]` rather than hard-coded moves. An earlier version played
hard-coded moves and the engine rejected one as illegal, which is itself useful: the
bundled engine is deciding legality, not returning a stub.

## Consequence for the SDK target

SDK 0.23 was adopted because SDK 0.24 crashed the native WebView library. A native board
uses no WebView, that crash did not recur here on 0.24.12112, and 0.24's Metro resolves
the engine unconfigured. Build the prototype against SDK 0.24.

This says nothing about the WebView application, which remains on 0.23 and whose own
behaviour on 0.24.12112 has not been retested.

## Verification still required

- Accept D-pad, OK and Back input, and emit move intent. Nothing here does either.
  A board renderer landed separately in
  [#15](https://github.com/fortemate/dicechess-tv/pull/15).
- Measure launch-to-interactive and input-to-visible-response for a board, with a stated
  repeatable method. The 404/426 ms above is the device's launch metric for a text probe.
- Repeat on physical Fire TV hardware; see
  [#10](https://github.com/fortemate/dicechess-tv/issues/10).
- Establish whether a native bot can run off the UI thread. React Native has no Web
  Worker, and `src/bot.worker.ts` depends on one today.
  `@amazon-devices/headless-task-manager` is the lead worth trying first.
- ~~Review the template's 27 audit findings and its redistribution licensing before any
  shell is adopted into the repository.~~ **Done 2026-09-23**; the application now
  builds from `native/` in this repository. Licensing: what is committed is our own
  configuration, and every dependency — Amazon's included — comes from the public npm
  registry, so nothing of theirs is redistributed. The SDK itself stays out, licensed
  to each developer under Amazon's Program Materials License Agreement. Audit: 20
  findings remain, and none of them ship. The built package holds only our Hermes
  bundle, `libreact-native-mmkv-kepler.so` and metadata; `minimatch`, `toml`, `braces`
  and `micromatch` appear in it zero times. The findings are in build tooling, and
  `npm audit fix --force` would "fix" them by downgrading
  `@amazon-devices/react-native-kepler` to 2.1.0 — back to the SDK 0.23 line this note
  exists to leave behind. See `native/README.md`.

## Corrections

Two claims in the first version of this note were wrong, and both were corrected by
looking rather than reasoning.

**Piece rendering.** It said `react-native-svg` needs native code and should not be
assumed available, so the pieces would need a raster fallback.
`@amazon-devices/react-native-svg` is in fact system-deployed on Vega, and the device
confirms `Svg`, `G`, `Path`, `Rect` and `Circle` all resolve. It accepts inline JSX only —
no external `.svg` files and no CSS `<style>` blocks — but every element the RhosGFX
sources use is supported, so the pieces are real vectors and no raster fallback is needed.
See [#15](https://github.com/fortemate/dicechess-tv/pull/15).

**Reporting from the device.** The loopback bridge above is not the only route:
`@amazon-devices/kepler-file-system` exists and would let the device write a file to be
copied off with `vega device copy-from`, without any network path at all. That is the
better channel for the next diagnostic.

The device does ship `/usr/bin/screenshooter` and `/usr/bin/gwsi-tool-screenshooter`.
Neither produced an image: with the default runtime directory the capture buffer fails
with `Permission denied`, and running with `XDG_RUNTIME_DIR` pointed at a writable
directory clears that but leaves `null value passed for arg 1` from the capture call, with
a zero-byte PNG as the only output. Visual capture of a Vega device is therefore still
unsolved.
