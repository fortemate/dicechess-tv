# Storage and startup boundary

The Vega entry point still mounts `App`, with the same bot worker factory.
`App` now supplies an `AppEnvironment` to `GameApp`: synchronous storage,
application state/focus events, and the fully-drawn reporter. It obtains the
same Vega hooks in the same React root. The browser test bench continues to
use this wrapper through its existing shims.

`GameApp` owns game restoration, settings, the result ledger, recovery and
activity gating. `KeyValueSnapshotStore` implements the snapshot operations
against an explicitly supplied `KeyValueStore`; `MmkvSnapshotStore` remains
available as the Vega adapter for standalone callers. Settings import the
storage contract without importing the MMKV adapter.

## Adapter contract

- Every `openStorage()` handle must address the same persistent namespace.
  Reads and writes are synchronous: the first screen contains the saved game
  and settings, with no loading frame that could swallow remote input.
- Keep service identities stable while the app is mounted. Changing a storage
  namespace requires a new mount, so restored state and future writes cannot
  refer to different namespaces.
- Forward `change`, `blur` and `focus` events. Background/inactive suspends the
  game; blur suspends it even while active. Focus alone resumes it, including
  after Vega replaces its surface on return from Home. An unknown launch state
  is treated as foreground, matching the existing Fire TV behavior.
- Return removable subscriptions. The app unsubscribes and pauses its activity
  and audio on unmount.
- Supply a fully-drawn reporter, or a no-op on platforms without that metric.
  The initial commit and return from background report readiness; an ordinary
  focus change does not count as a background return.

The Vega adapter still opens default MMKV instances. Game key
`dicechess-tv.game.v2`, ledger key `dicechess-tv.ledger.v1`, the damaged-ledger
copy, all settings keys, codecs and serialized formats are unchanged. No data
migration or storage namespace change is required.

## Scope

This is one preparation step toward sharing the application. The [audio services boundary](audio-services.md) supplies factories and the
catalog loader through the environment. Remote input, rendering and other
screen dependencies still use Vega APIs; `GameApp` is not yet an Android-ready
entry point. The Android probe remains isolated. Android audio adapters and
workspace extraction follow separately.

## Validation

The startup tests inject independent in-memory storage and lifecycle services.
They check partial-turn restoration on the first screen, settings persistence,
new-game saves across remounts, input suspension, focus-only resume, readiness
reporting and subscription cleanup. The existing Vega-wrapper tests continue
to cover corrupted saves, damaged-ledger retention, recovery and lifecycle
sequences.

On October 28, 2026, `mise run check` passed: core 337 tests, native 714,
browser bench 13, type checks, lint, formatting, Metro bundle and browser build.
`mise run build` produced the installable Vega packages using SDK 0.24.12044
and the existing build number 59. The installed aarch64 package SHA-256 was
`e946ecc7fbb167f046735194694029360ac9d8a2648d34e6ca141e706c9828ad`.

On the aarch64 Vega Virtual Device, installed over the existing app without
clearing its data:

- The existing saved game opened with Resume game, and OK resumed it.
- D-pad and OK played `e2e4` from a knight/pawn/king roll. Turn 1 remained in
  progress with the pawn die spent and the knight and king dice available.
- Home opened the launcher. Launching the app again and selecting Resume game
  restored that position and the same spent/available dice.
- Force-stopping and relaunching restored the same partial turn. Back opened
  the game menu, and D-pad/OK opened Settings.
- Turn board for friends changed from off to on. After a force-stop/relaunch,
  Settings still showed on. It was returned to off after the check.

This is virtual-device evidence. A physical Fire TV Stick and human audio
listening were not checked in this change. Blur-only overlay behavior and
fully-drawn reporting were exercised by automated tests, not asserted from
screenshots. The virtual-device launcher recreated the screen on return, so
that run does not independently establish a warm resume in the same process.
