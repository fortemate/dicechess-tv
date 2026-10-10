---
title: Friction log
description: 'The reproducible obstacles we met building Dice Chess for Fire TV with the Vega SDK 0.24 and its tools: for each, the steps, the result, a severity, the workaround and a suggestion.'
# The address is cited from outside, so it does not depend on the sidebar group.
slug: friction-log
sidebar:
  order: 1
---

This is the friction log of Dice Chess for Fire TV, kept while we built the app for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/). It records the reproducible obstacles we met in Amazon's Vega SDK, its tools and its documentation. Our own bugs are not here.

Each entry has the fields the [rules](https://amazonappdev2026.devpost.com/rules) ask for: the task attempted, the steps taken, the expected and actual results, a severity, the workaround and an actionable suggestion. Entries were written when the obstacle happened, while the versions, steps and workaround were still known. Where an entry gives evidence, it names where the finding is recorded: a file, commit, pull request or issue of this project's repository, or a thread on Amazon's developer forum. Pointers into `native/README.md` name commit `04b0a88`, the last version that held its long-form platform records, before they were condensed into this site's Technology and Build and run pages. Where an entry involves a device, it is the Vega Virtual Device unless the entry says otherwise. The game has run on a Fire TV Stick 4K Select since 6 October 2026; every entry is older. FL-20 and FL-21 have updates from the Stick; the others have not been checked on it.

Severity: **Blocker** stopped the chosen approach; **High** cost a day or would break the app for users; **Medium** cost hours or needed a workaround; **Low** is friction without lasting cost.

## Environment

| Item             | Version                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Development host | MacBook Air (Apple silicon); a second build machine on Ubuntu 26.04                       |
| Vega SDK         | 0.24.12112; 0.24.12044 and 0.23.9221 in the WebView comparison                            |
| Vega CLI         | 1.3.4 on macOS, 1.4.2 on Ubuntu                                                           |
| Virtual Device   | 1920x1080, OS 1.2 (SDK 0.24 image)                                                        |
| App stack        | React Native 0.83 through `@amazon-devices/react-native-kepler` 4.0.x, React 19.2, Hermes |
| Vega packages    | `react-native-svg` 3.0.x, `react-native-mmkv` 1.0.x, `react-native-w3cmedia` 2.3.2        |
| Lint             | `@amazon-devices/eslint-plugin-kepler` 0.1.15                                             |
| Agent tools      | `@amazon-devices/amazon-devices-buildertools-mcp` 1.0.13                                  |

## Summary

| #               | Obstacle                                                                     | Area                              | Severity | Status        |
| --------------- | ---------------------------------------------------------------------------- | --------------------------------- | -------- | ------------- |
| [FL-01](#fl-01) | WebView app crashes at launch on SDK 0.24, even with static HTML             | WebView                           | Blocker  | Open          |
| [FL-02](#fl-02) | `vega device launch-app` reports success for an app that crashed             | CLI                               | Medium   | Open          |
| [FL-03](#fl-03) | The OK button arrives under three names, one undocumented                    | Input                             | High     | Worked around |
| [FL-04](#fl-04) | Two input APIs cancel each other out without an error                        | Input                             | High     | Worked around |
| [FL-05](#fl-05) | The static `UserInputManager.addListener` aborts the JS thread               | Input                             | Medium   | Avoided       |
| [FL-06](#fl-06) | Back needs a different hook from every other key                             | Input, docs                       | Medium   | Worked around |
| [FL-07](#fl-07) | An app that renders nothing at first never receives remote input             | Input                             | High     | Worked around |
| [FL-08](#fl-08) | Three key-injection routes report success and reach no app                   | Virtual Device                    | Medium   | Worked around |
| [FL-09](#fl-09) | The Vega CLI has no screenshot command, and the device's tool fails silently | CLI, device                       | Medium   | Worked around |
| [FL-10](#fl-10) | Release builds send no `console.log` output to the log stream                | CLI                               | Medium   | Worked around |
| [FL-11](#fl-11) | OGG and M4A do not play, and `canPlayType` answers backwards                 | Audio                             | Medium   | Worked around |
| [FL-12](#fl-12) | Audio wants a plain path where `fetch` wants a `file://` URL                 | Audio                             | Low      | Worked around |
| [FL-13](#fl-13) | No documented way to run heavy app work off the JS thread                    | Runtime                           | Medium   | Open          |
| [FL-14](#fl-14) | The Vega ESLint plugin crashes on ESLint 10 and hides its advisories         | Lint                              | Medium   | Worked around |
| [FL-15](#fl-15) | Routine dependency updates break the build or downgrade the SDK              | Toolchain                         | Medium   | Worked around |
| [FL-16](#fl-16) | One icon field serves two surfaces with different shapes                     | Packaging                         | Low      | Worked around |
| [FL-17](#fl-17) | The SDK installer edits every shell profile without asking                   | Installer                         | Low      | Open          |
| [FL-18](#fl-18) | Undeclared system services are refused without an error in the app           | Manifest                          | High     | Worked around |
| [FL-19](#fl-19) | `inputd.service` is not needed on 0.24, and declaring it stopped our app     | Manifest, docs                    | Medium   | Worked around |
| [FL-20](#fl-20) | The KPI Visualizer fails an offline app on network calls                     | Performance tools                 | Low      | Open          |
| [FL-21](#fl-21) | Warm-start KPIs cannot be measured on the Virtual Device                     | Performance tools, Virtual Device | Medium   | Open          |
| [FL-22](#fl-22) | The Builder Tools telemetry switch is undocumented and shared with the SDK   | Agent tools, docs                 | Medium   | Worked around |
| [FL-23](#fl-23) | The Builder Tools installer registers its server at `@latest`                | Agent tools                       | Medium   | Worked around |
| [FL-24](#fl-24) | The Builder Tools page lists an agent option and tools the package lacks     | Agent tools, docs                 | Low      | Worked around |
| [FL-25](#fl-25) | Looping audio loses 0.3 s at the seam, and `ended` arrives late              | Audio                             | Medium   | Worked around |
| [FL-26](#fl-26) | The docs call `volume` and `muted` unsupported, yet both take effect         | Audio, docs                       | Low      | Open          |
| [FL-27](#fl-27) | MP3 encoder padding is played, not trimmed                                   | Audio                             | Low      | Worked around |
| [FL-28](#fl-28) | `launch-app` restarts a background app, and the emulator's Home does nothing | CLI, Virtual Device               | Medium   | Worked around |
| [FL-29](#fl-29) | Adaptive Display cannot be set on the Virtual Device, or VoiceView by `vdcm` | Virtual Device, docs              | Medium   | Open          |
| [FL-30](#fl-30) | `install-app` takes a package built for another processor; it then crashes   | CLI, Virtual Device               | Medium   | Worked around |

## Entries

### FL-01 · WebView app crashes at launch on SDK 0.24, even with static HTML {#fl-01}

- **Date and environment:** 2026-09-21 · MacBook Air · Virtual Device on the SDK 0.24.12044 image (OS
  1.2, release 21).
- **Tool / SDK / component version:** the `vegaWebview` template; WebView 4.0.2 on React Native 0.83,
  and WebView 3.5.7 on React Native 0.72 with `react-native-kepler` 2.1.0.
- **User task:** package an existing web game board as a Vega app through the WebView template.
- **Minimal reproduction steps:** generate a `vegaWebview` project; replace `assets/index.html` with
  static HTML that references no JavaScript; build Release for aarch64; `vega device install-app`,
  then `vega device launch-app`; read `vega device running-apps` and the crash history.
- **Expected result:** the static page renders.
- **Actual result and evidence:** the app crashes at launch. With WebView 3.5.7 the report shows
  `SIGSEGV`, program counter `0x0`, and the next frame in `libkeplerscript-webview-lib-2.so.2.0` at
  offset `0x2471ba`; with WebView 4.0.2 a lifecycle crash. A full emulator restart did not help. The
  same inline-HTML control installs and stays running on SDK 0.23.9221 (OS 1.1). Evidence:
  `docs/vega-sdk-experiment.md`.
- **Severity and user impact:** Blocker. No WebView app could ship on that image, so the web board
  was abandoned and the game was rewritten as a native React Native app.
- **Workaround:** none for WebView. The native React Native path runs on SDK 0.24.
- **Suggested improvement:** if this is a known defect of the image, list it in the release notes; add
  a static-HTML WebView launch to the SDK's release checks.
- **Current status:** open. Not re-tested on 0.24.12112, because the app no longer uses WebView.

### FL-02 · `vega device launch-app` reports success for an app that crashed {#fl-02}

- **Date and environment:** 2026-09-21 · as [FL-01](#fl-01).
- **Tool / SDK / component version:** Vega CLI, `vega device launch-app`.
- **User task:** confirm that a freshly installed build starts.
- **Minimal reproduction steps:** install the FL-01 package; run
  `vega device launch-app -d <device> -a <component>`.
- **Expected result:** a failure when the app dies during launch.
- **Actual result and evidence:** the command reports success. Only `vega device running-apps` and the
  crash history (`vlcm crash-history`) show that the app is gone.
- **Severity and user impact:** Medium. A scripted build, install and launch check passes on a build
  that crashes.
- **Workaround:** follow every launch with a `running-apps` check and a read of the crash history.
- **Suggested improvement:** an option that waits a few seconds and fails if the app has exited or
  crashed, or a crash line in the command's own output.
- **Current status:** open.

### FL-03 · The OK button arrives under three names, one undocumented {#fl-03}

- **Date and environment:** 2026-09-24 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `useTVEventHandler` from `@amazon-devices/react-native-kepler`
  4.0.x.
- **User task:** act on the remote's OK button.
- **Minimal reproduction steps:** subscribe with `useTVEventHandler` and handle `select`, the name the
  `HWEvent` documentation gives; press OK on the Virtual Device's on-screen remote; press Enter on the
  keyboard.
- **Expected result:** one name for one button.
- **Actual result and evidence:** the on-screen remote sends `kpenter`, because its skin binds OK to
  `KEY_KPENTER`, the keypad Enter (`vvd/images/tv/vmtools/agent/skins/tv-remote/layout`; all three
  remote skins do the same). The keyboard sends `enter`. `select` is what the documentation says a
  physical remote sends; we have not had a device to confirm it. We found `kpenter` nowhere in the
  documentation, and the app ignored OK from the on-screen remote until a person pressed it. Evidence:
  `native/README.md` at commit `04b0a88`, Remote input,
  PR #50.
- **Severity and user impact:** High. The remote's main button looked dead in the emulator, with no
  error. A developer who tests with the keyboard alone would never notice.
- **Workaround:** treat `select`, `enter` and `kpenter` alike.
- **Suggested improvement:** list every `eventType` that the Virtual Device and devices emit in the
  `HWEvent` documentation, or normalise the OK button to `select` before it reaches the app.
- **Current status:** worked around.
- **Update, 2026-10-04:** Amazon staff had answered which name a remote's OK sends on 2026-08-31, in
  [another developer's bug report](https://community.amazondeveloper.com/t/0-24-rn-0-83-remote-select-never-invokes-onpress-focus-works/28945)
  on Amazon's developer forum. For React Native 0.83 apps, Vega OS 1.2 delivers the raw, lower-case
  key name, so OK arrives as `enter`, and "a future Vega OS release" will normalise it to `select`,
  the name React Native 0.72 apps received. So on OS 1.2 a remote's OK should arrive as `enter`, as
  the Virtual Device's keyboard sends it, and an app that handles only `select`, the name the
  documentation gives, would have a dead OK there. The answer does not mention `kpenter`, which stays
  undocumented, and the `HWEvent` page still gives only `select`. Before that answer, the developer
  who asked had reported in the same topic that on a Fire TV Stick with OS 1.2, OK did not reach even
  a `useTVEventHandler` callback that matched both `select` and `enter`; nobody replied after the
  answer, and the topic closed on 2026-09-14. The app treats all three names alike, so it does not
  depend on the change, but what a Stick's remote sends is still unchecked. The suggested improvement
  stands.

### FL-04 · Two input APIs cancel each other out without an error {#fl-04}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `useAddUserInputListenerCallback()` and `useTVEventHandler`,
  `@amazon-devices/react-native-kepler` 4.0.x.
- **User task:** receive the remote's keys on a game board.
- **Minimal reproduction steps:** mount a component that subscribes with
  `useAddUserInputListenerCallback()`; mount `useTVEventHandler` in the same app; press keys.
- **Expected result:** both subscribers receive the keys, or an error explains why one cannot.
- **Actual result and evidence:** `useAddUserInputListenerCallback()` delivers nothing at all while
  `useTVEventHandler` is also mounted. Alone, it works. The silence looks exactly like nobody pressing
  a key, which is why a diagnostic had to subscribe to one API at a time. Evidence:
  `native/README.md` at commit `04b0a88`, Remote input.
- **Severity and user impact:** High. It cost a day.
- **Workaround:** use `useTVEventHandler` for directions and OK, and nothing else alongside it.
- **Suggested improvement:** document that the two are exclusive, and warn in development builds when
  both are mounted.
- **Current status:** worked around.

### FL-05 · The static `UserInputManager.addListener` aborts the JS thread {#fl-05}

- **Date and environment:** 2026-09-22 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `UserInputManager.addListener`,
  `@amazon-devices/react-native-kepler` 4.0.x.
- **User task:** listen for remote keys outside React components.
- **Minimal reproduction steps:** call the static `UserInputManager.addListener` at startup.
- **Expected result:** a listener, or a documented error.
- **Actual result and evidence:** the JS thread aborts with `SIGABRT`. Evidence:
  `native/README.md` at commit `04b0a88`, Remote input.
- **Severity and user impact:** Medium. The app dies on startup.
- **Workaround:** the hooks instead.
- **Suggested improvement:** make the static call work on 0.24, or have it throw a JavaScript error
  that names the supported API.
- **Current status:** avoided.

### FL-06 · Back needs a different hook from every other key {#fl-06}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `useTVEventHandler` and `useKeplerBackHandler`,
  `@amazon-devices/react-native-kepler` 4.0.x.
- **User task:** use Back to cancel a selection on the board instead of closing the app.
- **Minimal reproduction steps:** handle `back` in `useTVEventHandler`; select a piece; press Back.
- **Expected result:** the handler sees Back and the app stays open.
- **Actual result and evidence:** the handler sees Back, but it cannot claim the event, so the app
  closes as well. Only `useKeplerBackHandler` can claim Back; it calls `exitApp()` itself when no
  handler returns true. Evidence:
  `native/README.md` at commit `04b0a88`, Remote input.
- **Severity and user impact:** Medium. Back quit the game instead of cancelling.
- **Workaround:** handle Back in `useKeplerBackHandler` and every other key in `useTVEventHandler`.
- **Suggested improvement:** say in the `useTVEventHandler` documentation that it cannot claim an
  event, and point to `useKeplerBackHandler` from there.
- **Current status:** worked around.

### FL-07 · An app that renders nothing at first never receives remote input {#fl-07}

- **Date and environment:** 2026-09-22 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** React Native for Vega, `@amazon-devices/react-native-kepler`
  4.0.x.
- **User task:** restore a saved game before showing the board.
- **Minimal reproduction steps:** return `null` from the root component until an effect has read
  storage, then render the board; press keys.
- **Expected result:** the board receives keys once it is rendered.
- **Actual result and evidence:** it never receives any. Every key press is lost, with nothing in any
  log and no crash. Rendering the board in the first render fixed it. We did not isolate the
  mechanism. Evidence:
  `native/README.md` at commit `04b0a88`, Saving.
- **Severity and user impact:** High. A common React pattern produces an app that looks frozen.
- **Workaround:** read storage synchronously (MMKV makes this easy) and render on the first frame.
- **Suggested improvement:** deliver input to a view tree that mounts after the first frame, or
  document the constraint and warn in development builds.
- **Current status:** worked around.

### FL-08 · Three key-injection routes report success and reach no app {#fl-08}

- **Date and environment:** 2026-09-22 to 2026-09-25 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `inputd-cli` on the device; the emulator console; QEMU monitor;
  the Android emulator's gRPC `EmulatorController`.
- **User task:** drive the app from a script, to test it without a person at the emulator.
- **Minimal reproduction steps:** send a key with `inputd-cli button_press`, with the emulator
  console's `event send`, or with QEMU's `send-key`; watch the app. Then restart the Virtual Device
  and send keys through the emulator's gRPC `sendKey`.
- **Expected result:** the key reaches the app, or the tool reports an error.
- **Actual result and evidence:** all three report success, and nothing reaches the app. `inputd-cli`
  does not even move the launcher with `KEY_HOME`; its `list_devices` finds no devices. Of the routes
  we tried, the one that works is the Android emulator's own gRPC `EmulatorController.sendKey`, the
  path the on-screen remote uses, which the Vega documentation does not mention. That route has three
  traps of its own.
  After a Virtual Device restart its gRPC endpoint stays off until the emulator console command
  `grpc <port>` turns it on, and the running emulator's discovery file, which holds the port and
  token, appears only then. Back arrives only as `KEY_BACK`: `KEY_ESC` does not reach the app as
  Back, although Esc typed on the host keyboard does, through the emulator's keyboard mapping. And OK
  cannot be sent as `select`: the virtual keyboard does not declare `KEY_SELECT` or `KEY_OK`.
  Evidence:
  `native/README.md` at commit `04b0a88`, Remote input; PR #17 (`inputd-cli`); the
  [vega-vvd-driver README](https://github.com/fortemate/vega-vvd-driver#what-works-and-what-silently-does-not),
  What works, and what silently does not.
- **Severity and user impact:** Medium. Hours went into routes that fail silently, and until the gRPC
  route worked, every input check needed a person at the emulator.
- **Workaround:** gRPC `sendKey` with the port and token from the running emulator's discovery file;
  after a restart, `grpc <port>` on the emulator console first; Back sent as `KEY_BACK`. We packaged
  this route as [vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver), an MIT-licensed
  tool: `vvd enable-grpc` after a restart, then `vvd press`.
- **Suggested improvement:** a supported `vega device send-key` command; an error from `inputd-cli`
  when it has no device to deliver to; `KEY_SELECT` declared on the virtual keyboard, so that `select`
  can be tested without a device; and the gRPC endpoint kept on across restarts, or the console
  command that turns it on documented.
- **Current status:** worked around.
- **Update, 2026-09-27:** Amazon documents a route we had missed. The
  [Appium Vega driver](https://developer.amazon.com/docs/vega/0.24/appium-commands.html) sends keys
  with `press_keycode`, through the device's automation toolkit. It needs an Appium 2.2.2 server, the
  `@amazon-devices/appium-kepler-driver` package, and the toolkit switched on with
  `vega exec vda shell "touch /tmp/automation-toolkit.enable"`. We have not tried it. The three routes
  above still report success and deliver nothing, and the Vega CLI still has no command to send a
  key.
- **Update, 2026-09-30:** we asked for `vega device press` and `vega device screenshot` commands,
  for the Virtual Device and for devices in developer mode, in a
  [feature request](https://community.amazondeveloper.com/t/vega-cli-commands-to-take-a-screenshot-and-press-remote-keys/29258)
  on Amazon's developer forum. Amazon staff passed it to the team as a feature request for
  consideration. No such command has shipped yet.

### FL-09 · The Vega CLI has no screenshot command, and the device's tool fails silently {#fl-09}

- **Date and environment:** 2026-09-22 to 2026-09-24 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** Vega CLI; the device's `screenshooter`.
- **User task:** capture what the app shows, to verify a change and record evidence.
- **Minimal reproduction steps:** look for a screenshot command in the Vega CLI; run `screenshooter`
  on the device.
- **Expected result:** a PNG of the screen.
- **Actual result and evidence:** the CLI has no screenshot command. `screenshooter` fails its capture
  call, even once its buffer-permission problem is worked around. Evidence:
  `native/README.md` at commit `04b0a88`, Verification.
- **Severity and user impact:** Medium. For two days, every visual check needed a person at the
  emulator.
- **Workaround:** the Android emulator console's `screenrecord screenshot <directory>`, and later the
  emulator's gRPC `getScreenshot`, which `vvd screenshot` in
  [vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver) calls.
- **Suggested improvement:** a `vega device screenshot` command.
- **Current status:** worked around.
- **Update, 2026-09-27:** the Appium Vega driver's `get_screenshot` captures the screen too
  ([FL-08](#fl-08)). We have not tried it; the Vega CLI still has no screenshot command.
- **Update, 2026-09-29:** on 2026-09-28, the device's `gwsi-tool-screenshooter`, which forum
  replies had suggested for screenshots, wrote a 0-byte PNG or hung on the Virtual Device, with no
  error. We
  [reported it](https://community.amazondeveloper.com/t/sdk-0-24-12112-vvd-gwsi-tool-screenshooter-writes-a-0-byte-png-or-hangs/29249),
  and Amazon staff replied that this is expected: the
  [VDA reference](https://developer.amazon.com/docs/vega/0.24/vda-tools.html) notes that the Virtual
  Device does not support the tool. It is the tool for a Fire TV Stick, and on the Virtual Device
  Amazon points to the Appium Vega driver's `get_screenshot`. The remaining friction is that the tool
  fails silently where it is unsupported, instead of exiting with an error that says so. Suggested
  improvement: make it exit with that error on the Virtual Device, and link the Appium screenshot
  documentation from the note.
- **Update, 2026-09-30:** we made both suggestions in reply, in the same forum topic, and Amazon
  staff passed them to the team as feedback. We also asked for a `vega device screenshot` command,
  with the key command from [FL-08](#fl-08), in a
  [feature request](https://community.amazondeveloper.com/t/vega-cli-commands-to-take-a-screenshot-and-press-remote-keys/29258).
  Amazon staff passed it to the team for consideration. No such command has shipped yet.

### FL-10 · Release builds send no `console.log` output to the log stream {#fl-10}

- **Date and environment:** 2026-09-22 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `vega device start-log-stream`.
- **User task:** read the app's diagnostic output from a Release build.
- **Minimal reproduction steps:** build Release; log with `console.log`; run
  `vega device start-log-stream`.
- **Expected result:** the app's lines in the stream.
- **Actual result and evidence:** only system and graphics lines appear. Evidence:
  `docs/vega-native-runtime-gate.md`, Reading the result off the device.
- **Severity and user impact:** Medium. The first on-device check could not read its results from the
  log stream and needed a reporting channel of its own.
- **Workaround:** a loopback-only HTTP receiver on the development machine, reached through
  `vega device start-port-forwarding --port 8099 --forward false`.
- **Suggested improvement:** document it where the log stream is documented, and offer a switch that
  keeps the app's console output in a Release build for development.
- **Current status:** worked around.

### FL-11 · OGG and M4A do not play, and `canPlayType` answers backwards {#fl-11}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/react-native-w3cmedia` 2.3.2, `AudioPlayer`.
- **User task:** play short sound effects in a game.
- **Minimal reproduction steps:** play the same effect as MP3, WAV, OGG and M4A; ask `canPlayType`
  about each.
- **Expected result:** the formats the platform can play, and a `canPlayType` that says which.
- **Actual result and evidence:** MP3 and WAV reach `playing` in 3 to 7 ms. OGG and M4A fail with
  error 4, identically in each of three runs. `canPlayType` answered "probably" for OGG and "" for WAV,
  the reverse of what happens; the package's README lists it among unsupported members. Evidence:
  `native/README.md` at commit `04b0a88`, What the probe established.
- **Severity and user impact:** Medium. The sound pack we had prepared was OGG only and could not be
  played as it stood.
- **Workaround:** MP3 exports.
- **Suggested improvement:** list the supported containers in the documentation; make `canPlayType`
  return "" for what the player cannot play, or remove it.
- **Current status:** worked around.

### FL-12 · Audio wants a plain path where `fetch` wants a `file://` URL {#fl-12}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/react-native-w3cmedia` 2.3.2.
- **User task:** play and read files packaged with the app.
- **Minimal reproduction steps:** set an audio source to `/pkg/assets/sfx/move.mp3`, then to
  `file:///pkg/assets/sfx/move.mp3`; `fetch` both forms.
- **Expected result:** one convention for packaged files.
- **Actual result and evidence:** the player plays the plain path and fails the `file://` URL with
  error 4; `fetch` reads the `file://` URL and refuses the plain path. The player also refuses `http://`
  outright (`isUriSchemeSecure Got an insecure protocol/scheme http`). Two smaller traps in the same
  package: `audio.onplaying = ...` is silently ignored (events arrive only through
  `addEventListener`), and the `Audio` component on its music and media defaults filled the log with
  `could not connect to audioserver`, while an `AudioPlayer` created as `CONTENT_TYPE_SONIFICATION` /
  `USAGE_GAME` played. Evidence:
  `native/README.md` at commit `04b0a88`, What the probe established.
- **Severity and user impact:** Low. It cost a probe run.
- **Workaround:** plain paths for audio, `file://` for `fetch`.
- **Suggested improvement:** accept both forms in both places, and a short guide to sound effects in a
  game that shows the right player and content type.
- **Current status:** worked around.

### FL-13 · No documented way to run heavy app work off the JS thread {#fl-13}

- **Date and environment:** 2026-09-22 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/headless-task-manager`;
  `@amazon-devices/react-native-worklets` 1.0.1.
- **User task:** run a game engine's search without freezing the interface.
- **Minimal reproduction steps:** register a headless task
  (`HeadlessEntryPointRegistry.registerHeadlessEntryPoint`, `[[components.task]]` in the manifest);
  look for an app-facing way to start it; start it from the CLI.
- **Expected result:** a documented way for an app to start background work.
- **Actual result and evidence:** the task builds and registers, but the app has no documented way to
  start it, and a start from the CLI fails with
  `com.amazon.apmf.SecurityError: Missing privileges to send message`. The documentation's examples
  are all system-driven (programme guide sync, install updates). React Native has no Web Worker.
  Worklets are documented for heavy computation, but we have not proved them with a pure JavaScript
  library. Evidence:
  `native/README.md` at commit `04b0a88`, The local opponents; PR #21.
- **Severity and user impact:** Medium. A stronger opponent than the random one needs this; the random
  one runs on the JS thread without a visible pause.
- **Workaround:** none yet for heavy work.
- **Suggested improvement:** a sample that runs a CPU-heavy, pure JavaScript library on a worklet
  runtime, or documentation of an app-facing trigger for headless tasks.
- **Current status:** open.

### FL-14 · The Vega ESLint plugin crashes on ESLint 10 and hides its advisories {#fl-14}

- **Date and environment:** 2026-09-24 · Node 26.
- **Tool / SDK / component version:** `@amazon-devices/eslint-plugin-kepler` 0.1.15.
- **User task:** lint the app with Amazon's rules in a current ESLint setup.
- **Minimal reproduction steps:** install ESLint 10 and the plugin; run `eslint .`.
- **Expected result:** the plugin's findings.
- **Actual result and evidence:** it crashes: it calls `context.getSourceCode()`, which ESLint 10
  removed. On ESLint 9 it works, but it ships only eslintrc presets, so a flat config has to copy its
  rules by hand. Its project-level advisories (for example a missing `useReportFullyDrawn`) print only
  through its own formatter, whose HTML report crashes under a flat config. It writes a `generated/`
  directory on every run, and `sdl-package-version-check-imports` reports every import of a
  system-distributed library ("This is not an error"). The
  [plugin page](https://developer.amazon.com/docs/vega/0.24/eslint-plugin.html) documents 7 of its
  17 rules and 2 of its 6 presets, and only eslintrc configuration (checked on 2026-09-26). Evidence:
  `native/eslint.config.mjs`,
  PR #47.
- **Severity and user impact:** Medium. ESLint is held at 9, and the advisories are easy to miss.
- **Workaround:** ESLint 9, the rules spread into the flat config by hand, the informational rule off.
- **Suggested improvement:** use `context.sourceCode`, publish a flat-config preset, report
  advisories as ordinary lint messages, and document every rule and preset the package ships.
- **Current status:** worked around.

### FL-15 · Routine dependency updates break the build or downgrade the SDK {#fl-15}

- **Date and environment:** 2026-09-23 to 2026-09-26 · SDK 0.24.12112 · GitHub Dependabot, npm.
- **Tool / SDK / component version:** `@amazon-devices/kepler-cli-platform`; `npm audit`.
- **User task:** keep dependencies patched without breaking the Vega build.
- **Minimal reproduction steps:** let Dependabot, with its usual rule of ignoring major updates, bump
  `react-native` from 0.83 to 0.87, and build; separately, run `npm audit` in a Vega app.
- **Expected result:** updates that the SDK supports, and security fixes that keep the SDK version.
- **Actual result and evidence:** `react-native` is a 0.x package, so 0.83 to 0.87 counts as a minor
  update and passed the rule. The build then stopped with
  `Current version of @amazon-devices/kepler-cli-platform does not support react native version: 0.87`,
  and our main branch stayed broken until the version was put back. `npm audit` reports 22 findings
  (2026-09-26), all in the development toolchain: `kepler-cli-platform`, `react-native-kepler`,
  `eslint-plugin-kepler`, the manifest builder and the React Native CLI pull in vulnerable `lodash`,
  `minimatch`, `ajv`, `toml`, `uuid` and `fast-xml-parser`. None of them reaches the device package.
  Its remedy, `npm audit fix --force`, installs `@amazon-devices/react-native-kepler@2.1.0`, the SDK
  0.23 line. Evidence:
  `.github/dependabot.yaml`,
  `native/README.md` at commit `04b0a88`, What `npm audit` reports, and why it is not shipped.
- **Severity and user impact:** Medium. A broken main branch, and security advice that would downgrade
  the platform.
- **Workaround:** Dependabot allows only patch updates for SDK-matched packages; `npm audit fix` is
  never run.
- **Suggested improvement:** publish the supported version matrix with a recommended Dependabot or
  Renovate configuration; declare peer ranges so that npm refuses an unsupported React Native; update
  the toolchain's vulnerable dependencies.
- **Current status:** worked around.

### FL-16 · One icon field serves two surfaces with different shapes {#fl-16}

- **Date and environment:** 2026-09-23 and 2026-09-25 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `icon` in `manifest.toml`.
- **User task:** give the app an icon that looks right in Settings and on the launcher.
- **Minimal reproduction steps:** follow the documentation's advice for the Settings icon (a light,
  solid mark on transparency); open the launcher. Then install a square, opaque 512-pixel icon with
  artwork near its top and bottom edges, and open the launcher again.
- **Expected result:** the icon fits both places.
- **Actual result and evidence:** the documentation describes the field as the Settings icon, but the
  launcher uses it too, and it does not show a square. It scales the icon to fill a 3:2 tile, about
  304x200 on a 1080p screen, and crops the top and bottom: only the band from y 100 to y 412 of the
  512-pixel icon survives. A bare mark on transparency came out visibly distorted there, and a first
  round of concepts for the game's icon lost the tops and bottoms of their dice. Measured on the
  Virtual Device while the icon was designed.
  Evidence:
  `native/README.md` at commit `04b0a88`, Icon and splash.
- **Severity and user impact:** Low. The first icon looked distorted on the Virtual Device's home
  screen.
- **Workaround:** an opaque icon whose artwork stays within that band, with even side margins; a test,
  `native/test/splash.test.ts`,
  fails if any of it leaves the band.
- **Suggested improvement:** document the launcher's use of the field, its tile shape and the band
  that stays visible, and recommend a safe zone; or add a separate launcher icon field.
- **Current status:** worked around.

### FL-17 · The SDK installer edits every shell profile without asking {#fl-17}

- **Date and environment:** 2026-09-22 (macOS) and 2026-09-23 (Ubuntu 26.04).
- **Tool / SDK / component version:** the Vega SDK installer (`get_vvm.sh`).
- **User task:** install the SDK.
- **Minimal reproduction steps:** run the installer.
- **Expected result:** a prompt before shell profiles change, or a printed line to add by hand.
- **Actual result and evidence:** on macOS it appended to all five shell profiles. On Ubuntu it
  installed without complaint on 26.04, although the documentation lists 20.04, 22.04 and 24.04: good
  for us, but it leaves the supported range unclear.
- **Severity and user impact:** Low. Profiles to tidy by hand afterwards.
- **Workaround:** none needed.
- **Suggested improvement:** ask before editing profiles, or edit only the current shell's; state
  whether newer Ubuntu releases are supported.
- **Current status:** open.

### FL-18 · Undeclared system services are refused without an error in the app {#fl-18}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `[wants]` in `manifest.toml`; `@amazon-devices/react-native-w3cmedia`
  2.3.2; `@amazon-devices/eslint-plugin-kepler` 0.1.15.
- **User task:** play sound effects.
- **Minimal reproduction steps:** add the media player and play a sound, with no `[[wants.service]]`
  entries in the manifest; read the device log.
- **Expected result:** an error in the app that names the missing declaration, or a lint finding.
- **Actual result and evidence:** every cue fails silently at the sink. The service manager refuses each
  connection and says so only in the device log (`missing permission for connection attempt`): 13
  refused connections to `com.amazon.audio.stream` in one probe run. The set that Amazon's own audio
  sample declares (`com.amazon.audio.stream`, `com.amazon.media.server`,
  `com.amazon.media.playersession.service`, `com.amazon.mediametrics.service`) was not enough: the
  player's audio-focus client also needed `com.amazon.audio.control`, refused at start-up until it was
  declared. In our check, the Vega ESLint plugin's API-privilege rules did not report the missing
  declarations. Evidence:
  `native/manifest.toml`.
- **Severity and user impact:** High. No sound at all, and nothing in the app says why.
- **Workaround:** declare all five services.
- **Suggested improvement:** raise a refused connection as a JavaScript error; list the services each
  package needs next to the package's documentation; have the lint rules check `[wants]` against the
  packages the app imports.
- **Current status:** worked around.

### FL-19 · `inputd.service` is not needed on 0.24, and declaring it stopped our app {#fl-19}

- **Date and environment:** 2026-09-23 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `[wants]` in `manifest.toml`; Amazon's React Native TV guidance,
  written for SDK 0.22, whose advice also appears in the `AmazonAppDev/devices-agent-skills`
  repository.
- **User task:** receive the remote's keys in a React Native for Vega app.
- **Minimal reproduction steps:** declare `com.amazon.inputd.service` under `[[wants.service]]`, which
  the guidance says `useTVEventHandler` needs; build and launch.
- **Expected result:** the remote works.
- **Actual result and evidence:** the process exits with code 255 at start-up, right after
  `Inputd-client: requestPriority ... WRITE_TO_UDEV`. Without the declaration the remote works. This was
  measured by adding and removing that one entry. Evidence:
  `native/manifest.toml`.
- **Severity and user impact:** Medium. Following the documented step stopped our app at launch, and
  the only clue was one log line. Amazon's own sample does not stop with the same entry (see the
  update below), so this is not general 0.24 behaviour. It was High until 2026-09-30.
- **Workaround:** leave the service undeclared.
- **Suggested improvement:** say in the guidance, and in the skill that repeats it, which SDK versions
  and devices still need the entry for `useTVEventHandler`; and log a reason when a declared service
  makes the process exit.
- **Current status:** worked around; to be checked again on a Fire TV Stick.
- **Update, 2026-09-30:** the entry title said that declaring the service crashes the app on 0.24,
  which claimed more than we had measured. We built Amazon's
  [vega-tv-interfaces-sample](https://github.com/AmazonAppDev/vega-tv-interfaces-sample) (commit
  `7546400`, its 0.24 release) unchanged with SDK 0.24.12112 and ran it on the Virtual Device, once
  as published, with `com.amazon.inputd.service` declared, and once with only that entry removed.
  Both started and navigated. In both, Right closed the open menu, which only the sample's
  `useTVEventHandler` callback does (`MenuWrapper.tsx`). So on the Virtual Device the service is not
  needed for `useTVEventHandler`, and declaring it does not stop every app. Why it stops ours is
  still open.

### FL-20 · The KPI Visualizer fails an offline app on network calls {#fl-20}

- **Date and environment:** 2026-09-25 · SDK 0.24.12112 · Virtual Device (OS 1.2).
- **Tool / SDK / component version:** `vega exec perf kpi-visualizer`.
- **User task:** measure the launch KPIs of an app that makes no network calls.
- **Minimal reproduction steps:** build Release; run
  `vega exec perf kpi-visualizer --app-name=<component> --kpi cool-start-latency --iterations 3`.
- **Expected result:** a pass once first frame and fully drawn are reported, since the app has nothing
  to fetch.
- **Actual result and evidence:** first frame (309 ms) and fully drawn (748 ms) are reported, but the
  run ends in `VALUE VALIDATION FAILED` with `-1 != Network calls time P100`: the validator treats the
  absence of network calls as a failure. Evidence:
  `native/README.md` at commit `04b0a88`, Launch time.
- **Severity and user impact:** Low. The report looks like a failure until each line is read, and
  certification mode would presumably report the same.
- **Workaround:** read the individual KPIs and ignore that one.
- **Suggested improvement:** report "not applicable" for network calls when an app makes none, rather
  than failing validation.
- **Current status:** open.
- **Update, 2026-10-06:** on a Fire TV Stick 4K Select (Vega OS 1.2), the same tool's cool-start runs
  of a later Release build, still without network calls, passed its validation, also without
  `--certification` ([Performance](/technology/performance/#on-a-fire-tv-stick)). The failure above
  was seen on the Virtual Device.

### FL-21 · Warm-start KPIs cannot be measured on the Virtual Device {#fl-21}

- **Date and environment:** 2026-09-25 · SDK 0.24.12112 · Virtual Device (OS 1.2).
- **Tool / SDK / component version:** `vega exec perf kpi-visualizer --kpi warm-start-latency`.
- **User task:** measure warm start, which the fully drawn marker also reports.
- **Minimal reproduction steps:** run
  `vega exec perf kpi-visualizer --app-name=<component> --kpi warm-start-latency --iterations 3` against
  the Virtual Device.
- **Expected result:** warm-start latencies.
- **Actual result and evidence:** every iteration fails its preparation, and the report completes 0 of 3. The preparation runs
  `vmsgr send pkg://<component>; sleep 10; vmsgr send pkg://com.amazon.smplighthouse.launcher.main`, and
  run by hand the second half fails with
  `CLI Send Error for URI: pkg://com.amazon.smplighthouse.launcher.main: []: Failed to send message, remote error`
  (exit 255). The Virtual Device's launcher is `com.amazon.keplerlauncherapp.main`, and sending that
  one works. The tool offers no option to name the launcher. Evidence:
  `native/README.md` at commit `04b0a88`, Launch time; PR #81.
- **Severity and user impact:** Medium. A warm-start KPI that Amazon measures cannot be checked before
  a physical device is at hand.
- **Workaround:** test the warm-start report in unit tests, and measure on a Fire TV Stick.
- **Suggested improvement:** detect the launcher on the target device, or accept it as a parameter.
- **Current status:** open.
- **Update, 2026-10-06:** on a Fire TV Stick 4K Select (Vega OS 1.2), the warm-start runs completed,
  with a median of 413 ms to first frame over 10 launches. The tool recorded no fully drawn time for
  them, so they ended in `VALUE VALIDATION FAILED`
  ([Performance](/technology/performance/#on-a-fire-tv-stick)).

### FL-22 · The Builder Tools telemetry switch is undocumented and shared with the SDK {#fl-22}

- **Date and environment:** 2026-09-26 · MacBook Air · Node 26.8.
- **Tool / SDK / component version:** `@amazon-devices/amazon-devices-buildertools-mcp` 1.0.13; Vega SDK
  0.24.12112.
- **User task:** install Amazon's MCP server for a coding agent with telemetry turned off.
- **Minimal reproduction steps:** read the
  [MCP server page](https://developer.amazon.com/docs/adbt/get-started.html) (formerly
  `docs/vega/0.24/mcp-server.html`, which now redirects there) and the package README for a way to
  turn telemetry off.
- **Expected result:** a documented switch: a flag, an environment variable or a setting.
- **Actual result and evidence:** the page says "You can disable telemetry collection in the
  settings" but names no setting, and the README does not mention telemetry. The package's code reads
  `optIn` from `~/vega/telemetry/config.json`, the Vega SDK's own telemetry file, which the Vega CLI
  reads too and has no command for. On our development machine it said `"optIn": true`. Evidence: the
  telemetry note in `CONTRIBUTING.md`.
- **Severity and user impact:** Medium. A developer who wants telemetry off cannot find the switch, and
  turning it off for the server also turns it off for the SDK, which no page says.
- **Workaround:** set `"optIn": false` in `~/vega/telemetry/config.json`.
- **Suggested improvement:** name the file and key on both pages, give the Vega CLI a command for it,
  and ask about telemetry when the SDK or the server is installed.
- **Current status:** worked around.

### FL-23 · The Builder Tools installer registers its server at `@latest` {#fl-23}

- **Date and environment:** 2026-09-26 · MacBook Air · Node 26.8 · Claude Code.
- **Tool / SDK / component version:** `@amazon-devices/amazon-devices-buildertools-mcp` 1.0.13.
- **User task:** add Amazon's MCP server and its agent skills to a project, at a version we reviewed.
- **Minimal reproduction steps:** run
  `npx -y @amazon-devices/amazon-devices-buildertools-mcp@1.0.13 init-context --agent claude-code-cli --skip-context-document`,
  then read the server entry it writes to `~/.claude.json`.
- **Expected result:** the server registered at the version that was installed, and a way to install
  the skills alone.
- **Actual result and evidence:** the entry runs
  `npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest`, whatever version the command itself
  named. Every start of the agent therefore fetches and runs the newest release, code nobody on the
  project has reviewed, with the agent's permissions. The entry is also user-wide, for every project.
  There is no skills-only mode: skipping both the context document and the server entry stops with
  "Nothing to do", so the skills always come with one of them. Evidence: the pinned
  `.mcp.json` and the setup steps in `CONTRIBUTING.md`.
- **Severity and user impact:** Medium. Unreviewed updates run silently in a tool with wide access.
- **Workaround:** register the server again at a fixed version (`claude mcp add … @1.0.13`), or remove
  the user-wide entry and pin the version in the project's `.mcp.json`.
- **Suggested improvement:** write the version that was installed, offer a `--skills-only` option,
  and say in the page that the entry applies to every project.
- **Current status:** worked around.

### FL-24 · The Builder Tools page lists an agent option and tools the package lacks {#fl-24}

- **Date and environment:** 2026-09-26 · MacBook Air · Node 26.8.
- **Tool / SDK / component version:** `@amazon-devices/amazon-devices-buildertools-mcp` 1.0.13; the
  [MCP server page](https://developer.amazon.com/docs/adbt/get-started.html), formerly the SDK 0.24
  page `docs/vega/0.24/mcp-server.html`.
- **User task:** set the server up for Claude Code in its desktop app, as the page describes.
- **Minimal reproduction steps:** look for the `claude-code-desktop` agent the page lists in the
  package's own list of agents; compare the page's list of tools with the server's answer to
  `tools/list`.
- **Expected result:** the option exists, and the tools match.
- **Actual result and evidence:** 1.0.13 has no `claude-code-desktop` agent. Its `claude-code-cli`
  agent writes `~/.claude.json`, which the desktop app's Code tab reads too. The page lists seven
  tools; the server answers with nine, adding `report_workflow_status` and `set_project_context`.
- **Severity and user impact:** Low. An agent option from the page fails, and two tools go
  undocumented.
- **Workaround:** `--agent claude-code-cli` for either kind of Claude Code.
- **Suggested improvement:** keep the page in step with each release, or generate its lists from the
  package.
- **Current status:** worked around.

### FL-25 · Looping audio loses 0.3 s at the seam, and `ended` arrives late {#fl-25}

- **Date and environment:** 2026-09-26 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/react-native-w3cmedia` 2.3.2, `AudioPlayer` as
  `CONTENT_TYPE_MUSIC` / `USAGE_GAME`.
- **User task:** loop background music without a gap.
- **Minimal reproduction steps:**
  - play a 4.000 s WAV or MP3 with `loop = true` and track `currentTime` every 20 ms;
  - separately, play it once and time the `ended` event against the position.
- **Expected result:** a gapless loop, and `ended` when the position reaches the end.
- **Actual result and evidence:**
  - The first seam lost 318 ms with MP3 and 323 ms with WAV. A restart on `ended` lost 285 ms.
  - `ended` came 380 to 460 ms after the position reached the end. The package implements `loop` in
    JavaScript, by calling `play()` when `ended` arrives, which explains both.
  - The package README lists `loop` among the unsupported members, yet it is implemented.

  Evidence: the results of a probe build (`MusicProbe.tsx`, on a branch that was never merged and has since
  been deleted), recorded in issue #76.

- **Severity and user impact:** Medium. A looping track would stall on every pass.
- **Workaround:** two players taking turns. The next pass starts on the other player before the loop
  ends, and the two crossfade (`native/src/music.ts`; `native/README.md` at commit `04b0a88`, Music).
- **Suggested improvement:** loop natively, as a media element does in a browser. At least fire
  `ended` when the position reaches the end, and document what `loop` does.
- **Current status:** worked around.

### FL-26 · The docs call `volume` and `muted` unsupported, yet both take effect {#fl-26}

- **Date and environment:** 2026-09-26 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/react-native-w3cmedia` 2.3.2; the package README
  and the 0.24 media player guide.
- **User task:** crossfade two music players and give the player a music volume setting.
- **Minimal reproduction steps:** set `volume` to 0.5, 0.25, 0 and 1, reading it back each time; ramp it
  from 1 to 0 in 40 steps of 50 ms; set `muted`.
- **Expected result:** documentation that agrees with itself and with the player.
- **Actual result and evidence:**
  - The package README lists `volume` and `muted` as unsupported, while the media player guide calls
    `volume` a standard property.
  - On the device every value read back exactly from the native side. The ramp held its 50 ms steps,
    each call took at most 1.2 ms, and `muted` read back too. Its effect on what is heard has not yet
    been checked by ear.

  Evidence: the probe results recorded in issue #76.

- **Severity and user impact:** Low. It cost a probe run to find out.
- **Workaround:** none needed; the app uses `volume` for its fades and its setting.
- **Suggested improvement:** remove `volume` and `muted` from the unsupported list, or say what does
  not work, and say whether a change is smoothed.
- **Current status:** open, for the documentation.

### FL-27 · MP3 encoder padding is played, not trimmed {#fl-27}

- **Date and environment:** 2026-09-26 · SDK 0.24.12112 · Virtual Device.
- **Tool / SDK / component version:** `@amazon-devices/react-native-w3cmedia` 2.3.2; ffmpeg 9.0.1 with
  libmp3lame, which writes the LAME header's delay and padding.
- **User task:** loop an MP3 cleanly.
- **Minimal reproduction steps:** encode a 4.000 s WAV to 192 kbit/s MP3; play both and read
  `duration` and the final `currentTime`.
- **Expected result:** 4.000 s for both, as browsers report for an MP3 with a LAME header.
- **Actual result and evidence:** the WAV reported 4.000 s. The MP3 reported 4.048 s and ended at
  4.075 s, so every pass carries the encoder's silence. Evidence: the probe results recorded in issue #76.
- **Severity and user impact:** Low. It adds a short gap to any MP3 loop.
- **Workaround:** the overlapping crossfade of [FL-25](#fl-25) covers it. WAV is exact but about ten
  times larger.
- **Suggested improvement:** honour the LAME and Xing headers' delay and padding, or document that
  they are ignored.
- **Current status:** worked around.

### FL-28 · `launch-app` restarts a background app, and the emulator's Home does nothing {#fl-28}

- **Date and environment:** 2026-09-26 · SDK 0.24.12112, Vega CLI 1.3.4 · Virtual Device.
- **Tool / SDK / component version:** `vega device launch-app`; the Virtual Device's input API through
  our key driver ([FL-08](#fl-08)).
- **User task:** check that music stops when the app leaves the screen and resumes when it returns.
- **Minimal reproduction steps:**
  - press Home through the emulator's input API (`KEY_HOMEPAGE`, 172, which the remote skin binds);
  - bring the launcher to the front with `vega device launch-app -a com.amazon.keplerlauncherapp.main`;
  - then run `vega device launch-app` for the app.
- **Expected result:**
  - Home sends the app to the background;
  - launching an app that is already running brings it back as it was.
- **Actual result and evidence:**
  - The Home key did nothing: the app kept the screen and the next key. On 2026-09-27 we also sent
    170, the code Amazon's Appium documentation gives for Home, with the same result.
  - The launcher route worked: it delivered `blur` and then `change: background`, and on the return
    `active` and `focus`, in every one of four trips.
  - `launch-app` of the backgrounded app started a new process. Earlier, a saved game restored at that
    start had made a restart look like a resume.

  Evidence: the probe results recorded in issue #76.

- **Severity and user impact:** Medium. It cost hours, and led to a wrong conclusion that had to be
  corrected.
- **Workaround:**
  - send the app to the background by launching the launcher;
  - log app-state events to a store that survives a restart, to tell a resume from a restart.
- **Suggested improvement:**
  - a CLI command that sends Home or backgrounds an app;
  - `launch-app` that foregrounds a running app, or a flag for it;
  - its output saying whether it started a process or resumed one.
- **Current status:** worked around.

### FL-29 · Adaptive Display cannot be set on the Virtual Device, or VoiceView by `vdcm` {#fl-29}

- **Date and environment:** 2026-10-02 · SDK 0.24.12112, Vega CLI 1.3.4 · Virtual Device (OS 1.2,
  release 21).
- **Tool / SDK / component version:** `vdcm` and `a11y-tv-util` on the device, through
  `vega device shell`, `vega exec vda shell` and `vega device run-cmd`; the Vega 0.24
  [WebView accessibility guide](https://developer.amazon.com/docs/vega/0.24/webview-accessibility-guide)
  and the React Native for Vega 0.83
  [accessibility page](https://developer.amazon.com/docs/react-native-vega/0.83/accessibility).
- **User task:** check every screen with Adaptive Display on, which
  [Amazon's developer news](https://community.amazondeveloper.com/t/aug-17-2026-ring-dev-updates-phynd-on-fire-tv/28966)
  says makes text and menus bigger on Vega devices, before a Fire TV Stick is at hand.
- **Minimal reproduction steps:**
  - open Settings on the Virtual Device's launcher;
  - in `vega device shell`, run the command the WebView accessibility guide gives,
    `vdcm set "com.amazon.devconf/system/accessibility/VoiceViewEnabled" "ENABLED"`;
  - in the same shell, `vdcm get com.amazon.devconf/system/accessibility/UiScaleFactor`, then
    `vdcm set` on that key;
  - `a11y-tv-util settings list`.
- **Expected result:**
  - a way to turn on Adaptive Display, or to set a text scale, on the Virtual Device, or a note in the
    documentation that it has none;
  - the guide's command turning VoiceView on.
- **Actual result and evidence:**
  - Settings holds only Account Settings, and no accessibility settings app is installed: nothing in the
    user interface turns Adaptive Display on.
  - `vdcm set` fails with `No permission for operation`, for `VoiceViewEnabled` as documented and for
    `UiScaleFactor` alike. All three shells run as `app_user` (uid 5000).
  - `UiScaleFactor` reads `1`. No documentation names it. It is our best guess for Adaptive Display's
    scale, and we could not find out whether it reaches an app as `fontScale`, as the dp scale, or not
    at all.
  - `a11y-tv-util settings list` fails with `Error obtaining user profile object`.
  - The accessibility page's own route does work. Its `inputd-cli` script holds Back and Menu for 3 s,
    and it turned VoiceView on (`VoiceViewEnabled` read `ENABLED`), although `inputd-cli`'s
    `button_press` reaches no app ([FL-08](#fl-08)). Back on VoiceView's welcome screen turned it off.

  Evidence: the probe report in issue #170 and its VoiceView follow-up.

- **Severity and user impact:** Medium. It cost hours, and the app's layout still cannot be checked
  against Adaptive Display before a Fire TV Stick is at hand.
- **Workaround:**
  - for VoiceView, the `inputd-cli` script from the React Native accessibility page;
  - for Adaptive Display, none on the Virtual Device: the check waits for a Fire TV Stick.
- **Suggested improvement:**
  - Adaptive Display in the Virtual Device's Settings, or a documented way to set `UiScaleFactor` and
    the other accessibility keys that the developer shell is allowed to use;
  - a note on what Adaptive Display changes for a React Native for Vega app: `fontScale`, the dp scale
    or a zoom of the picture;
  - in the WebView accessibility guide, the `inputd-cli` route, or a note that its `vdcm` command needs
    privileges that the developer shell lacks.
- **Current status:** open.
- **Update, 2026-10-02:** Amazon staff answered our
  [forum question](https://community.amazondeveloper.com/t/adaptive-display-what-does-uiscalefactor-change-for-an-app-and-can-it-be-set-on-the-virtual-device/29682)
  the same day. The `vdcm set` failures are expected, not a misconfiguration: the Vega SDK 0.24
  [release notes](https://developer.amazon.com/docs/vega/0.24/vega-release-notes.html) say that apps
  may read accessibility settings, but "setting accessibility values is gated by a runtime
  privilege". There is no documented way to change Adaptive Display or the font scale on the current
  Virtual Device, so large text is checked on a Fire TV Stick, under Settings → Accessibility →
  Adaptive Display. An app should follow `fontScale` rather than read the config key; the
  [density-independent pixels guide](https://developer.amazon.com/docs/vega/0.24/rn-migration-dip.html)
  keeps it apart from the dp scale. What `UiScaleFactor` is, and which values it takes, Amazon is
  still checking. The suggested improvements stand: the release notes explain the failures, but
  nothing says so where a developer meets them, on the Virtual Device or in the WebView
  accessibility guide.

### FL-30 · `install-app` takes a package built for another processor, and the app then crashes at start {#fl-30}

- **Date and environment:** 2026-10-09, reproduced on purpose on 2026-10-10 · SDK 0.24.12112, Vega CLI
  1.3.4 · Virtual Device (OS 1.2) on a MacBook Air with Apple silicon, where the Virtual Device is
  aarch64.
- **Tool / SDK / component version:** `vega device install-app` and `launch-app`;
  `@amazon-devices/react-native-mmkv` 1.0.x on React Native for Vega 0.83
  (`@amazon-devices/react-native-kepler` 4.0.x).
- **User task:** check a change on the Virtual Device with a Release build. The same build also makes
  the armv7 package for a Fire TV Stick.
- **Minimal reproduction steps:**
  - `npx react-native build-vega --build-type Release`, which writes an aarch64, an armv7 and an x86_64
    package;
  - `vega device install-app -d VirtualDevice -p build/armv7-release/<app>_armv7.vpkg` on an
    Apple-silicon Mac;
  - `vega device launch-app -d VirtualDevice -a <component id>`.
- **Expected result:** `install-app` refuses a package whose native libraries are for another
  processor than the device's, or at least warns. Failing that, the crash at launch names the missing
  library or the processor.
- **Actual result and evidence:**
  - `install-app` reports success, and so does `launch-app` ([FL-02](#fl-02)). The launcher stays on
    screen.
  - The device log shows the JS thread aborting (SIGABRT). `ModuleNotFoundError` is raised in
    react-native-mmkv's `getMMKVTurboModule` (`MmkvCxx`), and building that error then fails an
    `invariant` in react-native-kepler's `NativeModules` getter. Nothing mentions a processor.
  - Each package carries `libreact-native-mmkv-kepler.so` only under `lib/<arch>/` for its own
    processor. The crash report lists no library loaded from the package, only its
    `index.hermes.bundle`.
  - We took it for a broken Virtual Device. A restart changed nothing, and neither did an uninstall
    with a clean install, which deletes the saved game, the results and the settings.
  - The aarch64 package of the same build, installed over the armv7 one, ran at once, and the saved
    game was intact.
  - `vega device list` does show the Virtual Device as `tv - aarch64`, but nothing connects that to the
    package.

  Evidence: the Virtual Device's crash reports of 9 and 10 October, and pull request #337, which
  reproduces the crash with one commit: armv7 crashes, aarch64 runs.

- **Severity and user impact:** Medium.
  - It cost hours.
  - It led to an uninstall that deleted test data.
  - The Virtual Device was recorded as broken until the next day, which held back a pull request's
    device check.
- **Workaround:** `npm run device --prefix native` (`native/scripts/install.mjs`). It asks the device
  for its processor (`uname -m`), installs the package built for it, and refuses a package for another
  one.
- **Suggested improvement:**
  - `install-app`, or the device's package manager, compares the package's native libraries with the
    device's processor, and refuses or warns;
  - `vpt info` names the processors a package is built for;
  - a missing native module at start-up says that the package has no library for this processor,
    rather than only `ModuleNotFoundError`;
  - the build-and-run docs say which package goes on which device, the Virtual Device on Apple
    silicon included.
- **Current status:** worked around.

## What worked well

Amazon asks for the whole experience, so the good parts belong here too:

- The native path ran on the first attempt on SDK 0.24: a 2.3 MB package, launched in 404 and 426 ms,
  with an empty crash buffer.
- `react-native-svg` is part of the system, and it rendered all twelve chess pieces as inline JSX.
- MMKV is synchronous, so a saved game is restored in the first render with no loading state.
- MP3 and WAV effects start in 3 to 7 ms, quick enough for moves and dice.
- The SDK 0.24 template's Metro resolved our ESM-only engine without configuration, and Hermes
  compiled it cleanly.
- The SDK installed on Linux as well as macOS, so builds are not tied to one machine.
- HTTPS requests and a WebSocket worked without any manifest entry: unlike the audio services in
  [FL-18](#fl-18), no connection was refused.
- Amazon's Builder Tools MCP installed with one command and started under Node 26, offering a coding
  agent documentation search, trace analysis and crash symbolication.
- Two music players and three effect players ran at once without an error, and effects never paused
  the music. A released player was re-created and playing again within about 50 ms.
- `blur` and the change to background arrived on every trip to the launcher, so the app can stop its
  music before the launcher is on screen.
