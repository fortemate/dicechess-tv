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

- Render a board and accept D-pad, OK and Back input. Nothing here does either.
- Measure launch-to-interactive and input-to-visible-response for a board, with a stated
  repeatable method. The 404/426 ms above is the device's launch metric for a text probe.
- Repeat on physical Fire TV hardware; see
  [#10](https://github.com/fortemate/dicechess-tv/issues/10).
- Establish whether a native bot can run off the UI thread. React Native has no Web
  Worker, and `src/bot.worker.ts` depends on one today.
- Confirm a Vega-supported way to draw the pieces. `react-native-svg` needs native code
  and is not assumed to be available.
- Review the template's 27 audit findings and its redistribution licensing before any
  shell is adopted into the repository.
