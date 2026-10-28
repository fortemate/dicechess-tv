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
channel. `useKeplerBackHandler` handles default exit; the adapter does not issue
an additional `exitApp` call.

## Scope

This prepares shared screens for another platform. It does not add an Android
input adapter, change game rules, or turn the browser bench into a product.
Rendering, assets and worker integration still need their own platform work.

## Validation

Automated tests exercise normalization, subscription cleanup, Back ordering and
fallback, callback updates during a hold, an independent normalized input source,
and the shared hook's import graph. Existing navigation, recovery, tutorial,
lifecycle and input tests exercise the Vega wrapper and isolated screens.

On October 28, 2026, `mise run check` passed: core 337 tests, native 730,
browser bench 13, type checks, lint, formatting, Metro bundle and browser build.
`mise run build` produced the installable Vega packages with SDK 0.24.12044,
build 59. The installed aarch64 package SHA-256 was
`e7da31bdc406d6491e6def33a33281938cf1497b2b7ac5dbfcb1939bbeb16653`.

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
