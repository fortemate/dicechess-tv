# Remote input boundary

`App` obtains one Vega remote bridge and supplies it as `AppEnvironment.remote`.
`GameApp` provides it to all screens, including error recovery. The shared
`useRemoteInput` hook imports no Vega input API. The browser test bench still
uses the Vega wrapper through its existing keyboard shims.

## Contract

- Keep the `RemoteInput` object stable for the lifetime of a mounted app.
- `subscribe` receives normalized directions, `select` and `menu`, with a
  `down` or `up` phase. Forward repeated downs and physical releases even while
  unfocused. The shared hook tracks held directions, confirms OK once on release,
  and cancels an armed OK when its scope or activity changes.
- `subscribeBack` is a separate consuming channel. Newer subscriptions run first;
  a `true` result stops dispatch. If every subscriber returns `false`, the
  platform performs its default Back action. On Vega that closes the app.
- Every subscription returns an idempotent cleanup function. Screen rerenders
  update committed callbacks without changing subscription order.
- Back while inactive is consumed. Back without a custom screen policy is sent
  to its reducer and consumed. The home and recovery screens explicitly decline
  Back when they want the app to exit.

`createRemoteChannel` implements this dispatch contract for platform bridges.
`useVegaRemote` maps Vega actions 0/1 and the three OK names (`select`, `enter`,
`kpenter`). It ignores unknown events and keeps Back out of the observation
channel. [The adapter](../native/src/vegaRemote.ts) registers `channel.back` and
contains no direct `exitApp` call.

The default-exit behavior is based on source inspection of the installed
`@amazon-devices/react-native-kepler` package, version `4.0.1+rn0.83.0`, in
`Libraries/Utilities/KeplerBackHandler.js`. On Back release, that implementation
calls `instance.exitApp()` if no registered handler consumes the event. See also
the repository's [Vega input notes](../site/src/content/docs/technology/vega.md#handling-the-back-button).

The adapter tests use a platform stub to verify consumed/unclaimed Back. The
virtual-device checks below verify the visible return to the launcher; neither
counts calls inside the native SDK. The absence of a direct exit call in our
adapter is established by code inspection, not by device instrumentation.

## Scope

This prepares shared screens for another platform. It does not add an Android
input adapter, change game rules, or turn the browser bench into a product.
The [SVG platform boundary](svg-platform.md) covers vector artwork. Assets and
worker integration still need their own platform work.

## Validation

Automated tests exercise normalization, subscription cleanup, Back ordering and
fallback, callback updates during a hold, an independent normalized input source,
and the shared hook's import graph. Existing navigation, recovery, tutorial,
lifecycle and input tests exercise the Vega wrapper and isolated screens.

On October 28, 2026, `mise run check` passed: core 337 tests, native 730,
browser bench 13, type checks, lint, formatting, Metro bundle and browser build.
After the input-handler cleanup, native checks, lint and all 731 tests passed
again, as did Metro and browser validation. The device checks below were repeated
with the rebuilt package.
`mise run build` produced the installable Vega packages with SDK 0.24.12044,
build 59. The installed aarch64 package SHA-256 was
`5a0226538b3c5f52d5f12fffe9e7751859e32535eed9ac8cc13e0d50abb6c30b`.

On the aarch64 Vega Virtual Device, installed over the existing app:

- Holding OK on Resume game showed pressed feedback without navigating.
  Another down followed by release resumed the saved partial turn.
- Left/right moved board focus; Back canceled selection and opened the game menu.
- D-pad/OK opened Learn to play. Holding OK, leaving with Back, then releasing
  OK left the home screen open without activating Resume game.
- Four consecutive Down events without release reached Rules reference.
  Up/down navigated topics, and Menu returned from the guide.
- Home opened the launcher. Relaunching restored the saved position and
  D-pad/OK opened Settings. Back returned home; another Back opened the launcher.

This is virtual-device evidence, not a physical Fire TV check. Automated tests
cover blur-only activity gating and callback ordering. The Home/relaunch check
does not establish a warm resume in the same process. No Android adapter was
added or tested in this change.
