# Dice Chess TV on Vega

The React Native for Vega application: board, screens, remote input, saves and
sound. The board draws what `src/core/boardView.ts` describes and nothing else:
the rules live in the canonical engine behind the shared core in `src/core/`, so
nothing here decides legality or invents a move.

This file is also the record of how Vega actually behaves, each finding measured
on a device.

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

This directory is the Vega application. It builds here; nothing needs to be
scaffolded or copied any more.

Install the **Vega SDK 0.24** first and put its `bin` on your `PATH`. It is not
in this repository and cannot be: it is licensed to you under Amazon's Program
Materials License Agreement, so each developer installs their own copy. What is
committed is our configuration only — `manifest.toml`, `app.json`, `index.js`,
`babel.config.js`, `metro.config.js`, `package.json` and the lock file. Every
dependency, Amazon's included, comes from the public npm registry, so `npm ci`
needs no token.

```sh
npm ci                 # at the repository root: the shared core's engine
npm ci --prefix native # this application
npm run build --prefix native
```

The package lands at `native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg`.
`armv7` and `x86_64` are built alongside it; the virtual device and the Stick
both want `aarch64`.

```sh
vega device install-app -d VirtualDevice -p native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg
vega device launch-app -d VirtualDevice -a com.fortemate.dicechesstv.main
```

Verified end to end on 2026-09-23: builds from a clean checkout, installs, and
launches in 227 ms with no crash record.

### What `npm audit` reports, and why it is not shipped

`npm audit` reports 20 findings here, 17 of them outside `devDependencies`. None
of them reach the device. The built package holds our Hermes bundle,
`libreact-native-mmkv-kepler.so` and metadata, and nothing else: `minimatch`,
`toml`, `braces` and `micromatch` each appear in it zero times. They are pulled
in by the manifest builder and the React Native CLI, which run on the developer's
machine.

Do not run `npm audit fix --force` here. Its proposed remedy is to install
`@amazon-devices/react-native-kepler@2.1.0` — the SDK 0.23 line, whose WebView
crash is the reason this application exists.

### Why `metro.config.js` is not the default one

The screens here import the shared core from `../src/core`, and the core imports
the engine from the repository root's `node_modules`. Both are outside this
directory, and Metro will not follow a path it is not watching. Replacing the
config with the template's default was tried, and the build fails with
`Unable to resolve module ../../src/core/game`. `watchFolders` and
`nodeModulesPaths` are what make one shared core serve both frontends.

### `buildinfo.json`

It appears next to the manifest after a build and holds absolute paths from the
machine that built it, so it is ignored rather than committed.

Target **SDK 0.24**. Its Metro reads the engine's package exports unaided, where
SDK 0.23's needed `unstable_enablePackageExports` — a separate matter from the
`watchFolders` above, which is about where our own files live. And the native
path does not use the WebView whose crash pinned the web app to SDK 0.23.

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
`react`, `react-native` and Amazon's `@amazon-devices/*` packages, and those have
no place in the root package, which holds only the shared core and its engine. CI runs it as the `native-board` job.

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

Vega splits input across channels, and the board needs two of them.

| API                                     | Result                                                    |
| --------------------------------------- | --------------------------------------------------------- |
| `UserInputManager.addListener` (static) | aborts the JS thread with `SIGABRT` on 0.24               |
| `useAddUserInputListenerCallback()`     | delivers **only** when `useTVEventHandler` is not also up |
| `useTVEventHandler`                     | works, but cannot claim an event — directions and OK      |
| `useKeplerBackHandler`                  | the only way to claim Back — Back                         |

The second row cost a day. Subscribed alongside `useTVEventHandler` it delivers
nothing at all, with no error: silence indistinguishable from nobody pressing a
key. Alone, it works. That is why the diagnostic that told the channels apart had
to subscribe to one at a time.

**Back needs its own channel because `useTVEventHandler` cannot claim an event.**
An unclaimed Back closes the app, so a Back seen only there cancels nothing and
quits instead — which is exactly how it behaved until `useKeplerBackHandler` was
found. That hook claims Back and calls `exitApp()` itself when no handler returns
true, so returning false is how the app _agrees_ to close.

The app uses that: **Back at the home screen lets the app close**, which is what
Back means at the top of a TV app, and claims it everywhere else. Suppressing it
everywhere would trap a viewer inside.

The Virtual Device hands over **raw key names** rather than a remote
abstraction — `backspace`, `leftshift`, `tab` and letters all arrive as
themselves, lower-case Linux key names — so keyboard Enter never becomes
`select`. Esc does become `back`, because the emulator is launched with a
keyboard mapping: `KEY_ESC` to `KEY_BACK`, and F1 to F5 to Home, Menu, Rewind,
Play/Pause and Fast-forward.

**OK arrives under three names, and all three are mapped.** `enter` comes from
the Mac keyboard; **`kpenter`** comes from the virtual device's on-screen remote,
whose skin binds OK to `KEY_KPENTER`, the keypad Enter (see
`vvd/images/tv/vmtools/agent/skins/tv-remote/layout` in the SDK — all three
remote skins do the same); and `select` comes from a physical remote, as Amazon's
`HWEvent` documentation describes it. `kpenter` was missed until 24 September,
when the owner pressed OK on the on-screen remote and nothing happened. A
diagnostic build that printed raw events confirmed the name on the device:
`kpenter/0 kpenter/1`. `KEY_SELECT` and `KEY_OK` injected into the emulator never
reach the app at all — its virtual keyboard does not declare them — so `select`
cannot be checked on the virtual device. That one is for the Stick.

The fix was verified the way the on-screen remote works, without a person at the
emulator: keys went in through the emulator's own gRPC `sendKey` (evdev codes;
the port and token are in the running emulator's discovery file), and each step
was checked on a screenshot taken with `screenrecord screenshot` on the emulator
console. OK resumed the saved game, rolled, and picked up a knight; Back put it
down, opened the menu and closed it; Back on the home screen closed the app. Two
injection routes do **not** reach a Vega app, although both report success: the
console's `event send` and QEMU's `send-key`.

`eventType` arrives lower-case. `eventKeyAction` is
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
make, and nothing that describes this game should claim cryptographic dice.

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

## The local opponent

`src/core/bot.ts` asks the engine for a complete legal path
(`DiceChess.getBestMove(dfen, { algorithm: 'random' })`) rather than choosing
moves itself: only the engine can be trusted to obey maximal dice use and
promotion restrictions. It is the same call the web worker makes. The reply goes
through `applyBotReply`, which revalidates every action and rejects a stale or
incomplete path.

**No separate thread is involved, and none is needed for this opponent.** A
random bot makes a handful of engine calls rather than a search, so the JS thread
carries it without a visible pause. Running a _strong_ bot off the thread is a
different question and still open: React Native has no Web Worker, Vega's
headless tasks cannot be started by an app, and
`@amazon-devices/react-native-worklets` is the untested candidate.

Its steps — roll, play, hand over — are scheduled 600 ms apart rather than
looped, so the player watches the turn happen. While the opponent owes an action
the board takes no input but Back, so a player cannot move its pieces for it and
is never stuck watching.

Verified on a device on 22 September 2026, alternating with a human player: the
opponent rolled `BRK`, had no legal action and handed back immediately; the
player took a turn; the opponent then rolled `PNQ` and spent all three dice,
ending on `d8b6`.

Its path is **decided as a whole and checked as a whole**, then revealed one
action at a time: `applyBotReply` rejects a stale or incomplete path before the
first move is shown, and the moves are then replayed individually. That is a
reveal, not a decision taken in instalments. Each action marks its own pair of
squares and spends one die, so a three-dice turn reads as three moves rather
than a board that changes by three at once.

Measured on a device with a forced three-pawn roll: `PPP` → `h7h5` → `PP` →
`a7a6` → `P` → `e7e6` → handoff.

An interrupted turn is **recomputed, not resumed half-played**. The pending path
is state, not save data, so a relaunch mid-turn has the opponent decide afresh
from the position it actually finds.

### What this still leaves

- **Nothing animates.** Pieces are placed, not moved; there is no slide between
  squares for either side. That is M2 polish, and the owner has deferred it.

## The completed-game ledger

M1 asks for each result to be counted **exactly once across reloads**. The marker
for what has been counted lives _inside_ the ledger rather than beside it, so one
write both records a result and remembers that it was recorded. Two writes could
be interrupted between them; one cannot.

Recording runs on every committed game and on every launch, because the case that
matters is a game that ended while the app was gone. `record()` is a no-op for a
game already counted, so a caller never has to track what it has done.

A game that never ends is never counted, so an abandoned or replaced game stays
out of the record without anything having to notice it was abandoned.

Hotseat is reported by colour — White, drawn, Black — never by player: the seats
change hands and nothing here knows who sat where. Games against an opponent are
recorded per opponent **and** per side the player held, because one combined
number would hide how it plays each colour.

A ledger that no longer decodes is refused rather than reset to zero, and left on
disk rather than overwritten. Losing a record silently is worse than showing
none.

Verified on a device across three launches, holding a game that had already ended
— the state a crash between "game saved" and "result counted" leaves behind:

| Launch | Before     | After               |
| ------ | ---------- | ------------------- |
| 1      | no ledger  | `black: 1`, counted |
| 2      | `black: 1` | `black: 1`          |
| 3      | `black: 1` | `black: 1`          |

## The tutorial

Five lessons — moving a piece, the dice choosing the pieces, three actions in one
turn, taking a piece, taking the king. Castling and promotion are deliberately
absent: the roadmap makes them reference material, and a tutorial long enough to
cover them is no longer a tutorial.

Each lesson is **data**: a fixed position, a fixed roll, and a goal. The tests
check every one against the canonical engine — that the position decodes, that
the roll permits the action being taught, and that the goal is reachable. The
dice lesson is checked harder still: _every_ legal action in it must start on a
knight, or it would be teaching something untrue. Swapping in a position the
engine rejects fails three tests.

It runs the same board, the same input reducer and the same controller as a real
game, so there is nothing separate to keep in step.

**It cannot touch a saved game or the record.** `TutorialScreen` is given no
store and no ledger, so that is a property of the wiring rather than a promise. A
test plays a real game to a result, runs a lesson, and compares the saved game
and the ledger byte for byte.

While it is up it owns the remote. The game screen stays mounted and stays
subscribed — a hook cannot be conditional — so it ignores keys instead, or every
press would be handled twice.

## The rules guide

Nine topics: winning, the turn, the dice, maximal use, no check, castling,
promotion, en passant, draws. Topics on the left, the chosen one on the right,
and the arrows move between them so the text changes without anything being
opened or closed — one level of navigation, because a remote makes every extra
level expensive.

The **shape** follows what the Chess Hero beta does well, a reference split into
short named topics rather than one long page, and so does the division of labour
our own research note points at: their guide is read outside the match with no
explanation at the piece, so here the tutorial explains in the moment and this is
for reading and remembering. Castling, promotion and en passant live here
precisely because the tutorial leaves them out.

The **content** is ours. That note is explicit that their rules are not known to
match ours, so nothing is transcribed: every factual claim is written against our
engine and checked against it, and each check names the sentence it verifies.
Changing a sentence without re-checking it fails a test — three false claims were
injected and each failed one.

Five of their fourteen topics are absent because this game has no clocks, no
doubling, no stakes, no matchmaking and no rating. A test fails if those words
appear.

Writing it corrected a claim: a draw comes when a **turn ends** 100 half-moves
after the last capture or pawn move, not the moment the counter reaches 100 —
while dice remain the game continues.

## Sound

The game plays nine cues: a roll, a move, a capture, castling, a promotion, the
handoff of the dice, and a win, a loss or a draw. Every one also has a visual
equivalent already on screen, and a `Sound: on` item in both menus turns them
all off. What was heard on a real speaker was chosen by the owner, by ear, in
`fortemate/dicechess-assets#8`, and the game's own sounds have been heard coming
from the virtual device through the Mac's speakers. What has not been heard yet
is the game on a television, from a sofa.

**The manifest has to declare the audio services.** Vega's service manager
refuses any connection a manifest did not declare and says so only in the device
log: `missing permission for connection attempt`. Undeclared, the player cannot
reach the audio server and every cue dies at the sink — silently, with `playing`
still reported. `manifest.toml` declares the four services Amazon's audio sample
does, plus `com.amazon.audio.control`, which only the log revealed.

### How it fits together

- **What a step sounds like** is `cues(before, after)` in `src/core/cues.ts`,
  pure and checked against the engine in `test/cues.test.ts`. Against the bot a
  result is a win or a loss for the person; in hotseat somebody in the room won,
  so a decisive game ends on the winning jingle and only a draw sounds different.
- **Which file plays** is decided once, in `scripts/vendor-sounds.mjs`, which
  copies the chosen MP3s from `dicechess-assets` at one pinned commit into
  `sounds/`, checks each against the digest that repository published, and writes
  `sounds/sounds.lock.json` and the generated `src/cueFiles.ts`. To re-pin:
  `node scripts/vendor-sounds.mjs <dicechess-assets checkout> <commit>`.
  `test/vendoredSounds.test.ts` fails if a vendored file, the lock and the cue
  table ever disagree.
- **Playing it** is `src/sound.ts`: three players — board, dice and result — so a
  capture and the win it causes sound together, while a new move cuts the last
  one short. Every failure is reported and swallowed; a game must never stop
  because a sound did.
- **The build** copies the vendored files to `assets/sfx/<pack>/`, which is
  `/pkg/assets/sfx/<pack>/` on the device, and refuses to if a file no longer
  matches the lock.

The manifest declares the media module, but the build would have added it
anyway: `react-native build-vega` reads each dependency's `SystemModules` list
and writes the modules it needs into the packaged manifest itself — the media
controls and media descriptor modules included, which nothing in the source
mentions.

JDSherbert's licence forbids sharing the raw files. They can ship in the
package, but **if this repository is ever made public, `sounds/jdsherbert-tabletop/`
must be removed first.** Kenney's packs are CC0 and carry no such limit.

### What the probe established

What follows is what a probe on the virtual device established before any of
the above was written. All of it comes from
`@amazon-devices/react-native-w3cmedia` 2.3.2 on SDK 0.24.12112.

**The player must be an `AudioPlayer`, not the `Audio` component**, and it must
be constructed as `CONTENT_TYPE_SONIFICATION` / `USAGE_GAME`. Those are what
these sounds are, and they decide whether an effect ducks whatever else the
television is playing. The `Audio` component on its music/media defaults filled
the log with `could not connect to audioserver`.

**A source is a plain path, not a URL.** `/pkg/assets/sfx/move.mp3` reaches
`playing` in about 15 ms; `file:///pkg/assets/sfx/move.mp3` fails with error 4,
and `http://` never even fetches — the player refuses the scheme outright
(`isUriSchemeSecure Got an insecure protocol/scheme http`). `fetch` wants the
exact opposite: it reads the `file://` form and refuses the bare path. The two
conventions are not interchangeable, which cost a run to discover.

**Containers: mp3 and wav play, ogg and m4a do not.** Each was tried three
times and the split was identical every time, so it is a property of the
containers and not a race:

| container | outcome           |
| --------- | ----------------- |
| mp3       | `playing`, 3-7 ms |
| wav       | `playing`, 3 ms   |
| ogg       | error 4           |
| m4a       | error 4           |

This matters beyond the client: the only pack in `dicechess-assets` is ogg, and
it cannot be played here as it stands.

**Do not trust `canPlayType`.** It is listed among the unsupported members in
the package's own README — "indicates it supports any type" — and it answered
"probably" for ogg and "" for wav, which is exactly backwards from what happens.

**Events arrive only through `addEventListener`.** The EventHandler attributes
(`audio.onplaying = ...`) are documented as unsupported and are silently
ignored; a whole probe run reported "no event" because of it.

Two effects started together both reached `playing` within 14 ms, so a die
landing while a piece is still moving needs no mixing of our own — one player
per sound. Re-firing one works if it is paused and `currentTime` reset first.

### A wrong conclusion, corrected

The probe's sink failed on every attempt with `GST stream error: 11`, and that was
read as the virtual device having no audio output: no `/dev/snd`, no audio server
in `ps`, no `audio.clock.*` library. **It was wrong.** `ps` inside the developer
shell cannot see the system's processes, and the real cause was in the log all
along — the audio service refusing an undeclared connection. With the services
declared, a roll and a move each reach `playback stream successfully created`,
start on a server handle, and are heard.

What that failure also produced — `ended` never firing, `duration` and
`currentTime` reading `NaN`, `error` sticking at 4 — came from the broken sink,
and has not been re-measured since. `src/sound.ts` depends on none of them; check
again before any code does.

## Raster alternative

Pieces are vectors and no raster fallback is needed. PNGs remain available if
measurement on physical hardware ever shows that redrawing 32 multi-path pieces
costs too much while the cursor moves; the generator makes that switch cheap. Do
not make it without that measurement.

## Icon and splash

Two separate mechanisms, neither of them obvious.

**The icon** is a 512x512 PNG at `assets/image/icon.png`, named from the manifest
as `icon = "@image/icon.png"`. There is only one icon field, and it serves two
places that want different things.

The documentation describes it as the Settings icon, and that screen is dark, so
Amazon's advice is that light solid icons read best. But the **launcher** also
uses it, and the launcher does not draw a square: it draws a wide tile and fits
the icon into it. A bare mark on transparency was tried first and came out
visibly distorted on the home screen.

So the file is the brand's **maskable** export, copied byte for byte: an opaque
black tile with the mark at about 52 % of the canvas, inside an 80 % safe zone.
That is precisely what maskable icons are for — the launcher may crop it however
it likes and the mark survives. `BRAND.md` settles the colour too: tiles use
pure black.

The mark is not redrawn here and must not be. Regenerating it is the brand
repository's job, and `BRAND.md` forbids the variations that suggest themselves
— no wordmark lockup while the typography is provisional, the mark never goes
inside a die, a board or another grid, and game artwork is never used as the
mark. A game-specific icon is a design decision for the owner, not something to
improvise. See `brand/README.md`.

**The splash** is `assets/raw/SplashScreenImages.zip`, and the animation service
reads it directly — nothing in the manifest points at it. Inside, a `desc.txt`
of two lines (`1920 1080 30`, then `c 0 0 _loop`) and a `_loop` directory of PNG
frames. Ours holds one frame, which the descriptor loops until the app says it
has drawn. 4K frames are refused; 1920x1080 is the television size.

`scripts/generate-assets.mjs` builds it during `npm run build`, so the archive is
generated rather than committed — as is the icon, which the same script copies
into place. Everything under `assets/` is built; the verbatim brand inputs live
in `brand/`, outside it, so the splash source is not also shipped. The splash
composites the **transparent** mark, not the icon tile, unscaled and on whole
pixels, onto the board's own background colour, so the splash and the
first frame of the application are the same colour and the handover is
invisible. Two traps are handled there and worth knowing: the archive must be
built from **inside** the staging directory, because a wrapping folder hides
`_loop` from the service and it silently shows nothing; and every entry,
including the directory, is stamped with a fixed time so two builds produce
identical bytes.

`test/splash.test.ts` reads back the files that were written — the icon's bytes
against the brand file, its ink inside the 80 % safe zone, the frame size, the
background in five places, the mark's bounding box centred and large enough to
read from a sofa, the descriptor text, and the archive listing. The safe-zone
check exists because the distorted launcher tile is exactly what shipped the
first time. Each assertion
was confirmed to fail when its property was broken on purpose. Nothing imports
the splash and nobody looks at a boot screen in CI, so without those it would
regress in silence.

## Known gaps

- **No coordinates.** The board draws squares, pieces and the four overlay
  states; rank and file labels are not drawn.
- **Sound unheard on a television.** Every cue is heard on the virtual device,
  but only on a television can anyone judge whether it is loud enough, distinct
  enough and quick enough from a sofa. That check is the open half of
  `fortemate/dicechess-assets#8`.
- **No animation.** A piece appears on its new square rather than travelling
  there. The bot's turn is revealed one action at a time so the moves can at
  least be followed.
- **No attribution screen.** Both asset licences require visible credit and
  there is nowhere yet that shows it.
