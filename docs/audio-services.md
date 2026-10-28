# Audio services boundary

`App` supplies `vegaAudio` through `AppEnvironment.audio`. `GameApp` asks that
service to create sounds and music and read the music catalog. Another platform
can implement these factories without importing Vega's media player.

The contracts in `native/src/audio.ts` describe effects, spoken lines, music,
the catalog and initial settings. `speechTiming.ts` supplies the existing voice
metadata and presentation estimates without loading a player. Screens and
`lateAudio` import those modules directly. `sound.ts` and `music.ts` retain
compatibility type exports, and `sound.ts` re-exports the timing helpers for
existing callers.

## Preserved behavior

- Players are created after the first React commit, music first so speech can
  duck it. The initial frame already contains a usable screen.
- Stable late-bound handles retain settings, the requested music role and the
  current tutorial line until the service attaches. Early effect cues are
  discarded rather than replayed.
- Sounds receive saved effects/voice gains, mute state and foreground state at
  creation. Music receives its saved settings before the catalog can start it.
- Blur, background and inactive suspend playback; focus resumes it. Unmount
  detaches and disposes the app-owned players. Explicitly injected test players
  retain their existing caller-owned lifetime.
- Catalog loading resolves null when music is absent or unreadable. Completion
  after unmount is ignored. Diagnostics use the latest `onState` callback without
  recreating players.
- Voice completion still follows the decoder's ended event and tail; the
  presentation timing helper does not replace completion callbacks.

The Vega player implementations, file paths, channel allocation, initialization,
seeking, crossfades, speech cancellation and foreground teardown are unchanged.
No new media or dependencies are added. The browser test bench continues to use
its existing media shims; this does not add browser music or Android playback.

## Adapter expectations

Keep the services object stable for a mounted app. Factories must honor the
shared contracts, including initial suspension and voice completion/cancellation.
They return app-owned instances that remain inert after disposal. Implement
`loadCatalogue()` so failures resolve null instead of rejecting. Each platform
owns its file resolution and media APIs; the existing relative catalog filenames
are resolved by its music implementation.

## Validation

The audio-services tests supply independent recording services and check first
commit timing, creation order, stored gains, settings updates, music ducking,
the first tutorial line, background launch, focus/blur, cleanup, diagnostic
callback changes, absent/present catalogs and late completion. A bundled import
graph test ensures `GameApp` and its screens do not load `sound.ts`, `music.ts`,
`vegaAudio.ts` or the Vega media module transitively. Other Vega dependencies
remain outside this audio extraction.

On October 28, 2026, the required checks passed: 337 core tests, 725 native
tests, 13 browser tests, type checks, lint, formatting, Metro bundle, browser
build and the installable Vega build (SDK 0.24.12044, existing build number 59).
The installed aarch64 package SHA-256 was
`e78e589c19fe54aa2115d449e454a556091dc0867995c349aeaf33421e7d2cb9`.

On the aarch64 Vega Virtual Device, installed over the existing app:

- The saved board and Resume game appeared. D-pad, OK and Back navigated to
  Settings and Learn to play. The tutorial opened and accepted the roll action.
- Music was available at the saved volume 7. A recording of its output contained
  nonzero samples before Home and zero samples in seconds 6 through 11 after
  Home opened the launcher. Launching the app again restored music output.
- OK toggled music off and back on. A separate 14-second recording contained
  output initially, zero samples in seconds 6 through 8 while muted, and output
  again by second 10 after unmuting. The setting was left at its original value.
- A tutorial recording was retained locally for listening review. It is not
  evidence of human acceptance of speech quality, timing or music balance.

Recordings are in the ignored `native/build/audio-validation/` directory.
These checks establish virtual-device behavior and captured output, not physical
Fire TV behavior or a human listening assessment. Voice completion, cancellation,
ducking and first-frame ordering also remain covered by automated tests.
