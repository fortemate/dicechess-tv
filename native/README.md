# Dice Chess TV on Vega

The React Native for Vega application: board, screens, remote input, saves and sound. The board draws what `src/core/boardView.ts` describes and nothing else: the rules live in the canonical engine behind the shared core in `src/core/`, so nothing here decides legality or invents a move.

Long-form technical documentation, platform findings, performance benchmarks and testing guides have moved to the [Dice Chess TV project site](https://dicechess-tv.fortemate.com/):

- **[Architecture & Data Flow](https://dicechess-tv.fortemate.com/technology/architecture/):** The pure TypeScript core, React Native for Vega shell, and the canonical engine.
- **[Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/):** Platform findings measured on the device (input channels, the three names of OK, Back handler, service declarations, audio formats, splash/icon traps, and scripted automation).
- **[Performance](https://dicechess-tv.fortemate.com/technology/performance/):** Launch KPIs on a Fire TV Stick (fully drawn in 2.65 s) and on the Virtual Device, bot decision speeds, and motion timings.
- **[How We Test & Review](https://dicechess-tv.fortemate.com/quality/):** Automated tests, CI, CodeQL, SonarCloud quality gate, CodeRabbit, pre-commit hooks, and the press evaluator.
- **[Build & Run](https://dicechess-tv.fortemate.com/contribute/build/):** Prerequisites, package variants, installation, security advisories, and Metro configuration.
- **[Project Layout](https://dicechess-tv.fortemate.com/contribute/layout/):** Repository structure, source directories, and scripts.
- **[Contributing](https://dicechess-tv.fortemate.com/contribute/contributing/):** CLA, pull-request conventions, and English-only repository standards.
- **[Credits & Licences](https://dicechess-tv.fortemate.com/contribute/credits/):** Provenance and licences for code, pieces, emojis, sound effects, and music.
- **[SDK Friction Log](https://dicechess-tv.fortemate.com/friction-log/):** 30 documented obstacles (FL-01 to FL-30) encountered with Amazon's Vega SDK and their solutions.

---

## What is here

| Path                           | Purpose                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/App.tsx`                  | The root: reads saves before first render; owns randomness, sound and music.                |
| `src/activity.ts`              | Foreground gate: pauses scheduled work and preserves its unfinished wait.                   |
| `src/GameScreen.tsx`           | The board and side status panel, with menus, dialogs, and prompts.                          |
| `src/Recovery.tsx`             | What a failure of the game screen shows: a way back that keeps the saved game (#255).       |
| `src/Matchup.tsx`              | Matchup HUD: the bot's dialogue block or a badge per side; turn frame; the host.            |
| `src/SpeechBubble.tsx`         | A line beside its speaker's portrait: 20 dp, three rows for a bot, two for the host.        |
| `src/useBotVoice.ts`           | Picks the bot's lines as the game moves and how long each stays on screen.                  |
| `src/useHostVoice.ts`          | Picks the host's lines at the pauses, says them, and returns the one to show.               |
| `src/screen.ts`                | The screen's whole flow, as a pure reducer over state and one action.                       |
| `src/OpponentScreen.tsx`       | Opponent selection: three cards with bot faces, difficulty, and how each one plays.         |
| `src/Portrait.tsx`             | A character's portrait, or its emoji face when the build has no portraits.                  |
| `src/TutorialScreen.tsx`       | Six-lesson interactive tutorial taught by Thinkle, on an isolated sandbox board.            |
| `src/tutorial.ts`              | The tutorial's flow, as a pure reducer over state and one key.                              |
| `src/TutorialOffer.tsx`        | The first launch's offer of the tutorial: Thinkle asks, Learn to play or Skip.              |
| `src/Teacher.tsx`              | Thinkle in the panel, for the tutorial and its offer: portrait, name and bubble.            |
| `src/RulesScreen.tsx`          | Dual-pane rules guide: topics on the left, selected explanation on the right.               |
| `src/AboutScreen.tsx`          | Project credits and third-party licence notices accessible via TV remote.                   |
| `src/Board.tsx`                | 8x8 grid rendering pieces, square tints, focus rings, and move slide animations.            |
| `src/Square.tsx`               | One square and its marks: last move, movable pieces, piece in hand, destinations, cursor.   |
| `src/Dice.tsx`                 | Three-dice tray with tumbling roll animations and dimmed unplayable dice.                   |
| `src/Option.tsx`               | Focusable menu and list items with cyan border frame and pressed state.                     |
| `src/layout.ts`                | TV safe area insets (5% overscan margin) and responsive board layout.                       |
| `src/theme.ts`                 | Board colours, square tints, selection rings, and theme constants.                          |
| `src/pieces/`                  | Generated SVG React components for all 12 chess pieces (RhosGFX CC0).                       |
| `src/faces/`                   | Generated SVG React components for opponent bot avatars (RhosGFX CC0).                      |
| `src/useRemoteInput.ts`        | Normalizes Vega remote events (`enter`, `kpenter`, `select`, `back`).                       |
| `src/useReducedMotion.ts`      | Whether the platform asks for less motion; slides and the dice tumble ask it.               |
| `src/useTutorialVoice.ts`      | Thinkle says each point of a tutorial lesson aloud, line after line.                        |
| `src/mmkvStore.ts`             | Synchronous snapshot store on MMKV for saves, ledger, and preferences.                      |
| `src/randomSource.ts`          | Runtime randomness selector feeding uniform rejection sampling.                             |
| `src/sound.ts`                 | Plays cues on three players (board, dice, result), and spoken lines on a fourth.            |
| `src/cueFiles.ts`              | Sound cue file mapping, generated by `scripts/vendor-sounds.mjs`.                           |
| `src/voiceFiles.ts`            | Bot and host clips, lengths, texts, generated by `scripts/vendor-voices.mjs`.               |
| `src/soundSetting.ts`          | Sound effects enable/disable toggle remembered across launches.                             |
| `src/voiceSetting.ts`          | Voices toggle for every spoken line, on by default, remembered across launches.             |
| `src/hostSetting.ts`           | Who hosts a game against a friend, Prowla (the default), Rolly, Thinkle or off, remembered. |
| `src/turnSetting.ts`           | Whether the board turns to the side to move in a game against a friend, off by default.     |
| `src/playAsSetting.ts`         | The colour played against the computer: Ask, Random (the default), White or Black (#352).   |
| `src/autoSelectSetting.ts`     | Whether OK presses itself when the board offers only one choice, off by default (#342).     |
| `src/tutorialOfferSetting.ts`  | Whether the first launch's offer of the tutorial was answered, remembered.                  |
| `src/music.ts`                 | Plays adaptive music: menu theme or danger-level tracks with crossfades.                    |
| `src/useDanger.ts`             | Measures king threat level at the start of each turn spread over frames.                    |
| `src/musicSetting.ts`          | Music volume and mute, one Settings row since #350 (volume 0 is off), remembered.           |
| `scripts/generate-pieces.mjs`  | Regenerates `src/pieces/` from RhosGFX vector SVG pieces.                                   |
| `scripts/generate-faces.mjs`   | Regenerates `src/faces/` from RhosGFX Vector Emojis.                                        |
| `scripts/rhosgfx-svg.mjs`      | Compiles SVG files into inline JSX compatible with Vega SVG.                                |
| `scripts/vendor-sounds.mjs`    | Vendors sounds from `dicechess-assets` at a pinned commit.                                  |
| `scripts/vendor-music.mjs`     | Vendors music from `dicechess-assets` at a pinned commit.                                   |
| `scripts/vendor-voices.mjs`    | Vendors the voices and `events.json` from `dicechess-assets` at a pinned commit.            |
| `scripts/vendor-portraits.mjs` | Vendors the portraits from `dicechess-assets` into git-ignored `portraits/`.                |
| `scripts/generate-assets.mjs`  | Builds `assets/` on each build: icon, splash, sounds, music, voices, portraits.             |
| `scripts/splash.mjs`           | Draws the launch splash, Thinkle with the dice and the title, at build time (`splash/`).    |
| `scripts/install.mjs`          | Installs the package built for the device's processor, and launches it on request.          |
| `scripts/notices.mjs`          | Writes or checks `licenses/THIRD_PARTY_NOTICES.txt` from the bundles' source maps (#338).   |

---

## Building and running

Install the **Vega SDK 0.24** first and put its `bin` directory on your `PATH`. (The SDK is licensed under Amazon's Program Materials License Agreement and cannot be committed to this repository).

```bash
# 1. Install root dependencies (pure core & engine)
npm ci

# 2. Install native shell dependencies
npm ci --prefix native

# 3. Build the packages, numbered like the newest release or beta tag
mise run build
```

`npm run build --prefix native` builds the same packages numbered 0, and a device with 1.0.0 or any beta from beta 4 on refuses that with "Package version decrease". Add `-- --build-number <n>`, or use `mise run build`, which takes the number from the newest tag (CONTRIBUTING.md, "Check it on a device").

### Build packages

| Package                                                         | Install it on                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg` | **Vega Virtual Device** on Apple silicon Mac                      |
| `native/build/x86_64-release/dicechess-tv-native_x86_64.vpkg`   | **Vega Virtual Device** on Linux or Intel Mac                     |
| `native/build/armv7-release/dicechess-tv-native_armv7.vpkg`     | **Fire TV Stick** with Vega OS (4K Select AFTCA002 & HD AFTCL001) |

### Install and launch on the Virtual Device

```bash
npm run device --prefix native -- --launch
```

`scripts/install.mjs` asks the device for its processor (`uname -m`) and installs the package built for it. Add `--device <id>` for a Fire TV Stick, with the id from `vega device list`. `vega device install-app` on its own installs any package on any device without a word, and a package for another processor then crashes at start with `ModuleNotFoundError` in `getMMKVTurboModule` (friction log FL-30). The script refuses one, `--vpkg <path>` included.

Verified end to end on 2026-09-23, on the Vega Virtual Device, with the first package built from this repository: it built from a clean checkout, installed, and launched in 227 ms with no crash record. Launch times measured since, on a Fire TV Stick as well, are on the [Performance](https://dicechess-tv.fortemate.com/technology/performance/) page.

_Note on `npm audit`:_ On 9 October 2026, `npm audit --omit=dev` in `native/` listed 49 vulnerable packages (1 critical, 34 high, 14 moderate), and `npm audit` 55. Every advisory is in build and test tooling: `ajv`, `braces`, `fast-xml-parser`, `lodash`, `minimatch`, `shell-quote` and `sprintf-js`, and among the development dependencies also `toml` and `uuid`. Every other package on the list depends on one of them. None of them reaches the device bundle. The source map of that day's release build (`npm run build --prefix native`, in `build/debugging/Release/srcmap/`) lists 172 modules, none from those packages; the system libraries are resolved on the device. Three Amazon packages in the bundle (`react-native-kepler`, `react-native-mmkv` and `keplerscript-turbomodule-api`) are listed only for build tools they depend on, such as `jscodeshift` and `@microsoft/api-extractor`. Never run `npm audit fix --force`, as it attempts to downgrade to the crash-prone SDK 0.23 line. See [Security Audit Explanation](https://dicechess-tv.fortemate.com/contribute/build/#security-audit--tooling-advisories).

---

## Running checks at the terminal

```bash
# Typecheck native src, native test, and shared src/core together
npm run check --prefix native

# Run native board and component tree tests
npm test --prefix native
```

`npm test` renders the board tree using `react-test-renderer` against lightweight Vega stubs in `test/stubs/`, asserting that all 64 squares, 32 pieces, selection rings, legal destination dots, capture rings, and last-move tints render accurately without crashing.

---

## Regenerating pieces and faces

Piece artwork is from the RhosGFX Vector Chess Pieces Pack (CC0), and opponent avatars are from RhosGFX Vector Emojis (CC0). `@amazon-devices/react-native-svg` requires inline JSX without `<style>` tags or external URIs:

```bash
node native/scripts/generate-pieces.mjs && npm run format
node native/scripts/generate-faces.mjs && npm run format
```

Regenerating and formatting reproduces the checked-in files byte for byte.

## Portraits

The three opponents have portraits of their own, drawn for Dice Chess: Rolly, Grabby and Rampage (fortemate/dicechess-assets#31). So do Prowla the cat, who hosts games against a friend (#258), and Thinkle the wizard, who teaches the tutorial (#264) and hosts those games too (#279). They are for Fortemate's Dice Chess apps only, so they stay out of this repository while it is public. A local build vendors them from the private asset repository at a pinned commit:

```bash
node native/scripts/vendor-portraits.mjs ../dicechess-assets <commit>
```

The script checks every file against the digest the asset repository published, and writes the whole pack with its notice and a lock to `native/portraits/`, which git ignores. The build ships only the portraits the game shows (#262): a badge and a card for each character in `CHARACTERS` in `src/Portrait.tsx`, under `assets/portraits/<pack version>/`. `src/Portrait.tsx` draws them in the header badge, on the opponent cards, beside the host's line in a game against a friend and above Thinkle's bubble in the tutorial. The pack's other characters, whom the game has not introduced, stay out of the package, and so does Thinkle's vector, from which the splash is drawn at build time. `scripts/generate-assets.mjs` reads `CHARACTERS` from the source, as it reads `PORTRAITS_VERSION`, and refuses a pack that lacks one of those portraits; `test/assets.test.ts` fails when `CHARACTERS` names a character that is not an opponent, a host or the tutorial's teacher. A checkout without them, such as this public one, builds a game that shows the RhosGFX emoji faces: a portrait that does not load gives way to the face. Prowla and Thinkle have no such face, so their place stays empty, the size of the portrait, as `test/matchup.test.tsx` and `test/tutorial.test.tsx` check; the Vega Virtual Device has been seen only with the portraits (2026-10-04). The About screen credits other authors only (#328, `src/core/credits.ts`): the portraits are Fortemate's, made with Recraft, and its "Made by Fortemate" covers them. A build with the portraits credits RhosGFX for the pieces alone, and a build without them for the pieces and the faces.

What the Vega Virtual Device showed on 2026-10-03:

- **The URL.** An `Image` needs the `file:///pkg/assets/...` URL. With the bare `/pkg/assets/...` path that the sound players use, the badge fell back to the emoji face.
- **The fallback.** A build that looked in a folder that does not exist showed the three emoji faces on the opponent cards.
- **The version.** A package update left the earlier package's portraits in place, so the pack's version is part of the path. A changed portrait therefore never shows the old one. The app looks only under `PORTRAITS_VERSION` in `src/Portrait.tsx`, so a vendored pack of another version would ship and never load, and the game would show the emoji faces without a word. `scripts/generate-assets.mjs` therefore refuses to build with it: vendor the pack that `PORTRAITS_VERSION` names, or change the constant with the pack.

---

## Scripted Virtual Device automation

[`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`) allows scripts and CI runners to send remote inputs and capture screenshots via emulator gRPC:

```bash
npm install -g @fortemate/vega-vvd-driver
vega virtual-device start --no-gui
vvd enable-grpc      # Required after each start of the virtual device
vega device launch-app -d VirtualDevice -a com.fortemate.dicechesstv.main
sleep 3

# Send key presses and capture screenshots
vvd press up up ok   # Open Settings
vvd screenshot settings.png
vega virtual-device stop
```

See [Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/#scripted-virtual-device-automation) for gRPC injection details, UI transition waiting (`vvd wait-change`), and frame streaming (`vvd frames`).

## Loss of focus

The foreground gate requires both an app in front and focus (#254). A
`blur` alone stops effects, voices and music, holds the bot's pending steps and
danger search, and ignores game input, Back included. Returning preserves the
unfinished wait and the current turn. Interrupted speech is stopped; old
effects are discarded rather than replayed. Future tutorial sentences retain
their remaining wait.

The return is signalled by `focus`, not by the `change` to `active`. On a Fire
TV Stick (2026-10-09) the app-state manager reported `unknown` at launch, and
after Home it received `blur` and `change` to `background`, but on the return
only `focus`: Vega opens a new surface for the app, and `change` reaches that
surface, not the manager bound to the first one. A gate that waited for
`active` ignored every key after the first return from Home.

On SDK 0.24.12044's Virtual Device, Home was checked with
`vega device run-cmd -d VirtualDevice -c 'inputd-cli button_press KEY_HOMEPAGE'`:
the same key through `vvd press` did not leave the app. A local `App.onState`
probe showed no steps or further speech while on Home, both after the bot's
roll and during Thinkle's opening sentence. Relaunching recreated the app in
this run; Resume game restored the unchanged dice and turn and continued play.
D-pad, OK and Back were checked on the installed package. This does not verify
a blur-only Alexa overlay: that event sequence is covered by the lifecycle
tests, while physical-device audio needs a separate listening check.
