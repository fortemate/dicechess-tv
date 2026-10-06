# Contributing

Branches, pull requests and issues follow the organization's
[contributing guide](https://github.com/fortemate/.github/blob/main/CONTRIBUTING.md).
This file adds what is specific to a Fire TV application.

The code is licensed under AGPL-3.0-only (see [Licensing](README.md#licensing)).
Before a first pull request can be accepted, sign the
[Contributor License Agreement](CLA.md): add yourself to
[`.github/cla-signatures.json`](.github/cla-signatures.json) in that pull request,
and the `CI: CLA` check verifies it. Owners, organization members, collaborators
and bots are exempt.

## Setup

- Tools from [`mise.toml`](mise.toml): `mise install`, then `mise run setup`. That
  runs `npm ci` at the root and in `native/`, and registers the Git hooks. Every
  dependency, Amazon's `@amazon-devices/*` packages and the Dice Chess engine
  included, comes from the public npm registry, so no token is needed.
- The hooks ([`lefthook.yml`](lefthook.yml)) scan each commit for secrets and for
  Cyrillic text, format the staged files with Prettier and lint changed workflows;
  a push first checks the formatting of the whole repository. This repository is
  public and its history is never rewritten, so these run before the commit rather
  than only in CI. Do not bypass them with `--no-verify`.
- Building and running the application also needs the **Vega SDK 0.24** and a Vega
  Virtual Device or a Fire TV Stick in developer mode. The SDK is licensed to each
  developer by Amazon and is deliberately not in this repository;
  [native/README.md](native/README.md#building-and-running) has the commands.

## Amazon's tools for coding agents

[`.mcp.json`](.mcp.json) registers Amazon Devices Builder Tools, Amazon's MCP
server for Vega, for every Claude Code session opened in this repository or one of
its worktrees; Claude Code asks once before starting it. It gives an agent Amazon's
Vega documentation, and tools that read performance traces
(`analyze_perfetto_traces`, `get_app_hot_functions`) and crash reports
(`symbolicate_acr`).

- The version is pinned. Amazon's installer writes `@latest`, which would fetch
  and run new, unreviewed code at every start. Bump the pin on purpose, after
  reading what changed.
- It has no telemetry switch of its own. It follows `optIn` in
  `~/vega/telemetry/config.json`, the Vega SDK setting the Vega CLI reads too;
  `false` opts both out.
- Its documentation search sends the query to Amazon, so keep private values out
  of it (see the publication boundary in [AGENTS.md](AGENTS.md)).
- Amazon's agent skills are not committed: the package is `UNLICENSED`, Amazon's
  own content. Its installer puts them in `~/.claude/skills`:

  ```bash
  npx -y @amazon-devices/amazon-devices-buildertools-mcp@1.0.13 init-context --agent claude-code-cli --skip-context-document
  ```

  It cannot install the skills alone: it also registers the server, at `@latest`,
  for every project in `~/.claude.json`. Remove that entry afterwards, so the pin
  here is the only registration:
  `claude mcp remove -s user amazon-devices-buildertools-mcp`.

## Checks

CI runs these on every pull request. Run them before pushing:

| Where  | Command                         | What it proves                                                        |
| ------ | ------------------------------- | --------------------------------------------------------------------- |
| root   | `npm run check`                 | Types, and that `src/core/` uses no DOM or Node global                |
| root   | `npm run lint`                  | ESLint with typescript-eslint's recommended rules                     |
| root   | `npm run format:check`          | Prettier formatting                                                   |
| root   | `npm test`                      | The shared core against the real engine                               |
| native | `npm run check --prefix native` | Types of the application, its tests and the core together             |
| native | `npm run lint --prefix native`  | ESLint with React's hooks rules and Amazon's Vega rules               |
| native | `npm test --prefix native`      | Screens, input and sound, rendered with `react-test-renderer`         |
| root   | `npm run coverage`              | Both packages' tests with coverage, which CI sends to SonarQube Cloud |
| native | `npm run build --prefix native` | The installable package. It needs the Vega SDK, so CI does not run it |
| site   | `npm run build --prefix site`   | The project site, after `npm ci --prefix site`; see below             |

`mise run check` runs all of them except the build, and `mise tasks` lists every
task with what it does. The SonarQube Cloud analysis
that CI runs with that coverage is informational: it does not fail the build.

## Check it on a device

A green gate is not evidence that the television shows the right thing: a
first-render fault that swallowed every key press once passed every check. For
anything that changes what the screen shows or how the remote works, build the
package, install it and use it:

```bash
mise run portraits      # the characters' portraits, with access to dicechess-assets
mise run device:start   # the Vega Virtual Device, if it is not running
mise run device:run     # build, install and launch
```

`mise run portraits` needs a checkout of the private asset repository next to this
one (or `ASSETS_DIR`). Without the portraits the game shows emoji faces in their
place; see "Portraits" in [native/README.md](native/README.md).

The build takes the latest beta's build number. A build numbered like the installed beta
installs over it and keeps its saved game, as one did over beta 6 on the Vega Virtual
Device. The device refuses a lower number with "Package version decrease".
`BUILD_NUMBER=8 mise run device:run` sets the number by hand.

On the virtual device the Mac keyboard stands in for the remote: arrow keys for
the D-pad, Enter for OK, Esc for Back, F1 for Home. The on-screen remote's OK
button works too.

From a script, or for a coding agent, use
[vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver): `vvd press`
presses the remote's keys and `vvd screenshot` saves the screen, after
`vvd enable-grpc` once per start of the device.
[native/README.md](native/README.md#checking-from-a-script) shows a session and
what it checked.

Without the task, `npm run build --prefix native` builds with number 0, which the device
refuses over beta 4 or later. Add `-- --build-number <n>` with the latest beta's number.
`mise run build` falls back to 0 only when it finds no beta tag. Removing the app instead
deletes its saved game.

Say in the pull request which kind of evidence a claim rests on — the virtual
device, a Fire TV Stick, or a test — because they are not interchangeable.

## Generated and vendored files

Never edit these by hand. Change the script, rerun it, and commit what it writes:

| Path                                                                   | Written by                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `native/src/pieces/*.tsx`                                              | `native/scripts/generate-pieces.mjs`, from `src/assets/pieces/rhosgfx/`        |
| `native/sounds/`, `native/src/cueFiles.ts`                             | `native/scripts/vendor-sounds.mjs`, from one pinned commit of dicechess-assets |
| `native/voices/`, `native/src/voiceFiles.ts`, `src/core/hostPacing.ts` | `native/scripts/vendor-voices.mjs`, from one pinned commit of dicechess-assets |
| `site/public/voices/`, `site/src/voices/audition.json`                 | `site/scripts/vendor-voices.mjs`, from one pinned commit of dicechess-assets   |
| `native/assets/` (not committed)                                       | `native/scripts/generate-assets.mjs`, which every build runs                   |

Third-party files — the RhosGFX pieces, the brand images in `native/brand/`, the
vendored sounds and the licence texts in `licenses/` — are kept byte for byte, and
`.gitattributes` stops Git from rewriting their line endings. A new asset needs its
licence recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and, when the
licence asks for credit, a line on the About screen (`src/core/credits.ts`).

## The voices

Four voice packs are vendored from fortemate/dicechess-assets, which keeps them for
every client: the bots', one for each Hot Seat host, Rolly (#202) and Prowla
(#258), and the tutorial's, which Thinkle the wizard teaches (#264).

The bots' lines are written here, in `src/core/botVoice.ts`, and their voices are
synthesized from those lines in dicechess-assets. Whenever a line changes, commit
it, export the catalogue, and have the pack synthesized again there before it is
vendored here:

```bash
npm run -s voices:catalogue > catalogue.json
```

`-s` keeps npm's own header out of the JSON. The document names the commit its
lines come from; an export taken while `src/core/botVoice.ts` has changes that are
not committed is marked `dirty`, because no commit holds its texts.

The hosts' lines go the other way: they are written in dicechess-assets (the
`catalogue.json` of `voices/elevenlabs-dicechess-host` and of
`voices/elevenlabs-dicechess-host-prowla`) and copied word for word into
`src/core/hostScripts.ts`, so `native/test/vendoredVoices.test.ts` fails when the two
drift apart. So do Thinkle's tutorial lines: they are written in
`voices/elevenlabs-dicechess-tutorial-thinkle/catalogue.json` and copied into
`src/core/tutorial.ts`, where each point of a lesson says its lines in order, as
clips `thinkle_tutor_<lesson>_<point>_<n>`. When and how often the host speaks comes from `voices/events.json` in
dicechess-assets, which the vendor script copies beside the packs and turns into
`src/core/hostPacing.ts`; never edit that file, change `events.json` there and
vendor it again.

## Releases

A release is cut by the owner, on a machine with the Vega SDK; CI cannot build the
package. The version lives in `native/manifest.toml`, because that is what the
device installs and what the store sees, so a release starts with a pull request
that bumps it. After that merges:

```bash
git switch main && git pull --ff-only
npm ci && npm ci --prefix native && npm run build --prefix native
version=$(grep -m1 '^version = ' native/manifest.toml | sed 's/.*"\(.*\)".*/\1/')
if git ls-remote --exit-code --tags origin "refs/tags/v$version" >/dev/null; then
  echo "v$version already exists: bump the version in native/manifest.toml first"
else
  gh release create "v$version" native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg --target main --generate-notes
fi
```

The tag check matters: `gh release create` would attach a new package to an
existing tag that points at older code. The notes are grouped by the labels in
`.github/release.yml`.

## The project site

`site/` is the public site, <https://dicechess-tv.jegors-cemisovs.workers.dev/>, built
with Astro Starlight. Its workflow builds every pull request that touches it and
deploys it from `main`. [site/README.md](site/README.md) explains how to run it
and add a page.

## What the platform does

[native/README.md](native/README.md) is the record of how Vega actually behaves —
remote input, saving, randomness, sound, icon and splash — each finding measured on
a device, with what was tried and failed. Something new learned about the platform
goes there, with how it was measured.
