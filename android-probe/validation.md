# Android prototype validation — October 28, 2026

## Scope and result

The standalone prototype built and passed its scripted smoke checks on an **Android TV emulator**, Android 12 / API 31, `arm64-v8a`, 1920×1080 at 320 dpi. `Platform.isTV` reported true. The app has a separate identity, `com.fortemate.dicechesstv.probe`.

This qualifies a small compatibility probe, not the complete game, physical Android TV, or Fire OS. No production source under `native/src/` or `src/core/` was changed. The branch starts from `next` at `09103404341b0ea11bd002f8ac0c47ba30c3c7e4`. `main`, the contest site, and releases remain unchanged.

## Build evidence

- Node 26.8.2, JDK 17, NDK 27.1.12297006, CMake 3.22.1, generated Gradle 9.0.0 project.
- Expo 55.0.32, React Native TV 0.83.10-1, React 19.2.0, Worklets 0.7.4, MMKV 4.3.2, Nitro 0.37.1, Expo Audio 55.0.18.
- Standalone `assembleRelease` APK built with the generated **debug key** for local testing. Only `arm64-v8a` was built. No Metro server was running during the smoke checks.
- APK manifest: minimum API 24, target API 36, TV launcher entry; microphone, external-storage and system-overlay permissions explicitly blocked.
- Tested APK SHA-256: `662a85db63081ee748f7a5f36c94d2a6ab8b5ab402f5f5d5f095e0b18253f9ef`.
- The first native attempt exposed an API 22/Hermes API 24 mismatch. A subsequent compile hit local disk pressure; after reducing concurrent build activity it completed. These are distinct from runtime compatibility failures.

## Emulator observations

All ten groups in `scripts/smoke.py` passed:

| Check                         | Observed evidence                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TV startup                    | Standalone APK launched; TV flag true                                                                                                                               |
| Canonical bot / stale / error | Real aggressive-bot request returned a legal complete turn; a reply for another game was rejected; a request in roll phase returned the expected protocol error     |
| Remote during background work | D-pad changed the selected diagnostic and Back canceled the promise during a synthetic three-second background CPU hold; no successful old reply appeared afterward |
| New-game replacement          | The replacement action canceled the old request while its runtime was occupied; no old result was applied                                                           |
| MMKV process-stop recovery    | A partial turn with dice `[1, 1, 1]` and one completed move survived force-stop/relaunch and decoded to the exact saved snapshot                                    |
| Background/resume             | Home and relaunch generated background/active and blur/focus transitions; the real bot completed after resume while RN heartbeat callbacks continued                |
| PCM completion                | Native playback status reported completion of the bundled one-second tone                                                                                           |
| Seek / concurrent players     | Both player paths accepted seek requests and independently emitted completion; perceptual timing and mixing were not measured                                       |
| Tutorial speech completion    | The pinned Thinkle MP3 emitted native completion                                                                                                                    |
| Background audio teardown     | Home invoked player pause/removal; no completion event arrived afterward before relaunch                                                                            |

The emulator ran with host audio output disabled. These are native API/event observations, **not a human listening review** or proof of silence, volume balance, gapless transitions, ducking, audio-focus recovery, or physical speaker behavior.

Two failures found by the emulator were corrected:

1. Android Hermes rejected the engine's raw `class` syntax inside `eval`, even though Node tests and APK bundling passed. The asset now receives RN Babel syntax lowering with inline helpers. A regression test compiles it with the installed Hermes compiler.
2. This focus target delivered D-pad release events (`eventKeyAction: 1`). Ignoring releases left the menu selection unchanged. The probe now handles one release per press and the script asserts the resulting selection, rather than merely observing an event. Held-key/repeat behavior is deliberately not qualified.

Raw event JSON, logcat and the final screenshot are local generated evidence under `android-probe/build/smoke/`; they are not committed. Reproduce with the commands in [README.md](README.md).

## Repository checks

- Root typechecks, lint, format and 337 tests passed.
- Vega typechecks, lint and 711 tests passed; Metro bundle and installable Vega build passed. No Vega device session was repeated because production code was unchanged.
- Browser bench: 13 tests and production build passed.
- Android prototype: typecheck, lint and 3 tests passed, including isolated engine execution and Hermes syntax validation; standalone APK build and the ten emulator groups above passed.
- Workflow syntax and `git diff --check` passed.

## Decision and remaining work

The selected libraries are viable candidates for the next extraction step. No custom Kotlin module was needed for these probes. Reuse the existing bot protocol and synchronous storage contract; keep Android engine-source lowering and remote semantics explicit.

Before a playable Android slice: extract platform seams on Vega, preserve its physical-device regression gate, then move shared UI/controller code into the agreed package structure. The prototype is not a second implementation of the game.

Still required: physical Fire OS model/API/ABI selection; complete games and all screens; held remote input and menu behavior; accessibility; corrupt-save recovery; real audio listening, focus interruptions, repeated speech replacement, tutorial sequencing, music and ducking; additional ABIs; production dependency notices and resolution of the Expo tooling audit findings described in the README. No store publication, release, or default-branch change is authorized by this result.
