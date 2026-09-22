# Native runtime gate — 22 September 2026

First checkpoint of [#12](https://github.com/fortemate/dicechess-tv/issues/12): can the
canonical engine and the extracted core run in a React Native bundle without a WebView,
DOM, Svelte or Chessground? This records the bundler and JavaScript-engine half. It is
not a device result.

## Result

`@fortemate/dicechess-engine` 0.12.2 and `src/core` bundle and execute under both React
Native toolchains that the two Vega SDK lines correspond to, and a complete Dice
Chess turn produces identical output on each. Hermes accepts the whole bundle: `hermesc`
compiled it to bytecode without errors. No host global that a restricted runtime is
likely to lack is required on a reachable code path.

The one real obstacle behaves exactly as predicted and is fixed by one line of Metro
configuration. It affects only the older toolchain.

## What this does not show

The gate ran on the development Mac, against Metro and Hermes. It did **not** run on a
Vega Virtual Device or on Fire TV hardware, and Vega's runtime is KeplerScript, not
Hermes. A Hermes result is the closest widely available proxy for a restricted mobile
engine; it is evidence that the code survives a native bundler and a non-browser engine,
not evidence that Vega loads it. Nothing here measures launch time, input latency or
memory, and nothing here renders a board.

Device execution remains the open half of the #12 checkpoint.

## Environment

- Host: Apple Silicon macOS 26.7, Node 26.8.2 (the version in `mise.toml`).
- Engine: `@fortemate/dicechess-engine` 0.12.2, from public npm.
- Core under test: `src/core/{board,game,model}.ts`, copied unmodified into each sample.
  That directory arrives with
  [#13](https://github.com/fortemate/dicechess-tv/pull/13); before it merges, take the
  three files from that branch.

| Toolchain            | Corresponds to | Versions                                                         |
| -------------------- | -------------- | ---------------------------------------------------------------- |
| React Native 0.83.10 | SDK 0.24.12044 | React 19.2.0, Metro 0.83.8, `@react-native/metro-config` 0.83.10 |
| React Native 0.72.17 | SDK 0.23.9221  | React 18.2.0, Metro 0.76.9, `@react-native/metro-config` 0.72.11 |

The samples were built outside the repository, as the earlier SDK work was. No generated
template, lockfile or bundle is committed.

## Method

In an empty directory per toolchain, install the versions above plus the engine, copy
`src/core/*.ts` to `core/`, add the default Metro config, and write this fixture:

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

for (const line of runGate()) console.log(line);
```

Then bundle, execute the bundle, and compile it to Hermes bytecode:

```bash
npx metro build gate.ts --out bundle.js --platform android --dev false
node bundle.js
<hermesc> -emit-binary -out bundle.hbc bundle.js
```

Executing a Metro bundle under Node exercises Metro's module registry and the engine's
own code, not a native engine. `hermesc` covers what Node cannot: whether Hermes accepts
the syntax and generates code for all of it. The two together are the proxy; neither is
a device.

The fixture chooses `legal[0]` rather than hard-coded moves. An earlier version played
hard-coded moves and the engine rejected one as illegal, which is itself useful: the
bundled engine is deciding legality, not returning a stub.

## Results

| Check                               | RN 0.83 / SDK 0.24  | RN 0.72 / SDK 0.23                      |
| ----------------------------------- | ------------------- | --------------------------------------- |
| Metro resolves `@fortemate/…/rules` | yes, default config | **no** without configuration; see below |
| Bundle builds                       | yes                 | yes, once package exports are enabled   |
| Complete turn executes              | `GATE PASS`         | `GATE PASS`, identical output           |
| `hermesc -emit-binary`              | no errors           | no errors                               |

Identical output from both:

```
engine rules module: object
rolled dice: QRN
  legal 4 dice QRN -> b1a3
  legal 1 dice QR -> a1b1
phase handoff moves b1a3,a1b1 left "Q"
dfen rnbqkbnr/pppppppp/8/8/8/N7/PPPPPPPP/1RBQKBNR w Kkq - 2 1 Q
handoff -> side b turn 2
```

The turn is canonical throughout: the engine filters to four legal actions on the opening
roll, reduces to one after the knight moves, leaves the queen die unusable so the turn
ends in `handoff` rather than a fourth action, updates castling rights from `KQkq` to
`Kkq` because the a1 rook moved, and `endTurn` hands play to Black on turn 2.

### The Metro resolution obstacle

The engine is published as ES modules only, with a `./rules` subpath in `exports` and no
`require` or `react-native` condition. Metro 0.76, which ships with React Native 0.72,
does not read `exports` by default and fails with:

```
Unable to resolve module @fortemate/dicechess-engine/rules
```

Metro 0.76 does implement the resolution; it is off by default. Enabling it is sufficient
and no other change was needed:

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  resolver: {
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['require', 'import', 'react-native'],
  },
});
```

Metro 0.83 needs none of this.

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
`Atomics`, `WeakRef` or `FinalizationRegistry`. `hermesc` warns that `performance` is
undeclared, which is expected for a `typeof` guard and did not stop it emitting bytecode.

`performance` appears only in the full engine entry point, not in `/rules`, so the board
path does not reach it at all.

### Size

Payload the runtime has to parse, as a first input to a later device measurement. These
are bundler outputs on a development host; they are not launch measurements.

| Bundle                            | JavaScript | Hermes bytecode |
| --------------------------------- | ---------- | --------------- |
| `/rules` + core (RN 0.83)         | 374,766 B  | 838,295 B       |
| `/rules` + core (RN 0.72)         | 374,121 B  | 809,168 B       |
| full engine entry point (RN 0.83) | 498,048 B  | 1,057,691 B     |

The board needs only `/rules`, which is what `src/core/game.ts` imports. The full entry
point is what `src/bot.worker.ts` imports today, so a native bot would carry the larger
payload.

## Consequence for the SDK target

SDK 0.23 was adopted because SDK 0.24 crashed the native WebView library. A native board
does not use a WebView, so that reason does not apply to it, and SDK 0.24's newer Metro
also resolves the engine without configuration. The prototype should therefore be built
against SDK 0.24 unless device testing contradicts it — while noting that evidence
gathered on 0.24 does not transfer to the WebView application, which remains on 0.23.

## Verification still required

- Execute the same fixture on a Vega Virtual Device and report whether KeplerScript loads
  the bundle. Until then no runtime criterion of #12 is met.
- Measure launch-to-interactive and input-to-visible-response on a device, with a stated
  repeatable method. The sizes above are not measurements.
- Establish whether a native bot can run off the UI thread at all; React Native has no Web
  Worker, and `src/bot.worker.ts` depends on one today.
- Confirm a Vega-supported way to draw the pieces. `react-native-svg` needs native code
  and is not assumed to be available.
