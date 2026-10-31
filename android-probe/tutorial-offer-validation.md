# Android TV first-launch tutorial offer validation

Android now shows Vega's Thinkle offer before home on a new profile. It reuses
`TutorialOffer`, `Teacher`, `Board`, `screenReducer`, the existing local voice
clips and `tutorialOfferSetting`. The offer's in-memory board has no game store,
bot worker, dice rolls or gameplay timers. Learn to play is selected first.
Directions wrap between Learn to play and Skip; OK chooses; Back answers Skip
and returns home without closing the app.

The answer is written synchronously to the Android settings namespace before
the route changes. A second press before React commits cannot answer again.
A failed write leaves the offer retryable. An unanswered offer is shown again
after process restart, with Learn to play selected.

Eligibility checks presence without decoding or rewriting the current and both
legacy game slots. Any retained game data, including unreadable data, suppresses
the offer. The explicit-reset marker also suppresses it. Failed startup reads
never classify existing data as a new install. Engineering diagnostic links
bypass the offer. Learn to play remains available from home after either answer.

## Reproduce

Build the standalone ARM64 APK using README's instructions. For the update check,
keep the previous APK installed with a real saved partial turn. From the root:

```sh
mise exec -- python3 android-probe/scripts/tutorial-offer-smoke.py \
  --phase prepare-upgrade --serial <upgrade-serial> \
  --output android-probe/build/tutorial-offer
adb -s <upgrade-serial> install -r \
  android-probe/android/app/build/outputs/apk/release/app-release.apk
mise exec -- python3 android-probe/scripts/tutorial-offer-smoke.py \
  --phase upgrade --serial <upgrade-serial> \
  --output android-probe/build/tutorial-offer
```

The first phase reads a real current game and all preferences through the UI.
The second compares every game field and preference after updating, opening
and leaving manual lessons, and restarting. It never clears this profile.

Use a separate Android TV API 31 ARM64 AVD named `DiceChessTVOnboarding` for the
clean-install check. For example, with the SDK image already installed:

```sh
avdmanager create avd --name DiceChessTVOnboarding \
  --package 'system-images;android-31;android-tv;arm64-v8a' --device tv_1080p
emulator -avd DiceChessTVOnboarding -port 5558 -no-snapshot
```

After it boots, install the new APK and run:

```sh
adb -s emulator-5558 install -r \
  android-probe/android/app/build/outputs/apk/release/app-release.apk
mise exec -- python3 android-probe/scripts/tutorial-offer-smoke.py \
  --phase fresh --serial emulator-5558 \
  --output android-probe/build/tutorial-offer-fresh
```

Add `--adb <path>` if needed. The fresh phase deliberately clears only the
probe app's data on that dedicated AVD between answer scenarios. It refuses
to clear an AVD with another name. No game snapshots, preferences, rolls or
tutorial positions are injected. The existing gameplay smoke scripts expect
home to be available; answer this offer once before running them on a new
ordinary profile. The diagnostics smoke uses its explicit engineering link.

## Automated checks: October 31, 2026

- `mise run check` passed: 337 core, 751 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build.
- Android types/lint and all 76 existing tests passed.
- Eight new mounted Android tests cover the initial presentation, unanswered
  relaunch, all three answers, rapid navigation/duplicate OK before React
  commits, current/corrupt/legacy data, explicit reset, disabled onboarding,
  background input gating and failed reads/writes.
  The disabled case mounts `FirstLaunch` with `enabled={false}`; it does not
  exercise the diagnostics URL handler or `App` route wiring.
- Native types and all 14 mounted Android regressions passed in the clean
  native CI fixture without Android dependencies. The new suite generated LCOV
  and its path is included in `sonar.javascript.lcov.reportPaths`.
- Android ARM64 and all configured Vega architectures built successfully.
  Installed APK SHA-256:
  `92b986d7f101a094cb66fa7116f2c01d9362cbe17dd9aa26f36965a51247a94c`.

## Android TV emulator observations

All five update/clean-profile groups passed on Android TV API 31 ARM64:

1. An existing DiceChessTVProbe profile upgraded from the Recovery APK without
   a prior tutorial-offer answer. It bypassed onboarding and retained the exact
   real partial turn, including spent dice, and every preference. Manual lessons
   and subsequent process restarts retained that same game.
2. A clean DiceChessTVOnboarding profile showed Thinkle's portrait, caption and
   both choices before home. Both offer clips reached decoder completion.
   Home/return retained working remote control. An unanswered process restart
   showed the offer again at the initial choice.
3. OK on Learn to play opened lesson one. Back returned home without creating a
   real game save. Restart opened home without offering again; manual learning
   remained available. The offer's speech service was disposed on transition.
4. D-pad/OK on Skip returned home. The answer remained effective after restart.
5. Back returned home in the same process, and its answer survived restart.

The fresh native UI dump and screenshot were inspected. Storage failures and
unreadable/legacy-save eligibility have mounted-test evidence, not injected
emulator data. Player events establish automated playback/completion, not human
listening quality. Physical remotes, held keys, TalkBack and Vega runtime were
not qualified by this change.

Evidence is ignored under `android-probe/build/tutorial-offer/` and
`android-probe/build/tutorial-offer-fresh/`. The temporary onboarding AVD was
separate from the existing saved-game profile.
