# Android TV regression and Vega parity

## Baseline: October 31, 2026

This regression uses merged `next` commit
`0fe3ba12ac77db06337d0b77cddaa3323003035a` (through PR #522).
The standalone ARM64 APK was rebuilt from that commit. SHA-256:
`92b986d7f101a094cb66fa7116f2c01d9362cbe17dd9aa26f36965a51247a94c`.
It is an internal debug-signed test APK, not a distribution build.

Runtime evidence comes from a separate, temporary DiceChessTVOnboarding AVD:
Android TV API 31, ARM64, 1920 x 1080 pixels, density 320 (960 x 540 dp).
The existing DiceChessTVProbe saved-game profile is not used or cleared.
Screens are driven by D-pad, OK, Back and Home through ADB. Diagnostics clears
the temporary probe profile once; the first-launch suite clears it between
answer cases. Other product suites create or replace disposable games through
the normal UI. Preferences are set to a documented baseline through the
Settings UI between suites so tests do not inherit another suite's mute,
automatic-play or rotation choices. No game
snapshots, rolls, moves or preference values are injected into app storage.

Vega comparisons below use the shared components, reducers and platform wiring
in the same source revision. This run does not include a new Vega Virtual Device
or physical Fire TV comparison. A passed Android check is not proof of runtime
parity on other hardware.

## Regression results

All 19 existing smoke suites passed: 105 assertion groups. Per-suite checks,
logs, snapshots and the aggregate `run.json` are retained under the ignored
`android-probe/build/regression-2026-10-31/` directory.

| Suite             | Script                                                                       | Passed groups | Coverage                                                                                  |
| ----------------- | ---------------------------------------------------------------------------- | ------------: | ----------------------------------------------------------------------------------------- |
| diagnostics       | [smoke.py](scripts/smoke.py)                                                 |            11 | Worker isolation, stale replies, disposal, MMKV, native audio and SVG gallery             |
| onboarding        | [tutorial-offer-smoke.py](scripts/tutorial-offer-smoke.py) (`--phase fresh`) |             4 | Unanswered relaunch, Learn/Skip/Back, speech completion and one-time persistence          |
| home              | [home-smoke.py](scripts/home-smoke.py)                                       |             9 | Menu order, focus, single save, canceled replacements, rematch, exit and diagnostic route |
| hotseat-audio     | [hotseat-smoke.py](scripts/hotseat-smoke.py) (`--audio`)                     |            11 | Legal moves, spent dice, pause/cancel, result audio, Home and process restore             |
| selection         | [selection-smoke.py](scripts/selection-smoke.py)                             |            11 | Three opponents and all three side choices, cancellation and exact restart recovery       |
| bot               | [bot-smoke.py](scripts/bot-smoke.py)                                         |             6 | Worker moves, bot-turn pause/background, exact restoration and rematch                    |
| tutorial          | [tutorial-smoke.py](scripts/tutorial-smoke.py)                               |            10 | All six lessons, closing choices, replacement confirmation and exact friend/bot saves     |
| rules             | [rules-smoke.py](scripts/rules-smoke.py)                                     |             6 | All nine topics, both entry points, bot pause, Back and saved-game preservation           |
| about             | [about-smoke.py](scripts/about-smoke.py)                                     |             5 | Shared credits, all directions, Home/Back and friend/bot game preservation                |
| settings          | [settings-smoke.py](scripts/settings-smoke.py)                               |             4 | Volume/mute, lifecycle, process restart and friend/bot game preservation                  |
| settings-burst    | [settings-burst-smoke.py](scripts/settings-burst-smoke.py)                   |             1 | Batched navigation/value events, correct row and persisted changes                        |
| gameplay-settings | [game-settings-smoke.py](scripts/game-settings-smoke.py)                     |             3 | All Highlights choices, board rotation and automatic sole move                            |
| play-as           | [play-as-smoke.py](scripts/play-as-smoke.py)                                 |             2 | All preferences, cancellation, persistence and application to new games                   |
| portraits         | [portraits-smoke.py](scripts/portraits-smoke.py)                             |             2 | Opponent cards, directions, side selection and saved-game restoration                     |
| host              | [host-smoke.py](scripts/host-smoke.py)                                       |             3 | Off/Prowla/Rolly/Thinkle, portraits/captions, persistence and bot-game preservation       |
| voices            | [voices-smoke.py](scripts/voices-smoke.py)                                   |             5 | Host/opponent/tutorial speech, gain/mute, completion, cancellation and background         |
| music             | [music-smoke.py](scripts/music-smoke.py)                                     |             4 | Menu/calm playback, persistence, ducking, lifecycle and result timing                     |
| in-game-settings  | [in-game-settings-smoke.py](scripts/in-game-settings-smoke.py)               |             4 | All eight live rows, return focus, sole-move pause and exact saved turns                  |
| recovery          | [recovery-smoke.py](scripts/recovery-smoke.py)                               |             4 | Rendering fault, service disposal, both recovery choices, Home/Back and cold app launch   |

Local checks passed: `mise run check` (337 core, 751 native and 13 browser tests,
types, lint, formatting, Vega Metro bundle and browser build), plus Android
types/lint and all 76 Android tests.
The Android ARM64 APK and Vega armv7, x86_64 and aarch64 packages built
successfully. Only the Android APK was exercised on an emulator in this run.

The diagnostics suite opens the real engineering URL from a cleared temporary
profile. This supplies emulator-level evidence for its App route bypassing
onboarding. The mounted `FirstLaunch` disabled-prop case alone still does not
test that URL-to-route integration.

### Targeted parity observations

The additional remote and tutorial checks are stored in
`parity-observations/observations.json`, with original screenshots and event
captures. The first-lesson comparison uses the same selected pawn, dice and
cursor in both runs. The board rectangle (96,84)-(1008,996) has identical RGB
pixels with Standard and High contrast saved. The resumed real game reports
High contrast and remains identical to its prior saved snapshot.

The synthetic long Down emitted no Home state event, including during an
initial wait for a transition. A follow-up measurement records that absence
and confirms that an ordinary Down still advances the selection. This is
an exploratory input limitation, not a failed discrete-key smoke suite.
The first attempt's data is retained in `parity-observations-attempt-1/`.

### Full emulator cold boot

An additional cold-boot check passed. The exact real partial-turn snapshot and
every setting were read through the UI before stopping the emulator. The same
AVD was then started with `-no-snapshot`, retaining its disk data. A normal launch
opened home; Resume restored the same position, roll, spent moves, turn and
phase, and every setting matched the recorded baseline. Captures and the
comparison are retained in `cold-reboot/`.

The existing game itself suppresses onboarding in this case. Independent
answer persistence is covered by the empty-profile process-restart cases above.

### Reproduce individual suites

Build/install the APK as in README and use the dedicated
DiceChessTVOnboarding AVD for checks that clear data. The first two suites are
the diagnostics smoke and `tutorial-offer-smoke.py --phase fresh`; they leave
an answered first-launch profile with no real current game for the home suite.
Run the remaining suites in the results table in order, with one driver at a
time:

```sh
mise exec -- python3 android-probe/scripts/<script> \
  --adb <adb-path> --serial <serial> \
  --output android-probe/build/<run>/<suite>
```

Use `--audio` for `hotseat-smoke.py`. Before each ordinary suite, use home
Settings to restore Music On/7, Sounds On/10, Voices On/10, Standard Highlights,
Auto-play only move Off, Play as Ask, Turn board for friends Off and host Prowla.
The suites then exercise their own changes and persistence assertions. These
are UI preconditions, not storage fixtures. The historical migration suite is
excluded for the reason in Qualification limits.

## Remaining differences

The smoke assertions above pass. The exploratory observations and source
comparisons below identify gaps those assertions do not cover. Each entry
states whether its basis is an emulator observation or source inspection.

| Area                             | Difference from Vega                                                                                                                                                                                                                                                                                       | Basis                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings TV safe area            | In the standalone Android Settings capture, the Back footer's visible text extends to y=1041 on a 1080-pixel screen. The 5% safe bottom is y=1026, so part of the hint enters the overscan band. The Android container centers the panel/footer with fixed horizontal padding and no vertical safe insets. | Inspected `gameplay-settings/settings.png` and pixel bounds in this run; [Android Settings](src/Settings.tsx). This is a layout defect, not a failure of preference persistence.                                                                                                                                                                        |
| Tutorial Highlights              | Android `LearnToPlay` does not pass the saved Highlights choice to the shared `TutorialScreen`; the board defaults to Standard. Vega passes the current Highlights preference to its tutorial.                                                                                                             | [Android wrapper](src/LearnToPlay.tsx), [Vega screen](../native/src/GameScreen.tsx), [tutorial board](../native/src/TutorialScreen.tsx). The same selected lesson board is pixel-identical with Standard and High contrast saved; the resumed real game reports `high-contrast` and retains its exact snapshot. Captures are in `parity-observations/`. |
| Menu shortcut                    | Android's remote adapter forwards direction releases and completed OK presses, with a separate Back channel. It does not forward the Menu action that Vega supports.                                                                                                                                       | [Android adapter](src/androidRemote.ts), [remote surface](src/RemoteSurface.tsx), [Vega adapter](../native/src/vegaRemote.ts). Android keycode 82 leaves the game overlay at `none`; Back opens `menu` over the exact same saved game. Captures/events are in `parity-observations/`.                                                                   |
| Home and game presentation       | Home actions and game reducers are shared, but Android uses a separate home layout and game status panel. It does not render Vega's complete `Matchup`/`Status`/`ModeLine` presentation or reuse all of its prompts. Shared portraits and commentary do not make these screens visually identical.         | [Android home](src/HomeScreen.tsx), [Android game](src/GameScreen.tsx), [Vega game](../native/src/GameScreen.tsx), and inspected Android screenshots. No new paired Vega screenshots.                                                                                                                                                                   |
| Game accessibility announcements | Android's custom game screen does not wire Vega's `screenSpeech`/`announce` flow for changes to the board, dice, moves and results. The single focus target's label does not establish equivalent announcements.                                                                                           | [Android game](src/GameScreen.tsx), [Vega game](../native/src/GameScreen.tsx), [announcer](../native/src/announcer.ts). TalkBack runtime is unqualified.                                                                                                                                                                                                |
| Held input and pressed feedback  | The Android bridge forwards completed presses. Vega forwards down/up phases and uses held-OK feedback in the game and opponent menu. Discrete-key regression does not qualify held-direction repetition or equivalent press feedback.                                                                      | Platform adapters above and `pressed` wiring in the two game screens. ADB `--longpress 20` produces no home-state transition; a subsequent discrete Down moves from Resume game to Play a friend. This does not qualify physical held-key behavior.                                                                                                     |
| Handled storage/worker errors    | Android keeps saved data and displays its handled error page for load/save/worker failures. Its shared Recovery screen covers rendering failures. Vega's startup and game boundary use different error/reset paths.                                                                                        | [Android game](src/GameScreen.tsx), [Vega owner](../native/src/GameApp.tsx), [Recovery validation](recovery-validation.md). Corrupt-save and failed-write paths have automated-test evidence, not injected emulator data in this run.                                                                                                                   |
| Distribution notices             | Android About exposes source/asset credits. Complete packaged Android dependency notices remain a distribution gate.                                                                                                                                                                                       | [Android About](src/About.tsx), [About validation](about-validation.md).                                                                                                                                                                                                                                                                                |

Completed-game counters are intentionally deferred until a user-facing statistics
feature is scoped. They are not a blocker for this regression and were not added.

The smallest next changes are the observed tutorial Highlights wiring and
standalone Settings safe-area layout. Menu/held-input support, full home/game
presentation reuse and game accessibility can be scoped separately.

## Qualification limits

- Automated native player events verify requests, playback, completion, volume,
  ducking and teardown. They do not establish human listening quality, loop-seam
  quality or physical TV audio behavior.
- This run covers one API level and one ABI. Physical Android TV/Fire OS devices,
  other Android versions/ABIs, device latency and prolonged audio stress remain
  separate qualification.
- Music checks cover menu/calm playback, mute/volume, ducking, lifecycle and result
  timing. Every danger/check arrangement is not exercised by these smoke cases.
- Current/legacy eligibility and storage failures also have unit/mounted tests.
  The old two-namespace migration suite requires its historical APK and original
  saves; it is not silently counted as rerun here.
- Recovery uses an intentional React rendering failure. Native crashes and
  arbitrary asynchronous exceptions are not qualified by that check.
