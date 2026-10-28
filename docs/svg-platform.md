# SVG platform boundary

The 12 piece components and three fallback faces import `react-native-svg`.
Their generators emit the same standard import. Geometry, colors, transforms,
view boxes and the size-based piece memoization are unchanged.

## Platform resolution

- Vega: `native/babel.config.js` maps the exact `react-native-svg` module name to
  `@amazon-devices/react-native-svg` with `babel-plugin-module-resolver` 5.0.3.
  The worklets plugin remains last. Both Metro and the Vega package builder
  use this Babel configuration. Native TypeScript paths point to the installed
  Vega SVG package for type checking.
- Browser bench: Vite and TypeScript map the standard import to the existing DOM
  SVG shim. The shim implementation is unchanged.
- Node tests: the test loader maps the standard import to the SVG host-element
  stub. Shared artwork can be bundled without importing a Vega backend.

The resolver is an MIT-licensed development dependency. `@babel/core` is declared
as a direct development dependency for the configuration tests, using the same
version already installed by the build tooling. The packaged SVG backend and
its required notices remain unchanged.

This boundary covers the seven primitives the artwork uses: `Svg`, `G`, `Path`,
`Rect`, `Circle`, `Ellipse` and `Polygon`. Another native target can install its
compatible `react-native-svg` package and consume these components without the
Vega alias. This change does not add that dependency to the isolated Android
probe or establish Android rendering compatibility.

## Validation

The SVG tests check the artwork import graph, the real Vega Babel mapping for
every component, and regeneration of the pieces and faces in a temporary
checkout. Generated and checked-in code must compile identically.

Before and after the import change, all 15 components were rendered through the
Node SVG stub at sizes 48 and 114. All 30 serialized host trees had identical
SHA-256 hashes. This checks element names, props, geometry and size handling;
it is not a native-pixel comparison.

On October 28, 2026, `mise run check` passed: 337 core tests, 734 native tests,
13 browser-bench tests, type checks, lint, formatting, Metro and browser builds.
`mise run build` passed with Vega SDK 0.24.12044, build 59. The installed aarch64
package SHA-256 was
`ab63d83e28858cb17225d3d481cbe704084bf6800d54de3571cedd0933d7f82c`.

On the aarch64 Vega Virtual Device:

- The home-screen PNG before and after installation was byte-for-byte identical,
  including the board's pieces and saved partial-turn position.
- D-pad/OK resumed the game and moved board focus. Back opened the game menu.
- D-pad/OK opened the tutorial and rolled its pawn dice; the board and dice
  rendered their pieces. Back returned home.
- The opponent picker rendered its normal portraits and returned with Back.
  Back from home returned to the launcher.

The virtual-device build contained the portrait pack, so the three SVG fallback
faces were checked through the Node renderer and compilation tests, not observed
on that device. No physical Fire TV or Android rendering check was performed.

The subsequent [Android SVG gallery check](../android-probe/svg-validation.md)
records emulator rendering evidence for all 15 components at both probe sizes.
