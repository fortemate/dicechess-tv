---
title: Building on Vega
description: Platform findings and integration lessons from building Dice Chess on Amazon Vega OS, tested on device and emulator.
sidebar:
  order: 2
---

This page records how Amazon Vega OS behaves in practice. Every finding documented here was measured directly on a Vega Virtual Device (SDK 0.24.12112) or verified by targeted automated tests. Items awaiting physical Fire TV Stick confirmation are explicitly noted.

## Remote Input & Navigation

Vega separates remote input across multiple event channels. Getting the D-pad, OK, and Back buttons to work reliably revealed subtle platform behaviors:

| Channel / API                           | Behavior on Vega OS                                                             | Outcome in Dice Chess TV                       |
| --------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `UserInputManager.addListener` (static) | Aborts the JavaScript thread with `SIGABRT` on SDK 0.24.                        | Unusable.                                      |
| `useAddUserInputListenerCallback`       | Delivers events **only** when `useTVEventHandler` is not registered.            | Unusable when combined with standard TV hooks. |
| `useTVEventHandler`                     | Delivers directional arrows and OK reliably, but **cannot claim** events.       | Used for D-pad and OK buttons.                 |
| `useKeplerBackHandler`                  | Intercepts hardware Back events and allows the app to consume or delegate them. | Used exclusively for the Back button.          |

### The Three Names of OK

OK does not arrive under a single identifier. Depending on where the key originates, it is reported under three distinct names:

1. **`enter`**: Delivered when running in the Vega Virtual Device and pressing Return on a Mac or PC keyboard.
2. **`kpenter`**: Delivered by the virtual device's on-screen remote skin (`KEY_KPENTER`). On-screen remote clicks were completely ignored until this mapping was added.
3. **`select`**: The standard key name emitted by a physical Fire TV remote's center D-pad button (`HWEvent`).

Dice Chess TV maps all three names into the single `ok` action in `useRemoteInput.ts`.

_Verification:_ `enter` and `kpenter` were verified on the Vega Virtual Device using scripted evdev key injection and on-screen remote clicks. `select` is covered by automated unit tests and awaits confirmation on physical Fire TV Stick hardware ([#10](https://github.com/fortemate/dicechess-tv/issues/10)).

### Handling the Back Button

Because `useTVEventHandler` cannot claim an event, an unconsumed Back press causes the underlying Vega system to immediately terminate the application.

To prevent accidental app termination when a player simply wants to deselect a piece or open a game menu, the application uses `useKeplerBackHandler`:

- When a piece is selected: Back deselects the piece.
- During active play: Back opens the in-game pause menu.
- Inside a submenu or rules guide: Back returns to the previous menu.
- On the home screen: Back returns `false`, agreeing to let Vega close the app naturally.

_Verification:_ Verified on the Vega Virtual Device via gRPC key injection and manual testing.

### Event Timing: Press vs Release

Hardware events arrive with `eventKeyAction`: `0` on press (and repeat while held), and `1` on release.

- **Directional navigation** acts on press (`0`), allowing smooth and responsive cursor movement when holding down an arrow.
- **Selections and Back** act on release (`1`), ensuring a single press never triggers unintended double-activations.

## Audio Subsystem & Manifest Permissions

Dice Chess TV incorporates 10 sound cues and 4 adaptive background music themes using `@amazon-devices/react-native-w3cmedia` (2.3.2). Several platform constraints were uncovered:

### Service Declarations in `manifest.toml`

Vega's service manager strictly enforces capability sandboxing. Any attempt to connect to an undeclared system service is rejected silently at runtime, manifesting as dead audio sinks with the log message:

```text
missing permission for connection attempt
```

To enable audio playback, `manifest.toml` must explicitly declare the required services:

```toml
[services]
needed = [
  "com.amazon.audio.playback",
  "com.amazon.audio.focus",
  "com.amazon.audio.policy",
  "com.amazon.audio.device",
  "com.amazon.audio.control",
]
```

### The `AudioPlayer` Class & Game Usage

- **Audio component vs player:** The declarative `<Audio>` JSX component repeatedly failed to connect to the Vega audio server. Playback must be initiated imperatively using the `AudioPlayer` class.
- **Usage types:** Sound effects must be initialized with `CONTENT_TYPE_SONIFICATION` and `USAGE_GAME`. Music is initialized with `CONTENT_TYPE_MUSIC` and `USAGE_GAME`. This ensures proper audio ducking when system notifications occur.
- **Bare file paths:** Sources must be specified as absolute package filesystem paths (e.g. `/pkg/assets/sfx/move.mp3`). URLs using `file:///` fail with playback error 4, and `http://` is rejected as insecure.
- **Event listeners:** Playback events only trigger callbacks attached via `addEventListener('ended', ...)`. Property assignment (`audio.onended = ...`) is silently ignored.

### Container & Codec Compatibility

Benchmarked on the Vega Virtual Device across repeated test runs:

| Audio Format     | Virtual Device Result | Playback Latency |
| ---------------- | --------------------- | ---------------- |
| **MP3**          | Supported             | 3–7 ms           |
| **WAV**          | Supported             | ~3 ms            |
| **OGG (Vorbis)** | Fails (Error 4)       | N/A              |
| **M4A (AAC)**    | Fails (Error 4)       | N/A              |

_Note:_ `canPlayType()` cannot be relied upon on Vega; it returns `"probably"` for OGG (which fails) and `""` for WAV (which succeeds). All assets in Dice Chess TV are compiled to MP3.

### Foreground Lifecycle Compliance

Amazon Appstore certification requires that an application must never play audio in the background or over the system launcher. The app binds to `useKeplerAppStateManager` and immediately suspends all audio players upon receiving `background`, `inactive`, or `blur` events.

## Icon & Splash Screen Traps

Packaging visual assets for Vega OS involves specific requirements that differ from standard Android TV:

### The Launcher Icon (3:2 Crop)

The application manifest accepts a single icon reference (`icon = "@image/icon.png"`, 512x512 PNG).

- In system **Settings**, the entire 1:1 square is displayed.
- On the **Fire TV Launcher**, Vega crops the top and bottom to fit a 3:2 banner tile (approximately 304x200 on 1080p).
- Only the middle two-thirds of the icon are visible on the home screen.

To prevent distortion and clipping, all critical artwork must remain within a vertical band of y: 100–412 pixels. The icon must also have an opaque background, as transparent PNGs rendered with black artifacts on earlier builds.

_Verification:_ Automated by `test/splash.test.ts`, which scans PNG pixel bounds and validates that artwork does not bleed outside the safe area.

### The Splash Archive (`SplashScreenImages.zip`)

Vega's boot loader renders a splash animation directly from `assets/raw/SplashScreenImages.zip`:

- The ZIP archive must contain a `desc.txt` file (specifying resolution and frame rate, e.g. `1920 1080 30`) and a `_loop` directory containing PNG frames.
- **Archive root trap:** The files must be zipped directly at the root of the archive without an intermediate enclosing directory. If a parent folder is present, the Vega boot loader fails silently and displays a black screen.
- **Deterministic builds:** `scripts/generate-assets.mjs` sets fixed ZIP entry timestamps to guarantee byte-for-byte reproducible package builds.

## Scripted Virtual Device Automation

To enable fully automated verification in continuous integration without requiring manual remote clicks, Fortemate developed [`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`).

Key capabilities utilized during development:

- **gRPC input injection:** Direct injection of `KEY_KPENTER`, `KEY_BACK`, and D-pad arrows directly into the QEMU emulator instance. (Standard QEMU `send-key` and console `event send` commands fail to reach Vega React Native apps).
- **Synchronized UI assertions:** `vvd wait-change` watches the framebuffer and exits once a render transition completes, eliminating arbitrary `sleep` timeouts in automated test scripts.
- **Frame streaming:** `vvd frames` streams individual rendered frames via gRPC, verifying that piece slides and dice tumbles render smoothly without frame drops.
