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
  runs `npm ci` at the root, in `native/` and in `web/`, and registers the Git
  hooks. Every dependency, Amazon's `@amazon-devices/*` packages and the Dice
  Chess engine included, comes from the public npm registry, so no token is
  needed.
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

| Where  | Command                          | What it proves                                                                 |
| ------ | -------------------------------- | ------------------------------------------------------------------------------ |
| root   | `git diff --check`               | No trailing whitespace or conflict markers; CI checks what a pull request adds |
| root   | `npm run check`                  | Types, and that `src/core/` uses no DOM or Node global                         |
| root   | `npm run lint`                   | ESLint with typescript-eslint's recommended rules, over the bench's code too   |
| root   | `npm run format:check`           | Prettier formatting                                                            |
| root   | `npm test`                       | The shared core against the real engine                                        |
| native | `npm run check --prefix native`  | Types of the application, its tests and the core together                      |
| native | `npm run lint --prefix native`   | ESLint with React's hooks rules and Amazon's Vega rules                        |
| native | `npm test --prefix native`       | Screens, input and sound, rendered with `react-test-renderer`                  |
| native | `npm run bundle --prefix native` | Metro bundles the app and the core without the Vega SDK; the notices match it  |
| web    | `npm test --prefix web`          | The browser test bench's own tests                                             |
| web    | `npm run build --prefix web`     | The test bench typechecks and builds                                           |
| root   | `npm run coverage`               | Both packages' tests with coverage, which CI sends to SonarQube Cloud          |
| native | `npm run build --prefix native`  | The installable package. It needs the Vega SDK, so CI does not run it          |
| site   | `npm run build --prefix site`    | The project site, after `npm ci --prefix site`; see below                      |

`mise run check` runs all of them except the coverage, the build and the site, and
`mise tasks` lists every task with what it does. Locally it checks the whitespace
of uncommitted changes to tracked files; Git does not see a new file until it is
staged or marked with `git add -N`. The SonarQube Cloud analysis
that CI runs with that coverage is informational: it does not fail the build.

## Check it on a device

A green gate is not evidence that the television shows the right thing: a
first-render fault that swallowed every key press once passed every check. For
anything that changes what the screen shows or how the remote works, build the
package, install it and use it:

```bash
mise run device:start   # the Vega Virtual Device, if it is not running
mise run device:run     # build, install and launch
```

The build takes the highest build number among the beta and release tags (see
[Releases](#releases)) and prints it with its tag. A build numbered like the installed
beta or release installs over it and keeps its saved game, as one did over beta 6 on the
Vega Virtual Device. The device refuses a lower number with "Package version decrease".
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
refuses over beta 4 or later. Add `-- --build-number <n>` with the number of the latest
beta or release. `mise run build` falls back to 0 only when it finds no numbered tag.
Removing the app instead deletes its saved game.

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
| `native/licenses/THIRD_PARTY_NOTICES.txt`                              | `native/scripts/notices.mjs`, from the source map `npm run bundle` writes      |

Third-party files — the RhosGFX pieces, the brand images in `native/brand/`, the
vendored sounds and the licence texts in `licenses/` — are kept byte for byte, and
`.gitattributes` stops Git from rewriting their line endings. A new asset needs its
licence recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and, when the
licence asks for credit, a line on the About screen (`src/core/credits.ts`).

The package carries the notices of every npm package in the bundle (#338). When a
dependency change brings a package in or takes one out, `npm run bundle --prefix
native` fails and says which, and `mise run build` does for the Vega build's own
bundle. Rewrite the notices with `npm run notices --prefix native`, read the diff,
and name the package in THIRD_PARTY_NOTICES.md and on the site's Credits and
licences page, which `test/credits.test.ts` checks.

## The voices

Five voice packs are vendored from fortemate/dicechess-assets, which keeps them for
every client: the bots', one for each Hot Seat host, Prowla (#258), Rolly (#202)
and Thinkle (#279), and the tutorial's, which Thinkle the wizard teaches (#264).

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
`catalogue.json` of `voices/elevenlabs-dicechess-host`, of
`voices/elevenlabs-dicechess-host-prowla` and of
`voices/elevenlabs-dicechess-host-thinkle`) and copied word for word into
`src/core/hostScripts.ts`, so `native/test/vendoredVoices.test.ts` fails when the two
drift apart. So do Thinkle's tutorial lines: they are written in
`voices/elevenlabs-dicechess-tutorial-thinkle/catalogue.json` and copied into
`src/core/tutorial.ts`, where each point of a lesson says its lines in order, as
clips `thinkle_tutor_<lesson>_<point>_<n>`. When and how often the host speaks comes from `voices/events.json` in
dicechess-assets, which the vendor script copies beside the packs and turns into
`src/core/hostPacing.ts`; never edit that file, change `events.json` there and
vendor it again.

## Releases

A release is cut by the owner, on a machine with the Vega SDK and the private
portraits; CI cannot build the package. An agent may prepare a release, but never
tags, publishes or uploads one.

### Version and build number

A package carries two numbers, and the Appstore wants both to rise from one submission
to the next ([Version Your App](https://developer.amazon.com/docs/vega/0.24/app-version.html)):

- **The version**, such as `1.0.0`, is `version` in `[package]` of
  [`native/manifest.toml`](native/manifest.toml), so a release starts with a pull
  request that raises it. The build copies it into the package's
  `meta-info/build-info.json`. Amazon's page sets it with
  `react-native build-vega --build-version` instead. That flag wins over the manifest
  but leaves the manifest inside the package as it was, so do not pass it: the manifest
  stays the one place the version lives.
- **The build number** is a whole number the build takes as `--build-number`. A device
  refuses a package numbered lower than the one installed, with "Package version
  decrease".

Build numbers rise across betas and releases together, never per version: beta 24 was
build 24, 1.0.0 is build 25, and the next beta is 26 or higher, whatever its version.
Every tag carries its build number, so that `mise run build` can number a local build
like the newest beta or release:

| Kind    | Tag                       | Example          | Published as                               |
| ------- | ------------------------- | ---------------- | ------------------------------------------ |
| Beta    | `v<version>-beta.<build>` | `v0.1.0-beta.24` | a GitHub pre-release, and Live App Testing |
| Release | `v<version>+<build>`      | `v1.0.0+25`      | a GitHub release, and the Appstore         |

A release tag carries its number as semver build metadata, after the `+`, which leaves
the version alone: `v1.0.0+25` is version 1.0.0. GitHub keeps the `+` in the tag and
writes it as `%2B` in a URL. A release tagged plain `v1.0.0` would hide its number, and
`mise run build` would then number local builds like the last beta: lower than the
store's, so a device with the store version would refuse them.

### Building the packages

One commit gives two sets of packages:

- **For GitHub**: armv7, aarch64 and x86_64, with `SHA256SUMS.txt`, all without the
  portraits, which stay out of this public repository ("Portraits" in
  [native/README.md](native/README.md#portraits)).
- **For the Appstore**, or Live App Testing for a beta: the armv7 package only, with
  the portrait pack that `PORTRAITS_VERSION` in `native/src/Portrait.tsx` names,
  vendored into `native/portraits/` first.

Two traps decide the steps below:

- A checkout without the vendored portraits builds without a word, and the game then
  shows emoji faces. So count the portraits in the Appstore package.
- The Vega build copies assets into `native/build/` and never deletes stale ones, so a
  package built after one with portraits still ships them. So remove `native/build`
  before each set, and count the portraits in the GitHub packages too.

After the version pull request merges, choose the build number: higher than every
earlier build, whether tagged or only in Live App Testing. For a beta, the tag is
`v$version-beta.$build` instead. `git ls-remote` prints nothing for a new tag, and the
packages are collected next to the checkout:

```bash
git switch main && git pull --ff-only
npm ci && npm ci --prefix native
version=$(grep -m1 '^version = ' native/manifest.toml | sed 's/.*"\(.*\)".*/\1/')
build=25
tag="v$version+$build"
git ls-remote --tags origin "refs/tags/$tag"
out="../dicechess-tv-$tag" && mkdir -p "$out/appstore" "$out/github"
```

The Appstore package comes first, while the portraits are in place. Its portrait count
must be above 0, and `vpt info` must show the version and the build number. `tar` reads
a `.vpkg` when `zstd` is on the `PATH`.

```bash
rm -rf native/build
npm run build --prefix native -- --build-number "$build"
pkg=native/build/armv7-release/dicechess-tv-native_armv7.vpkg
tar tf "$pkg" | grep -c portraits/
vega exec vpt info "$pkg" --json
cp "$pkg" "$out/appstore/"
```

The GitHub packages are built with the portraits moved aside, and each must count 0:

```bash
mv native/portraits "$out/portraits"
rm -rf native/build
npm run build --prefix native -- --build-number "$build"
mv "$out/portraits" native/portraits
for pkg in native/build/*-release/*.vpkg; do echo "$(tar tf "$pkg" | grep -c portraits/) $pkg"; done
cp native/build/*-release/*.vpkg "$out/github/"
(cd "$out/github" && shasum -a 256 *.vpkg > SHA256SUMS.txt)
```

Then publish the GitHub set, from the commit that was built, and upload
`$out/appstore/dicechess-tv-native_armv7.vpkg` in the Amazon Developer Console: as a new
version of the app for a release, or to Live App Testing for a beta.

```bash
if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists: choose a higher build number"
else
  gh release create "$tag" "$out"/github/* --target "$(git rev-parse HEAD)" --title "Dice Chess $version" --generate-notes
fi
```

For a beta, add `--prerelease` and say "beta" and its number in the title. The tag
check matters: `gh release create` would attach new packages to an existing tag that
points at older code. The notes are grouped by the labels in `.github/release.yml`;
`--notes-file` replaces them with notes of your own.

## The project site

`site/` is the public site, <https://dicechess-tv.fortemate.com/>, built
with Astro Starlight. Its workflow builds every pull request that touches it and
deploys it from `main`. [site/README.md](site/README.md) explains how to run it
and add a page.

## What the platform does

[native/README.md](native/README.md) is the record of how Vega actually behaves —
remote input, saving, randomness, sound, icon and splash — each finding measured on
a device, with what was tried and failed. Something new learned about the platform
goes there, with how it was measured.
