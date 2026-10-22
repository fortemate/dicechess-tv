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
`BUILD_NUMBER=30 mise run device:run` sets the number by hand (the published
1.0.1 release's number on October 14, 2026).

On the virtual device the Mac keyboard stands in for the remote: arrow keys for
the D-pad, Enter for OK, Esc for Back, F1 for Home. The on-screen remote's OK
button works too.

From a script, or for a coding agent, use
[vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver): `vvd press`
presses the remote's keys and `vvd screenshot` saves the screen, after
`vvd enable-grpc` once per start of the device.
[native/README.md](native/README.md#scripted-virtual-device-automation) shows a
session.

[`.mcp.json`](.mcp.json) also registers its MCP server, `vvd`, pinned like
Amazon's: a coding agent presses keys and gets the resulting screen back as an
image in one call, and can wait for the screen to settle (`wait_for_change`) or
count what sits in the TV safe-area margin (`check_safe_area`). Without the Vega
SDK it starts but its calls fail. There is one virtual device: make sure no other
session is driving it before an agent presses keys, and bump the pin only after
reading what changed.

Without the task, `npm run build --prefix native` builds with number 0, which the device
refuses over beta 4 or later and over 1.0.0. Add `-- --build-number <n>` with the number of the latest
beta or release. `mise run build` falls back to 0 only when it finds no numbered tag.
Removing the app instead deletes its saved game.

Say in the pull request which kind of evidence a claim rests on — the virtual
device, a Fire TV Stick, or a test — because they are not interchangeable.

### Measure memory on a Fire TV Stick

A Fire TV Stick 4K Select has 1 GB of memory and ends apps in the background to
get it back (#478). Amazon's guidelines are a foreground PSS under 400 MiB and a
background PSS under 150 MiB ([Measure App KPIs](https://developer.amazon.com/docs/vega/0.24/measure-app-kpis.html)).
Measure on the Stick: the Virtual Device has never shown these kills.

The developer shell cannot read the app's memory. `vega exec vda shell` runs in a
sandbox of its own, where `/proc/<pid>` of the app and `perfdump meminfo <pid>` are
not visible. The SDK's memory monitor reads it through a system service:

```bash
vega exec perf memory-monitor --app-name=com.fortemate.dicechesstv.main --keplerscript-app
```

It is interactive: press `s` to start recording, `s` again to stop, and `q` to quit.
The default recording timeout is 120 seconds. For a longer recording, first check
`vega exec perf memory-monitor --help`: SDK builds that list `--recording-timeout`
accept, for example, `--recording-timeout 400` on the command above.
From a script, run it in a pseudo-terminal (Python's `pty` module) and type the
keys on a timer. It prints a sample about once a second; locate the saved JSON
using the destination shown by the tool. The [Memory Monitor guide](https://developer.amazon.com/docs/vega/0.24/monitor-record-app-memory.html)
names `Basic-memory-recorder[timestamp].json` in the project's `generated`
directory for recordings made through Vega Studio. Each
entry of `memoryRecords` has a `timestamp` in nanoseconds of the device's clock
and, per process, these fields in kB (the JS heap in bytes):

| Field                    | What it is                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| `TOTAL_TOTAL`            | PSS + swapped PSS + DRM: about what the system's kill line counts |
| `TOTAL_Pss`              | proportional set size, without swap and graphics                  |
| `TOTAL_Drm`              | graphics buffers: the surface, decoded images and glyphs          |
| `TOTAL_Anon`             | anonymous memory: the JS heap's segments and native allocations   |
| `TOTAL_NativeHeap`       | malloc'd native memory                                            |
| `TOTAL_Libs`             | shared libraries' share; high in a fresh process, lower later     |
| `TOTAL_JS_HeapAllocated` | the Hermes heap in use                                            |

`vega exec perf activity-monitor --record-thread-states` reports the app's CPU
and how long the JavaScript and UI threads slept.

Start the monitor once the app is on screen, not just before a cold launch. On
October 20, 2026, 5 of 18 launches begun while the monitor was starting never came
up: the process ended within half a second, before React rendered anything, with
no crash report. The store's build 30 did it as well as the build under test, and
none of 10 launches without the monitor failed. A monitor whose app died does not
exit on its own.

Why the app is ended is in the device's own policy, readable in
`/etc/app-framework/resource-manager/` on the Stick. Under `memory-mid` pressure the
resource manager trims background apps and then ends those still there, unless
they have a memory quota, and only a few system components have one. Pressure
counts as `memory-mid` when the journal's thrashing check finds MemFree +
SwapFree under about 750 MB. On October 20, 2026 the owner's Stick, up for six
days, sat just under that line: build 34 was ended on 20 of 20 trips to the
launcher, and build 35 on 17 of 20. After a reboot it was above the line, and
build 35 survived 20 of 20.
So record the device's state with every run (`/tmp`, MemAvailable, MemFree,
SwapFree, uptime), and reboot before comparing builds.

Compare like with like. A freshly started process carries more of its libraries
(55 to 68 MiB of `TOTAL_Libs` on October 20, 2026, against 25 MiB in one that had
run for a while), so measure each build from the same start: a cold launch, the
same screens, the same waits.

Measure five situations: the home screen, the board in a game against the
computer, the bot's and the danger search while moves are played, 5 s and 30 s at
the launcher, and the first second after the return. `vega exec vda shell`
expands `$` on the Mac, so push a script and run it there. This one logs each
step with the device's clock, to line up with the monitor's samples:

```sh
#!/bin/sh
# sh /tmp/scenario.sh: home, board, play, then trips of 5 and 30 s.
L=/tmp/scenario.log
APP=com.fortemate.dicechesstv.main
log() { echo "$(date +%s.%N) $* [$(vlcm list | awk -v a=$APP '$1 == a {print $3, $5}')]" >> $L; }
log home; sleep 20
inputd-cli button_press KEY_ENTER; log board; sleep 25   # Resume game
log play
for i in $(seq 30); do inputd-cli button_press KEY_ENTER; sleep 1.5; done
for away in 5 30; do
  log "away $away"
  vlcm launch-app pkg://com.amazon.smplighthouse.launcher.main
  sleep "$away"
  vlcm launch-app pkg://$APP; log back; sleep 15
done
log done
```

```bash
vega exec vda push scenario.sh /tmp/scenario.sh
vega exec vda shell "sh /tmp/scenario.sh; cat /tmp/scenario.log"
```

Repeated OK presses roll, pick up the piece the cursor waits on and put it down
where the cursor lands, so they play legal moves and give the bot its turns.

The system's decisions are in the journal. While the trips run, keep
`vega exec vda shell "loggingctl log -f -o short_precise"` running in the
background and look for `memory-mid Kill <pid> com.fortemate.dicechesstv.main
Usage <after>:<before>`, `TRIM_RESOURCES` and `same pids`. Each kill also leaves a
`LowMemoryKiller` report:
`vega device copy-logs --device <stick-id> --artifact SYSTEM_TOMBSTONE/acr --directory <dir>`, never with
`--upload` or `--purge`. Its `action name` says which rule ended the app.

The Stick's `/tmp` lives in memory. The perf tools leave their traces there as
`vs_trace1-*` files, tens of MB each, and `vega device install-app` leaves each
package there (FL-32). Check `df -h /tmp` before a run and remove what your runs
left, or the next measurement starts under more pressure.

## Generated and vendored files

Never edit these by hand. Change the script, rerun it, and commit what it writes:

| Path                                                                   | Written by                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `native/src/pieces/*.tsx`                                              | `native/scripts/generate-pieces.mjs`, from `src/assets/pieces/rhosgfx/`        |
| `native/src/faces/*.tsx`, `native/src/faces/index.ts`                  | `native/scripts/generate-faces.mjs`, from `src/assets/faces/rhosgfx/`          |
| `native/sounds/`, `native/src/cueFiles.ts`                             | `native/scripts/vendor-sounds.mjs`, from one pinned commit of dicechess-assets |
| `native/music/`                                                        | `native/scripts/vendor-music.mjs`, from one pinned commit of dicechess-assets  |
| `native/voices/`, `native/src/voiceFiles.ts`, `src/core/hostPacing.ts` | `native/scripts/vendor-voices.mjs`, from one pinned commit of dicechess-assets |
| `site/public/voices/`, `site/src/voices/audition.json`                 | `site/scripts/vendor-voices.mjs`, from one pinned commit of dicechess-assets   |
| `native/assets/` (not committed)                                       | `native/scripts/generate-assets.mjs`, which every build runs                   |
| `native/licenses/THIRD_PARTY_NOTICES.txt`                              | `native/scripts/notices.mjs`, from the source map `npm run bundle` writes      |

Third-party files — the RhosGFX pieces, the brand images in `native/brand/`, the
vendored sounds and the license texts in `licenses/` — are kept byte for byte, and
`.gitattributes` stops Git from rewriting their line endings. A new asset needs its
license recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and, when the
license asks for credit, a line on the About screen (`src/core/credits.ts`).

Packaged MP3 copies are generated from those unchanged vendor files. The asset
generator verifies their source digests before stripping leading and appended
ID3 tags, retaining the MPEG audio frames. The packaged music catalog carries
the generated copies' digests; vendor catalogs and locks retain the originals.
The reason and device evidence are on
[Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/#playback-after-the-os-update)
and in the [audio validation record](docs/audio-regression-validation-387.md).

The package carries the notices of every npm package in the bundle (#338). When a
dependency change brings a package in or takes one out, `npm run bundle --prefix
native` fails and says which, and `mise run build` fails when the Vega build's own
bundle has a package the notices do not name. Rewrite the notices with `npm run notices --prefix native`, read the diff,
and name the package in THIRD_PARTY_NOTICES.md and on the site's Credits and
licenses page, which `test/credits.test.ts` checks.

## The voices

Use American English (`en-US`) for original copy in the app, VoiceView, the site
and documentation. Preserve saved values, API names, filenames and published
links when editing text. Keep license text and required credits verbatim.

The pinned recordings retain their exact source transcripts. The shared
`src/core/voiceCaption.ts` presents the existing pronunciation-equivalent U.S.
spellings in speech bubbles and website captions. It does not change the text
used to validate or select a recording; other wording changes need a new clip.

Five voice packs are vendored from fortemate/dicechess-assets, which keeps them for
every client: the bots', one for each host of a game against a friend, Prowla
(#258), Rolly (#202) and Thinkle (#279), and the tutorial's, which Thinkle the
wizard teaches (#264). Players see that mode as "Play a friend" (#348); the code
still calls it hotseat, and the packs' own notices say Hot Seat.

The bots' lines are written here, in `src/core/botVoice.ts`, and their voices are
synthesized from those lines in dicechess-assets. Whenever a line changes, commit
it, export the catalog, and have the pack synthesized again there before it is
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

A release is cut by the owner, on a machine with the Vega SDK; CI cannot build the
package. An agent may prepare a release, but never tags, publishes or uploads one.

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
build 24, 1.0.0 was released as builds 26, 28 and 29, and 1.0.1 as build 30 on
October 14, 2026. The next upload, beta or release, must be 31 or higher, whatever
its version, and must also exceed any later submitted or Live App Testing build.
Every tag carries its build number, so that
`mise run build` can number a local build like the newest beta or release:

| Kind    | Tag                       | Example         | Published as                               |
| ------- | ------------------------- | --------------- | ------------------------------------------ |
| Beta    | `v<version>-beta.<build>` | `v0.1.0-beta.8` | a GitHub pre-release, and Live App Testing |
| Release | `v<version>+<build>`      | `v1.0.0+26`     | a GitHub release, and the Appstore         |

A release tag carries its number as semver build metadata, after the `+`, which leaves
the version alone: `v1.0.0+26` is version 1.0.0. GitHub keeps the `+` in the tag and
writes it as `%2B` in a URL. A release tagged plain `v1.0.0` would hide its number, and
`mise run build` would then number local builds like the last beta: lower than the
store's, so a device with the store version would refuse them.

Tag every upload, betas included. Beta 24 went to Live App Testing only and was never
tagged, so until `v1.0.0+26` existed `mise run build` numbered local builds 8, after
`v0.1.0-beta.8`, below the store's.

### Building the packages

Starting with 1.0.3/build 34, GitHub and Appstore packages include the same
tracked portrait pack from `native/portraits/`. A normal clone needs no separate
asset checkout. The original notice and digest lock stay with the pack; its
restricted license is unchanged. `native/scripts/vendor-portraits.mjs` is only
needed when refreshing the pack from its source.

Build armv7, aarch64 and x86_64 together. Use armv7 for the physical Fire TV
Stick and the Appstore; collect all three for GitHub, with `SHA256SUMS.txt`.
Remove the previous generated `native/build/` first: the Vega SDK can otherwise
retain stale assets from an earlier build.

After the version pull request merges, build from its final main commit. Choose
a build number above every earlier release or Live App Testing upload. The next
planned release is 1.0.5/build 59, following `v1.0.4+58`; raise 59 if a newer
upload has used it. Do not override the manifest version with `--build-version`.

```bash
git switch main && git pull --ff-only
npm ci && npm ci --prefix native
version=$(grep -m1 '^version = ' native/manifest.toml | sed 's/.*"\(.*\)".*/\1/')
build=59
tag="v$version+$build"
commit=$(git rev-parse HEAD)
git ls-remote --tags origin "refs/tags/$tag"
out="../dicechess-tv-$tag" && mkdir -p "$out/github" "$out/appstore"
rm -rf native/build
npm run build --prefix native -- --build-number "$build"
node native/scripts/notices.mjs --build
```

Before collecting the packages, check each archive with `vega exec vpt info`
and `tar`: the manifest and build metadata must agree on the version, the build
number must be the chosen one, and the native library must match the target
processor. Each package must contain exactly ten portrait PNGs under
`assets/portraits/1.4.1/`: a badge and a card for each character in
`CHARACTERS` in `native/src/Portrait.tsx`. The other source portraits and
Thinkle's SVG are not runtime assets; the SVG draws the splash at build time.
`tar` reads a `.vpkg` when `zstd` is on the `PATH`.

```bash
for pkg in native/build/*-release/*.vpkg; do
  vega exec vpt info "$pkg" --json
  tar tf "$pkg" | grep -c 'assets/portraits/.*[.]png$'
done
cp native/build/*-release/*.vpkg "$out/github/"
cp native/build/armv7-release/dicechess-tv-native_armv7.vpkg "$out/appstore/"
(cd "$out/github" && shasum -a 256 *.vpkg > SHA256SUMS.txt)
```

Validate the upgrade on a device without uninstalling, check that saved data
and settings survive, and compare the installed JavaScript and Hermes hashes
with the package. Record the target and the actions checked separately from
other evidence. Copy the prepared release notes to `$out/RELEASE_NOTES.md`.

Store and developer signatures need separate checks. On October 21, 2026, the
physical Stick refused a developer-signed 1.0.4/build 55 package over its
Amazon-signed 1.0.1/build 30 installation with `Uninstall existing package to
update`. The store package also refused developer-shell access to its saved
data. Uninstalling removes saved games, results and settings; keep that store
installation if its data must be retained. Record tests on a separate QA package
separately from an installation of the original release archive. Updating the
developer candidate with the final package worked without uninstalling; its
MMKV data and CRC files matched before the update and after launch. This check
does not establish preservation through an Amazon-signed store update.

The owner then publishes the set built from that exact main commit. Check that
the tag is unused, create an annotated signed tag, push it, and create the
release on the existing tag:

```bash
if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null; then
  echo "$tag already exists: choose a higher build number"
else
  git tag -s "$tag" "$commit" -m "Dice Chess $version, build $build"
  git push origin "refs/tags/$tag"
  gh release create "$tag" "$out"/github/* --verify-tag --title "Dice Chess $version, build $build" --notes-file "$out/RELEASE_NOTES.md"
fi
```

For a beta, use `v$version-beta.$build` and `--prerelease`. `--verify-tag`
requires the tag to exist on GitHub, so the release command cannot create a tag
on a different commit. Read back the published tag, metadata and downloads,
and verify the downloaded packages against the checksum manifest.

The armv7 package may be uploaded separately in the Amazon Developer Console
when the owner authorizes an Appstore or Live App Testing submission. A GitHub
release does not establish Appstore approval or availability.

## The project site

`site/` is the public site, <https://dicechess-tv.fortemate.com/>, built
with Astro Starlight. Its workflow builds every pull request that touches it and
deploys it from `main`. [site/README.md](site/README.md) explains how to run it
and add a page.

## What the platform does

The site's [Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/)
page, `site/src/content/docs/technology/vega.md`, is the record of how Vega actually
behaves — remote input, sound, the icon and the splash, scripted automation — each finding
measured on a device, with what was tried and failed (it moved there from
native/README.md in #93). Something new learned about the platform goes there, with
how it was measured and on which device.
