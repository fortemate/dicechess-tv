# Contributing

Branches, pull requests and issues follow the organization's
[contributing guide](https://github.com/fortemate/.github/blob/main/CONTRIBUTING.md).
This file adds what is specific to a Fire TV application. The repository licence
has not been selected yet (see [Licensing](README.md#licensing)), so there is no
CLA here, and changes come from the Fortemate team.

## Setup

- Node from [`mise.toml`](mise.toml): `mise install`.
- `npm ci` at the root, then `npm ci --prefix native`. Every dependency, Amazon's
  `@amazon-devices/*` packages and the Dice Chess engine included, comes from the
  public npm registry, so no token is needed.
- Building and running the application also needs the **Vega SDK 0.24** and a Vega
  Virtual Device or a Fire TV Stick in developer mode. The SDK is licensed to each
  developer by Amazon and is deliberately not in this repository;
  [native/README.md](native/README.md#building-and-running) has the commands.

## Checks

CI runs these on every pull request. Run them before pushing:

| Where  | Command                         | What it proves                                                     |
| ------ | ------------------------------- | ------------------------------------------------------------------ |
| root   | `npm run check`                 | Types, and that `src/core/` uses no DOM or Node global             |
| root   | `npm run lint`                  | ESLint with typescript-eslint's recommended rules                  |
| root   | `npm run format:check`          | Prettier formatting                                                |
| root   | `npm test`                      | The shared core against the real engine                            |
| native | `npm run check --prefix native` | Types of the application, its tests and the core together          |
| native | `npm run lint --prefix native`  | ESLint with React's hooks rules and Amazon's Vega rules            |
| native | `npm test --prefix native`      | Screens, input and sound, rendered with `react-test-renderer`      |
| native | `npm run build --prefix native` | The installable package; it needs the SDK, which one CI runner has |

`mise run check` runs the four root checks in one go.

## Check it on a device

A green gate is not evidence that the television shows the right thing: a
first-render fault that swallowed every key press once passed every check. For
anything that changes what the screen shows or how the remote works, build the
package, install it and use it. On the virtual device the Mac keyboard stands in
for the remote: arrow keys for the D-pad, Enter for OK, Esc for Back, F1 for Home.

Say in the pull request which kind of evidence a claim rests on — the virtual
device, a Fire TV Stick, or a test — because they are not interchangeable.

## Generated and vendored files

Never edit these by hand. Change the script, rerun it, and commit what it writes:

| Path                                       | Written by                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `native/src/pieces/*.tsx`                  | `native/scripts/generate-pieces.mjs`, from `src/assets/pieces/rhosgfx/`        |
| `native/sounds/`, `native/src/cueFiles.ts` | `native/scripts/vendor-sounds.mjs`, from one pinned commit of dicechess-assets |
| `native/assets/` (not committed)           | `native/scripts/generate-assets.mjs`, which every build runs                   |

Third-party files — the RhosGFX pieces, the brand images in `native/brand/`, the
vendored sounds and the licence texts in `licenses/` — are kept byte for byte, and
`.gitattributes` stops Git from rewriting their line endings. A new asset needs its
licence recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and, when the
licence asks for credit, a line on the About screen (`src/core/credits.ts`).

## What the platform does

[native/README.md](native/README.md) is the record of how Vega actually behaves —
remote input, saving, randomness, sound, icon and splash — each finding measured on
a device, with what was tried and failed. Something new learned about the platform
goes there, with how it was measured.
