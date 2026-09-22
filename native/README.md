# Native board

React Native for Vega renderer for the Dice Chess board. It draws what
`src/core/boardView.ts` describes and nothing else: it owns no rules, decides no
legality, and emits no moves. The Svelte/WebView app in `src/` is untouched and
remains the shipping path.

See [the runtime gate](../docs/vega-native-runtime-gate.md) for the evidence that
the canonical engine runs in this runtime, and
[#12](https://github.com/fortemate/dicechess-tv/issues/12) for the scope.

## What is here

| Path                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `src/Board.tsx`               | The 8x8 grid. Takes a board size and the `boardView()` inputs. |
| `src/BoardScreen.tsx`         | A check screen driven by real engine state.                    |
| `src/theme.ts`                | Square, cursor, destination and last-move colours.             |
| `src/pieces/`                 | Generated piece components, one per FEN letter.                |
| `scripts/generate-pieces.mjs` | Regenerates `src/pieces/` from the RhosGFX SVG sources.        |

The shared game logic is **not** duplicated here. `Board.tsx` imports
`src/core/boardView.ts`, and `BoardScreen.tsx` imports `src/core/game.ts`, so the
native board and the web probe run the same tested controller.

## Pieces

`@amazon-devices/react-native-svg` is system-deployed on Vega, but it accepts
inline JSX elements only: no external `.svg` files (no `SvgUri` or `SvgXml`) and
no CSS `<style>` blocks. The RhosGFX sources in `src/assets/pieces/rhosgfx/` are
authored exactly that way, so the generator resolves each class into inline props
and writes one component per piece.

The sources use only `svg`, `defs`, `style`, `g`, `path`, `rect` and `circle`.
Every one of those except `<style>` is supported, so no shape is approximated and
no raster fallback is needed.

Regenerate with:

```bash
node native/scripts/generate-pieces.mjs && npm run format
```

The generated files are checked in and `npm run format:check` covers `native/`,
so always format afterwards. Regenerating and formatting reproduces the checked-in
files byte for byte.

Artwork is RhosGFX vector chess pieces, CC0; see `licenses/RhosGFX-CC0.txt` and
`THIRD_PARTY_NOTICES.md`.

## Building and running

There is no Vega project in this repository. The generated SDK template is not
committed, for the same reason it was not committed for the earlier experiments:
its dependencies and redistribution licensing have not been reviewed. Scaffold a
project and overlay these files instead, as
[the runtime gate](../docs/vega-native-runtime-gate.md) describes, then point the
template's `src/App.tsx` at `BoardScreen`.

Target **SDK 0.24**. Its Metro resolves the engine without configuration, and the
native path does not use the WebView whose crash pinned the web app to SDK 0.23.

## Verification

Run on a Vega Virtual Device at 1920x1080, SDK 0.24.12112. The package builds,
installs, launches and stays running with an empty crash buffer; the SVG
primitives and all twelve piece components resolve; and the device reports 64
squares, 32 pieces and 32 dark squares with the cursor, selection, legal
destinations and last move on four distinct sets of squares.

**The owner confirmed on 22 September 2026 that all twelve pieces display well.**
That confirmation is by eye, because the screen could not be captured: the
device's `screenshooter` fails its capture call even once its buffer-permission
problem is worked around, and the host cannot grab the emulator window.

**A complete turn was driven from the keyboard on the same day**, and the device
reported every step: the roll produced `dice QRN legal 4`; four presses walked
the cursor e2 → e1 → d1 → c1 → b1; OK gave `selected b1`; three presses walked it
b2 → b3 → c3; OK left `dice QR legal 1 last b1c3`. Ten presses, ten reactions, no
spurious ones.

The Back key reaches the app: the owner saw `HW type=back` on a diagnostic screen
that printed raw events. That its cancel behaviour works inside `GameScreen` is
still covered only by tests.

Not confirmed by anyone yet: whether the focus and destination overlays stay
visible on both square colours, and legibility at TV viewing distance.

## Checks

This directory is its own npm package, with its own lockfile, because it needs
`react`, `react-native` and `@amazon-devices/react-native-svg`, and those must not
reach the web app's dependencies. CI runs it as the `native-board` job.

```bash
npm ci                      # the repository root: the shared core needs the engine
npm ci --prefix native
npm run check --prefix native
npm test --prefix native
```

`npm run check` typechecks `native/src`, `native/test` and the shared `src/core`
together, so a renderer that misreads a `SquareView` field fails here.

`npm test` renders the board with `react-test-renderer` and asserts the tree:
64 squares, 32 of each colour, a1 dark, 32 pieces drawn by their own components
and inset inside their squares, one dashed ring per legal destination, both ends
of the last move tinted, and the selected ring twice the width of the cursor ring
so the two are distinguishable. A colour flip, a dropped overlay and pieces
overflowing their square were each injected and each failed the expected test.

`react-native` and the Vega SVG package cannot be imported outside a React Native
runtime, so `test/hooks.mjs` redirects them to small stubs in `test/stubs/` and
compiles TypeScript and JSX with esbuild. The tests therefore check the tree this
renderer builds, not how Vega paints it — that part is verified on a device.

`react-test-renderer` prints a deprecation warning under React 19. It is what the
Vega template itself depends on, so it stays until Amazon's template moves.

## Remote input

Vega offers more than one input channel and only one of them works. All three
were tried on a device:

| API                                     | Result                                        |
| --------------------------------------- | --------------------------------------------- |
| `UserInputManager.addListener` (static) | aborts the JS thread with `SIGABRT` on 0.24   |
| `useAddUserInputListenerCallback()`     | subscribes with no error and delivers nothing |
| `useTVEventHandler`                     | works; this is what `useRemoteInput` uses     |

The middle one is the trap: it fails silently, and silence is indistinguishable
from nobody pressing a key.

`eventType` arrives lower-case. A keyboard on the Virtual Device sends **`enter`**
for the OK button while a physical remote sends `select`, so both are mapped or
the board would work in the emulator and be deaf on hardware. `eventKeyAction` is
`0` when the button goes down and on every repeat while it is held, and `1` once
on release: directions act on the press so holding walks the cursor, and select
and back act on the release so one press is one action.

`GameScreen` is a `useReducer`, not a set of handlers, because held repeats can
arrive faster than React re-renders. Handlers closing over state read a stale
cursor and silently drop moves; a test that holds a direction for three repeats
catches it.

## Saving

`@amazon-devices/react-native-mmkv` is synchronous and backed by a memory-mapped
file, so the saved game is read before the first render and the board never shows
a fresh position that is about to be replaced. An asynchronous store would need a
loading state.

The contract lives in `src/core/snapshotStore.ts` and both frontends honour it: a
snapshot is serialised and validated _before_ anything is written, so a damaged
snapshot cannot replace a good one and a caller cannot mutate a write in flight.

What this does **not** carry over from the web store is its explicit
strict-durability assertion. IndexedDB lets that store check
`transaction.durability === 'strict'` and refuse to write otherwise; MMKV exposes
no such flag, so this store claims only what was measured — a value written
before a forced process kill is the value read back after it.

The cursor is deliberately not saved. Where someone is looking is not game state.

Verified on a device on 22 September 2026, driven from the keyboard. A turn was
played to `dice "QR" | legal 1 | last b1c3 | moves b1c3`, the app was force-killed,
and the relaunch reported `phase move | dice "QR" | legal 1 | last b1c3 | moves
b1c3` with the cursor back at its starting square. The consumed knight die stays
consumed, so a restart cannot reroll a partial turn.

One trap worth keeping: an earlier version of this app rendered `null` until an
effect had read the store. The board then never received remote input at all —
every key press was lost, silently. Reading the snapshot synchronously during the
first render fixed it. Do not give this app a loading frame.

## Dice

**The Vega runtime does not provide `crypto.getRandomValues`.** That was measured
on a device: the app reports which source it got, and on SDK 0.24.12112 it is
`Math.random`. There is no crypto package to add — `@amazon-devices/react-native-get-random-values`
does not exist, and the community module of that name is native code that will
not link here.

So `randomSource()` picks the best source available and **names it**, because a
game that quietly rolls weaker dice than it claims is worse than one that says
so. Both paths feed the same rejection sampling in `src/core/game.ts`, so neither
has the modulo bias of an arbitrary byte `% 6`; what the native board loses
against the web probe is the cryptographic source, not the uniformity.

For a local hotseat game that is a defensible trade, but it is the owner's to
make, and it should be stated wherever the web app claims cryptographic dice.

## Menus

Flow lives in `src/screen.ts` as a pure reducer over state and one key, tested
directly rather than through the component. The board, the home screen, the menu,
the confirmations and the promotion chooser are all one state machine.

Two behaviours are carried over from the web probe deliberately:

- **Back cancels a selection before it opens the menu.** The board reducer is
  asked first and only reports `exit` when there is nothing to cancel.
- **Destructive choices confirm with Cancel selected first**, so a stray OK
  cannot discard a game in progress.

A restored game opens on the home screen rather than dropping the player into a
turn they may not remember. Only modes that exist are offered: there is no native
bot yet, so nothing claims one.

## Raster alternative

Pieces are vectors and no raster fallback is needed. PNGs remain available if
measurement on physical hardware ever shows that redrawing 32 multi-path pieces
costs too much while the cursor moves; the generator makes that switch cheap. Do
not make it without that measurement.

## Known gaps

- **No input.** Nothing here reads D-pad, OK or Back yet, and nothing emits move
  intent.
- **No coordinates or panel.** The board draws squares, pieces and the four
  overlay states; rank and file labels and the side panel are not implemented.
