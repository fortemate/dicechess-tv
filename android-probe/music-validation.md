# Android Music validation

Android uses Vega's role selection (`musicRole` and `useDanger`), volume curve,
loop catalogue and adaptive music engine. The engine moved to `musicEngine.ts`;
`music.ts` retains Vega's existing optional factory and media configuration.
Android supplies one Expo Audio player per source without importing Vega media.
No engine fade, loop or scheduling algorithms changed.

Music Settings uses the canonical default level 7, mute restoration and 3 dB
steps. A single `music.v1` JSON value is saved synchronously before publication;
legacy keys remain readable. Initial mute, gain and Activity state are applied
before the catalogue attaches. Invalid storage is reported without rewriting it
or the game snapshot.

The app owns music across routes. The shared engine selects menu, calm, tense
and critical themes, crossfades them, uses pinned loop points and track gains,
and holds music for 2.5 seconds after a game result. Duplicate home-menu requests
do not cancel that hold. Native voice playback ducks music by 9 dB. Completion,
cancellation and owner disposal restore it; late events from an old voice owner
cannot unduck its successor. Home, background and blur release music players;
returning starts the current theme again. Audio position is not persisted.

## Assets and rights

All four canonical MP3s and the original license are packaged offline. The
asset generator verifies the original tracks, manifest and license against
`native/music/music.json`. MP3 and license bytes, including embedded metadata,
remain unchanged. The manifest is also referenced as a bundled JSON module.
About includes the canonical pepka-prygni attribution.

The existing permission covers this same Dice Chess game/repository; this port
adds no new product or general reuse permission. Keep the original music notice
with internal APK handoffs. No tracks, dependencies or lockfiles are changed.

## Reproduce

Build and install the standalone ARM64 APK as described in README, then run
from the repository root:

```sh
mise exec -- python3 android-probe/scripts/music-smoke.py \
  --serial <serial> --output android-probe/build/music
mise exec -- python3 android-probe/scripts/voices-smoke.py \
  --serial <serial> --output android-probe/build/music-voices
mise exec -- python3 android-probe/scripts/settings-smoke.py \
  --serial <serial> --output android-probe/build/music-effects
mise exec -- python3 android-probe/scripts/settings-burst-smoke.py \
  --serial <serial> --output android-probe/build/music-burst
mise exec -- python3 android-probe/scripts/about-smoke.py \
  --serial <serial> --output android-probe/build/music-about
```

Add `--adb <path>` when needed. Run these suites sequentially. They keep app
data, replace disposable probe games through normal confirmation UI and inject
no rolls, positions, preferences or saved games. The music suite leaves Music
enabled at level 4. Evidence comes from native decoder, gain and release events;
it is not a human listening assessment.

## Automated validation: October 31, 2026

- Android typecheck/lint and all 73 tests passed. New tests cover adapter
  metadata, gain, seeking, decoder events, deferred initialization and release,
  atomic preferences and failed writes, result-hold routing and speech ownership.
- `mise run check` passed: 337 core, 739 native and 13 browser tests, types,
  lint, formatting, Metro and browser builds. Existing music tests exercise the
  extracted engine through Vega's unchanged factory API.
- Native typecheck and all 739 tests passed in the clean CI fixture without
  Android dependencies, including mounted Android Settings and host regressions.
  All remote smoke helpers now use eight Settings rows; About expects four credits.
- The 61 shared music/app tests passed with LCOV coverage: the extracted
  `musicEngine.ts` has 98.65% line coverage in that focused run.
- ARM64 Android and all configured Vega architectures built successfully.
  All four MP3s and the original license matched their pinned bytes in the APK.
  APK SHA-256: `11f60d29fd7fadd08b40f15145b13d3b2970d9b28e3ebd90b06f71f5af0ee0f1`.

## Emulator observations

On DiceChessTVProbe (Android TV API 31, ARM64), the music smoke passed all four
groups: menu/calm native playback; mute and remembered level surviving force-stop;
exact friend rolled-turn recovery; tutorial speech ducking and exit restoration;
Home release and foreground theme restart; exact bot rolled-turn recovery; and
the result-jingle pause surviving immediate return home. These are real remote
D-pad/OK/Back/Home transitions. The final measured result gap was 2,557 ms.
The eight Settings rows fit on screen.

On the final APK, Voices passed five groups, Sounds passed four, rapid Settings
input passed one and About passed five: 19 groups across the five suites.
The rapid-input run preserved Music and Voices across restart. About now reports
four credit cards, and its friend/bot runs preserved every field of real
partially played turns through exit and process death. Settings, resumed gameplay
and the full About credit layout were visually inspected. Other adjusted
gameplay/settings suites were not all rerun in this slice.

Tense/critical selection, loop scheduling and failure recovery are covered by
shared automated tests and pinned asset checks; those two themes and complete
loop seams were not exercised by this emulator scenario. Physical-device
playback, human listening, audio focus interruptions without an Activity change,
prolonged audio stress, held keys and accessibility remain separate qualification.
Vega runtime was not exercised in this slice.

Local evidence is ignored under `android-probe/build/music-smoke/` and the
corresponding `music-voices`, `music-effects`, `music-burst` and `music-about`
folders. See their JSON event streams, screenshots and logcat output.
