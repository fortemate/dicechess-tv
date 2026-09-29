# The browser test bench

A way to hand the game to a tester without an emulator. The bench draws the
screens in [`native/src/`](../native/src/) with
[react-native-web](https://necolas.github.io/react-native-web/), on a 16:9 stage
of the television's own 960 x 540 dp, scaled to fit the browser window. The
keyboard plays the remote.

It exists for two questions:

- **How the board's marks read**, including to colour-blind people: each mark can
  be switched on its own, and the whole screen can be viewed through a
  colour-vision simulation.
- **How the remote's navigation feels**: the same input path as the television,
  from arrow keys, with a count of the presses spent.

It is not the product and not a second client. Nothing here changes the game;
the bench swaps only the platform underneath it. What it shows is evidence from
a browser, not from the Vega Virtual Device or a Fire TV Stick: colours on a
monitor, a keyboard's repeat rate and the browser's media stack all differ from
the television's.

## Running it

```bash
npm ci           # at the root: the engine, which src/core/ imports
cd web
npm ci
npm run dev      # http://localhost:5173/
npm run build    # into dist/, a static site
npm test         # the address format of the variants
```

`dist/` is self-contained and uses relative paths, so it can be served from any
directory of any static host.

## Keys

| Key                 | Remote             |
| ------------------- | ------------------ |
| Arrow keys          | D-pad              |
| Enter or Space      | OK                 |
| Escape or Backspace | Back               |
| C                   | next vision filter |
| V                   | next preset        |

Back where the television would close the app shows that it would, and the next
key launches it again from its saved game. **New session** forgets the saved
game and settings; the browser keeps them otherwise, like the television.

## Variants in the address

Every choice is in the page's address, and only what differs from the television
is written, so the bare address is the game as it ships. **Tester link** copies
the current marks with the controls hidden (`ui=0`), for handing one exact
variant to someone.

| Parameter  | Mark                            | Options (first is the television's)                                 |
| ---------- | ------------------------------- | ------------------------------------------------------------------- |
| `movable`  | a piece that can move now       | `fill`, `fill-corners`, `corners`, `outline`, `badge`, `none`       |
| `selected` | the picked-up piece             | `tint-frame`, `frame`, `solid`, `lift`                              |
| `dest`     | where it can go                 | `dot`, `dot-large`, `fill`, `corners`, `outline`                    |
| `cursor`   | the remote's cursor             | `frame`, `thick`, `two-tone`                                        |
| `last`     | both squares of the last action | `tint`, `outline`, `none`                                           |
| `palette`  | the colours of all of them      | `tv`, `okabe-ito`, `high-contrast`                                  |
| `cvd`      | colour-vision simulation        | `none`, `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia` |
| `ui`       | `0` hides the bench's controls  |                                                                     |

`fill`, `fill-corners` and `corners` are variants A, B and C of the
colour-vision check on the project site (#105, #108). With every mark at its
first option and the `tv` palette, the board is drawn by
`native/src/Square.tsx` itself; any other choice is drawn by
[`src/Square.tsx`](src/Square.tsx) in the same layers.

The simulation uses the severity-1 matrices of Machado, Oliveira and Fernandes
(2009) for the three dichromacies, and luminance alone for achromatopsia. It
shows where colours collapse into each other; it does not replace testers with
those deficiencies.

## How it is put together

- [`vite.config.ts`](vite.config.ts) aliases every `@amazon-devices/*` package to a
  stand-in in [`src/shims/`](src/shims/), and swaps one import:
  `native/src/Board.tsx` draws its squares with `src/Square.tsx` here.
- `react-native` is react-native-web, except that the window is always 960 x 540,
  the size Vega reports.
- The sounds are the vendored cues in `native/sounds/`, played on HTML audio
  elements. The music is left out: the app finds no catalogue and leaves it out
  of its menu.
- React is pinned to the version `native/` uses, so both draw with the same
  React. The engine is not a dependency here: `src/core/` imports it from the
  root install, so the bench always plays the engine the game is checked with.

The bench serves the vendored cues as files anyone can download. The JDSherbert
licence forbids redistributing the raw files; the owner has the author's
written permission for the bench.
