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

## Known gaps

- **Not typechecked or tested in CI.** `tsconfig.json` covers `src/` and `test/`
  only, and these files import `react`, `react-native` and
  `@amazon-devices/react-native-svg`, which are deliberately not root
  dependencies. Giving `native/` its own `package.json` and CI job is the next
  step; until then only `src/core/boardView.ts` is gated, through
  `test/boardView.test.ts`.
- **No input.** Nothing here reads D-pad, OK or Back yet, and nothing emits move
  intent.
- **No coordinates or panel.** The board draws squares, pieces and the four
  overlay states; rank and file labels and the side panel are not implemented.
