# Dice Chess TV on Vega

The React Native for Vega application: board, screens, remote input, saves and sound. The board draws what `src/core/boardView.ts` describes and nothing else: the rules live in the canonical engine behind the shared core in `src/core/`, so nothing here decides legality or invents a move.

Long-form technical documentation, platform findings, performance benchmarks and testing guides have moved to the [Dice Chess TV project site](https://fortemate.github.io/dicechess-tv/):

- **[Architecture & Data Flow](https://fortemate.github.io/dicechess-tv/technology/architecture/):** The pure TypeScript core, React Native for Vega shell, and the canonical engine.
- **[Building on Vega](https://fortemate.github.io/dicechess-tv/technology/vega/):** Platform findings measured on the device (input channels, the three names of OK, Back handler, service declarations, audio formats, splash/icon traps, and scripted automation).
- **[Performance](https://fortemate.github.io/dicechess-tv/technology/performance/):** Launch KPIs (first frame in 309 ms, fully drawn in 748 ms), bot decision speeds, and motion timings.
- **[How We Test & Review](https://fortemate.github.io/dicechess-tv/quality/):** Automated tests, CI, CodeQL, SonarCloud quality gate, CodeRabbit, pre-commit hooks, and the press evaluator.
- **[Build & Run](https://fortemate.github.io/dicechess-tv/contribute/build/):** Prerequisites, package variants, installation, security advisories, and Metro configuration.
- **[Project Layout](https://fortemate.github.io/dicechess-tv/contribute/layout/):** Repository structure, source directories, and scripts.
- **[Contributing](https://fortemate.github.io/dicechess-tv/contribute/contributing/):** CLA, pull-request conventions, and English-only repository standards.
- **[Credits & Licences](https://fortemate.github.io/dicechess-tv/contribute/credits/):** Provenance and licences for code, pieces, emojis, sound effects, and music.
- **[SDK Friction Log](https://fortemate.github.io/dicechess-tv/friction-log/):** 28 documented obstacles encountered with Amazon's Vega SDK and their solutions.

---

## What is here

| Path                          | Purpose                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `src/App.tsx`                 | The root: reads saves before first render; owns randomness, sound and music.     |
| `src/GameScreen.tsx`          | The board and side status panel, with menus, dialogs, and prompts.               |
| `src/Matchup.tsx`             | Matchup HUD: a badge per side, placed as on the board; turn frame; speech zone.  |
| `src/SpeechBubble.tsx`        | The bot's line under its badge: 20 dp text in at most two rows.                  |
| `src/useBotVoice.ts`          | Picks the bot's lines as the game moves and how long each stays on screen.       |
| `src/useHostVoice.ts`         | Picks the host's lines at the pauses and says them, with no bubble for now.      |
| `src/screen.ts`               | The screen's whole flow, as a pure reducer over state and one action.            |
| `src/OpponentScreen.tsx`      | Opponent selection: three cards with bot faces, difficulty, and player records.  |
| `src/TutorialScreen.tsx`      | Five-lesson interactive tutorial running on an isolated sandbox board.           |
| `src/tutorial.ts`             | The tutorial's flow, as a pure reducer over state and one key.                   |
| `src/RulesScreen.tsx`         | Dual-pane rules guide: topics on the left, selected explanation on the right.    |
| `src/AboutScreen.tsx`         | Project credits and third-party licence notices accessible via TV remote.        |
| `src/Board.tsx`               | 8x8 grid rendering pieces, square tints, focus rings, and move slide animations. |
| `src/Dice.tsx`                | Three-dice tray with tumbling roll animations and dimmed unplayable dice.        |
| `src/Option.tsx`              | Focusable menu and list items with cyan border frame and pressed state.          |
| `src/layout.ts`               | TV safe area insets (5% overscan margin) and responsive board layout.            |
| `src/theme.ts`                | Board colours, square tints, selection rings, and theme constants.               |
| `src/pieces/`                 | Generated SVG React components for all 12 chess pieces (RhosGFX CC0).            |
| `src/faces/`                  | Generated SVG React components for opponent bot avatars (RhosGFX CC0).           |
| `src/useRemoteInput.ts`       | Normalizes Vega remote events (`enter`, `kpenter`, `select`, `back`).            |
| `src/mmkvStore.ts`            | Synchronous snapshot store on MMKV for saves, ledger, and preferences.           |
| `src/randomSource.ts`         | Runtime randomness selector feeding uniform rejection sampling.                  |
| `src/sound.ts`                | Plays cues on three players (board, dice, result), and spoken lines on a fourth. |
| `src/cueFiles.ts`             | Sound cue file mapping, generated by `scripts/vendor-sounds.mjs`.                |
| `src/voiceFiles.ts`           | Bot and host clips, lengths, texts, generated by `scripts/vendor-voices.mjs`.    |
| `src/soundSetting.ts`         | Sound effects enable/disable toggle remembered across launches.                  |
| `src/voiceSetting.ts`         | Voices toggle for every spoken line, on by default, remembered across launches.  |
| `src/hostSetting.ts`          | Who hosts Hot Seat, Rolly (the default) or off, remembered across launches.      |
| `src/music.ts`                | Plays adaptive music: menu theme or danger-level tracks with crossfades.         |
| `src/useDanger.ts`            | Measures king threat level at the start of each turn spread over frames.         |
| `src/musicSetting.ts`         | Music toggle and volume settings remembered across launches.                     |
| `scripts/generate-pieces.mjs` | Regenerates `src/pieces/` from RhosGFX vector SVG pieces.                        |
| `scripts/generate-faces.mjs`  | Regenerates `src/faces/` from RhosGFX Vector Emojis.                             |
| `scripts/rhosgfx-svg.mjs`     | Compiles SVG files into inline JSX compatible with Vega SVG.                     |
| `scripts/vendor-sounds.mjs`   | Vendors sounds from `dicechess-assets` at a pinned commit.                       |
| `scripts/vendor-music.mjs`    | Vendors music from `dicechess-assets` at a pinned commit.                        |
| `scripts/vendor-voices.mjs`   | Vendors the voices and `events.json` from `dicechess-assets` at a pinned commit. |
| `scripts/generate-assets.mjs` | Builds `assets/` on each build: icon, splash archive, sounds, music, voices.     |

---

## Building and running

Install the **Vega SDK 0.24** first and put its `bin` directory on your `PATH`. (The SDK is licensed under Amazon's Program Materials License Agreement and cannot be committed to this repository).

```bash
# 1. Install root dependencies (pure core & engine)
npm ci

# 2. Install native shell dependencies
npm ci --prefix native

# 3. Build target packages
npm run build --prefix native
```

### Build packages

| Package                                                         | Install it on                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg` | **Vega Virtual Device** on Apple silicon Mac                      |
| `native/build/x86_64-release/dicechess-tv-native_x86_64.vpkg`   | **Vega Virtual Device** on Linux or Intel Mac                     |
| `native/build/armv7-release/dicechess-tv-native_armv7.vpkg`     | **Fire TV Stick** with Vega OS (4K Select AFTCA002 & HD AFTCL001) |

### Install and launch on the Virtual Device

```bash
vega device install-app -d VirtualDevice -p native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg
vega device launch-app -d VirtualDevice -a com.fortemate.dicechesstv.main
```

Verified end-to-end: builds from a clean checkout, installs, and launches in 227 ms with no crash record.

_Note on `npm audit`:_ Running `npm audit` in `native/` reports 22 tooling advisories in build tools (`lodash`, `toml`, `uuid`, etc.). None of these packages reach the device bundle (only 141 modules bundled; system libraries resolved on-device). Never run `npm audit fix --force`, as it attempts to downgrade to the crash-prone SDK 0.23 line. See [Security Audit Explanation](https://fortemate.github.io/dicechess-tv/contribute/build/#security-audit--tooling-advisories).

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

See [Building on Vega](https://fortemate.github.io/dicechess-tv/technology/vega/#scripted-virtual-device-automation) for gRPC injection details, UI transition waiting (`vvd wait-change`), and frame streaming (`vvd frames`).
