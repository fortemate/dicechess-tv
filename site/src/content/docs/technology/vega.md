---
title: Building on Vega
description: 'How Amazon Vega OS behaved for Dice Chess on the Vega Virtual Device (SDK 0.24): remote input, sound, the icon and splash, and scripted checks. Unless a section says otherwise, nothing here has been checked on a Fire TV Stick.'
sidebar:
  order: 2
---

This page records how Vega OS behaved for Dice Chess on the Vega Virtual Device (SDK 0.24.12112, OS 1.2). Where a statement rests on something else, such as unit tests, Amazon's documentation or Amazon's developer forum, it says so. Unless a section says otherwise, nothing here has been checked on a Fire TV Stick, although the game has run on a Fire TV Stick 4K Select since 6 October 2026. The [friction log](/friction-log/) has the steps and evidence for the obstacles linked from this page.

## Remote Input & Navigation

Vega delivers remote keys through several APIs. On SDK 0.24 one of them aborts the app, and two cannot be used together. What each one did on the Virtual Device:

| Channel / API                           | Behavior on Vega OS                                                                                           | Outcome in Dice Chess TV          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `UserInputManager.addListener` (static) | Aborts the JavaScript thread with `SIGABRT` on SDK 0.24.                                                      | Unusable.                         |
| `useAddUserInputListenerCallback`       | Subscribed to every key, it delivers nothing while `useTVEventHandler` is also mounted, and reports no error. | Not used.                         |
| `useTVEventHandler`                     | Delivers the arrows, OK and Back, but **cannot claim** an event.                                              | Used for the arrows, OK and Menu. |
| `useKeplerBackHandler`                  | Claims Back. When no handler returns true, it calls `exitApp()` itself.                                       | Used for Back only.               |

### The Three Names of OK

OK does not arrive under a single identifier. Depending on where the key originates, it is reported under three distinct names:

1. **`enter`**: Sent by the Virtual Device when Return is pressed on the computer's keyboard (measured with a Mac).
2. **`kpenter`**: Delivered by the Virtual Device's on-screen remote skin (`KEY_KPENTER`). On-screen remote clicks were ignored until this mapping was added.
3. **`select`**: The name Amazon's `HWEvent` documentation gives for OK. We found no way to make the Virtual Device send it: its virtual keyboard does not declare `KEY_SELECT` ([FL-08](/friction-log/#fl-08)).

Amazon staff said on Amazon's developer forum on 31 August 2026, in [another developer's bug report](https://community.amazondeveloper.com/t/0-24-rn-0-83-remote-select-never-invokes-onpress-focus-works/28945), that for React Native 0.83 apps Vega OS 1.2 delivers the raw, lower-case key name, so a remote's OK arrives as `enter`, and that a future Vega OS release will normalise it to `select`. Neither that answer nor the documentation mentions `kpenter` ([FL-03](/friction-log/#fl-03)).

`native/src/useRemoteInput.ts` treats all three names as OK, so the app acts on OK under any of them.

_Verification:_ on the Virtual Device, `enter` from a Mac keyboard drove a whole turn on 22 September 2026, and on 24 September a diagnostic build that printed raw events showed `kpenter` from the on-screen remote. `kpenter` was also checked with `KEY_KPENTER` sent through the emulator's gRPC API. A unit test (`native/test/input.test.tsx`) checks that all three names act as OK; it runs against stand-ins for the Vega packages, so it checks the mapping, not what Vega sends. On a Fire TV Stick 4K Select, a game has been played with the Stick's own remote ([Performance](/technology/performance/#response-to-the-remote)), but which of the three names its OK arrives under has not been recorded.

### Handling the Back Button

`useTVEventHandler` sees Back but cannot claim it, and a Back that nothing claims closes the app. Handled only there, Back would cancel nothing and quit ([FL-06](/friction-log/#fl-06)).

To keep Back from closing the app when a player wants to put a piece down or open the game menu, the app uses `useKeplerBackHandler`:

- When a piece is selected: Back deselects the piece.
- During a game, with nothing selected or while the opponent plays: Back opens the game menu, and Back again closes it.
- In the rules guide: Back returns to the screen that opened it, the home screen or the game menu, with Rules reference focused.
- In the tutorial or About: Back returns to the home screen, with its first item focused; returning to the option that opened them is [#238](https://github.com/fortemate/dicechess-tv/issues/238), still open. In the tutorial, Back first puts down a selected piece.
- On the first launch's offer of the tutorial: Back goes to the home screen, as Skip does, and never closes the app.
- In Settings and in the choice of opponent and colour: Back returns to the screen that opened it. The choice of colour comes up only when **Play as** in Settings is Ask ([#352](https://github.com/fortemate/dicechess-tv/pull/352)); otherwise OK on an opponent's card starts the game. On a confirmation, Back does what Cancel does.
- On the home screen: the handler returns `false`, and `useKeplerBackHandler` closes the app.

_Verification:_ on the Virtual Device, with Back sent as `KEY_BACK` through the emulator's gRPC API on 24 and 28 September 2026, Back put a selected knight down, opened the game menu and closed it, returned from Settings to the home screen with Settings focused, left the rules guide and the tutorial for the home screen, and closed the app from the home screen. On 5 October 2026, `vvd press back` on the first launch's offer of the tutorial went to the home screen, and the app stayed open. Unit tests (`native/test/screen.test.ts`, `native/test/input.test.tsx`, `native/test/tutorial.test.tsx`, `native/test/tutorialOffer.test.tsx`, `native/test/playAs.test.tsx`) cover the other paths, among them the rules guide opened from the game menu and the choice of colour under each Play as.

### Event Timing: Press vs Release

Hardware events arrive with `eventKeyAction`: `0` on press (and repeat while held), and `1` on release.

- **Arrows** act on the press (`0`), so holding one repeats it.
- **OK and Menu** act on the release (`1`), so holding OK plays one action, not one per repeat. **Back** acts on the release too, because `useKeplerBackHandler`, as its npm package implements it, calls the app's handler only when Back is released.

## Audio Subsystem & Manifest Permissions

Dice Chess TV plays ten sound cues, spoken lines for the opponents, the Hot Seat host and the tutorial, and four music themes (one for the menus, three that follow the danger to a king), all through `@amazon-devices/react-native-w3cmedia` 2.3.2. What we found on the Virtual Device:

### Service Declarations in `manifest.toml`

Vega's service manager refused the media player's connections to audio services that the manifest did not declare. The app got no error: every cue failed at the sink, and only the device log said why:

```text
missing permission for connection attempt
```

One probe run without the declarations logged 13 refused connections to `com.amazon.audio.stream` ([FL-18](/friction-log/#fl-18)). `native/manifest.toml` declares five services as `[[wants.service]]` entries: the four that Amazon's audio sample declares, and `com.amazon.audio.control`, which the player's audio-focus client also needed and which only the device log revealed:

```toml
[wants]

[[wants.service]]
id = "com.amazon.audio.stream"

[[wants.service]]
id = "com.amazon.media.server"

[[wants.service]]
id = "com.amazon.media.playersession.service"

[[wants.service]]
id = "com.amazon.mediametrics.service"

[[wants.service]]
id = "com.amazon.audio.control"
```

`com.amazon.inputd.service` is deliberately not declared: on the Virtual Device, declaring it made this app exit at start-up ([FL-19](/friction-log/#fl-19)).

### The `AudioPlayer` Class & Game Usage

- **`AudioPlayer`, not `Audio`:** in the first probe, the `Audio` component on its default music and media types filled the device log with `could not connect to audioserver`, while an `AudioPlayer` reached `playing` ([FL-12](/friction-log/#fl-12)). That probe ran before the audio services were declared, so it does not show that `Audio` cannot work. The app uses `AudioPlayer` only.
- **Content and usage types:** sound effects and spoken lines use `CONTENT_TYPE_SONIFICATION` with `USAGE_GAME`; music uses `CONTENT_TYPE_MUSIC` with `USAGE_GAME`. Both play on the Virtual Device. How these types affect ducking under system sounds has not been tested.
- **Bare file paths:** a file packaged with the app plays from its plain path (e.g. `/pkg/assets/sfx/move.mp3`). The same file as a `file:///` URL fails with error 4, and an `http://` source is refused as insecure.
- **Event listeners:** events arrive only through `addEventListener`. Assigning a handler property such as `audio.onplaying` is silently ignored.

### Container & Codec Compatibility

Measured on the Virtual Device. The results and the times both come from the first audio probe, three runs per format, with the same result each time ([FL-11](/friction-log/#fl-11)). That probe ran before the audio services were declared, while the sink was failing, so the times are how long each file took to report `playing`, not the time to audible sound. MP3 and WAV have played since, in the music probe of 26 September ([FL-25](/friction-log/#fl-25)), and MP3 in the game:

| Audio format | Result on the Virtual Device | Time to `playing` (first probe) |
| ------------ | ---------------------------- | ------------------------------- |
| **MP3**      | Plays                        | 3–7 ms                          |
| **WAV**      | Plays                        | about 3 ms                      |
| **OGG**      | Fails with error 4           | –                               |
| **M4A**      | Fails with error 4           | –                               |

_Note:_ `canPlayType()` cannot be relied upon on Vega; it returns `"probably"` for OGG (which fails) and `""` for WAV (which plays). Every sound the app ships is an MP3 file, and MP3 has since been heard from the Virtual Device through a computer's speakers.

### Leaving the Foreground

Amazon's pre-submission test cases ask for no audio from the app on the Fire TV launcher or over the screensaver, and none overlapping another app when switching apps ([Test before submission](https://developer.amazon.com/docs/vega/0.24/test-before-submission.html)). The app listens to `useKeplerAppStateManager` and counts itself in front only while it is both active and focused (`native/src/App.tsx`, [#296](https://github.com/fortemate/dicechess-tv/pull/296)). On `blur`, `background` or `inactive`, the sound effects, the spoken lines and the music stop, the game ignores the remote, and the opponent's next step and the danger search hold what was left of their wait; the return picks the turn up where it was. Music comes back 300 ms after the app is both active and focused.

On the Virtual Device, bringing the launcher to the front delivered `blur` and then `background` on each of four trips, and the music stopped ([FL-28](/friction-log/#fl-28)). On a Fire TV Stick 4K Select on 9 October 2026, the app-state manager reported `unknown` at launch. After Home it received `blur` and a `change` to `background`, but on the return only `focus`, and a build that waited for the `change` to `active` ignored every key after the first return from Home. So the app takes `focus` as the return (`native/README.md`, Loss of focus), and its own reports on the Stick then showed it pausing and resuming with the saved game kept. That nothing is heard over the launcher has not yet been confirmed by ear. An Alexa overlay can send `blur` alone: on the Stick on 8 October 2026 the owner heard the game's sounds go on over Alexa's answer while only the music stopped. Since [#325](https://github.com/fortemate/dicechess-tv/pull/325) the sound effects and the voices stop on `blur` too, which `native/test/lifecycle.test.tsx` checks; a listening check of that on the Stick is still to come.

## Icon & Splash Screen Traps

Two packaging details on Vega were easy to get wrong:

### The Launcher Icon (3:2 Crop)

The manifest has one icon field. Ours names a 512x512 PNG: `icon = "@image/icon.png"`. On the Virtual Device:

- In system **Settings**, the entire 1:1 square is displayed.
- On the launcher, the icon is scaled to fill a 3:2 tile, about 304x200 on a 1080p screen, and its top and bottom are cropped.
- Only about the middle two thirds of the icon's height stay visible there.

So everything that matters in our icon stays between y 100 and y 412 of its 512 pixels, with even side margins. The icon is also opaque: an earlier bare mark on transparency came out distorted on the launcher ([FL-16](/friction-log/#fl-16)). The launcher on a Fire TV Stick has not been checked.

_Verification:_ `native/test/splash.test.ts` fails if any artwork in the icon lies outside that band or any of its pixels is transparent. It was checked by enlarging the dice until the test failed.

### The Splash Archive (`SplashScreenImages.zip`)

Vega's animation service reads `assets/raw/SplashScreenImages.zip` directly when the app launches; nothing in the manifest points at it:

- As Amazon's [splash screen documentation](https://developer.amazon.com/docs/react-native-vega/0.83/splashscreenmanager) describes, the archive holds a `desc.txt` file (width, height and frame rate, e.g. `1920 1080 30`, then `c 0 0 _loop`) and a `_loop` directory of PNG frames.
- **Archive root trap:** `desc.txt` and `_loop` must sit at the root of the archive, as that page warns. With a wrapping folder, the animation service on the Virtual Device silently showed nothing.
- **Deterministic archive:** `native/scripts/generate-assets.mjs` stamps every entry of the archive with a fixed time and runs `zip` in UTC, so two builds write byte-identical archives wherever they run.
- **The archive loops:** on our Fire TV Stick (Vega OS 1.2), a count of 1 in `desc.txt` and a separate hold part both repeated the whole archive, as a [public bug report](https://community.amazondeveloper.com/t/28867) describes. A cool start keeps the splash up for about 2.2 s there, so an animation either repeats or is cut halfway. Ours is a 3.1 s loop that ends where it starts, with the title still in every frame ([#289](https://github.com/fortemate/dicechess-tv/issues/289)).

## Scripted Virtual Device Automation

To drive the Virtual Device from scripts and coding agents, with nobody at the emulator, Fortemate wrote [`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`), an MIT-licensed tool. It runs on a developer's machine against a running Virtual Device; CI does not run it.

What we used it for:

- **Key presses:** `vvd press` sends `KEY_KPENTER`, `KEY_BACK` and the arrows through the Android emulator's gRPC `EmulatorController.sendKey`, the route the on-screen remote uses. QEMU's `send-key`, the emulator console's `event send` and the device's `inputd-cli` report success and reach no app ([FL-08](/friction-log/#fl-08)).
- **Waiting for the screen:** `vvd wait-change` compares screenshots and exits 0 as soon as the screen differs from how it looked when the command started, or 1 on timeout, so a script can tell that a press did something.
- **Frames:** `vvd frames` polls the emulator's `getScreenshot` and saves each distinct frame it catches; while the screen changes, each screenshot takes 23 to 61 ms. It showed a 220 ms piece slide in flight in 4 to 6 frames, and the dice tumbling in. It is too coarse to count dropped frames, and smoothness on a Fire TV Stick has not been checked.
