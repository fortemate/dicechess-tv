# Dice Chess 1.0.3, build 34

## Changes

- Use consistent American English across the app, VoiceView announcements, website and documentation. Recorded audio and its original transcripts are preserved; pronunciation-equivalent captions use U.S. spelling. ([#433](https://github.com/fortemate/dicechess-tv/pull/433))
- Fix the intermittent Thinkle caption integration test and cover all five greetings deterministically. ([#434](https://github.com/fortemate/dicechess-tv/pull/434))
- Include the pinned character portraits in the source repository and GitHub packages: Rolly, Grabby, Rampage, Prowla and Thinkle, plus Thinkle's illustrated launch splash. A normal clone no longer needs a separate portrait-vendoring step. The original notice, provenance and restricted asset license are preserved.

Game rules, opponents, saved-data formats and recorded audio are unchanged.

## Downloads

| File                               | Target                                    |
| ---------------------------------- | ----------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | Physical Fire TV Stick running Vega OS    |
| `dicechess-tv-native_aarch64.vpkg` | Vega Virtual Device on Apple silicon      |
| `dicechess-tv-native_x86_64.vpkg`  | Vega Virtual Device on Linux or Intel Mac |

All three packages include the ten runtime portrait images. The portrait notice permits Fortemate's Dice Chess applications and their source repositories; it grants no reuse rights to forks. Other assets keep their existing licenses.

Check the packages against `SHA256SUMS.txt` before installing:

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

Install the package for your device's processor over the existing app to keep its saved game, results and settings. Removing the app deletes those data.

## Validation

The en-US application code was installed on a physical Fire TV Stick from main `471cc1f`, as version 1.0.2/build 33. Installed JavaScript and Hermes hashes matched the archive, saved data and CRC remained byte-identical, and no new crash record appeared during launch. The owner then reported that the app appeared to work.

The new version and packaging checks are recorded in the [release preparation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-preparation-1.0.3-build34.md). That record distinguishes candidate-package validation from the earlier physical check. Physical VoiceView listening and a new sustained-gameplay run are not claimed. This GitHub release makes no claim about Amazon Appstore approval or availability.
