# Demo video

These scripts record and cut the demo video. The preliminary cut uses short
title cards and the game's own sound (owner, 2026-10-08), following demo v.6.
Prowla hosts Hot Seat; Thinkle is heard teaching the tutorial, without an added
narrator. The adaptive music is kept as the game played it, with no music bed
laid over gameplay. The earlier narrated cut is retained in
`storyboard-narrated.json` for a later version.

| File                   | What it does                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `record.ts`            | Drives the Virtual Device through the gameplay takes with `vvd`; also renders one cycle of the built launch animation.  |
| `storyboard.json`      | The cut: each scene's name (its chapter), the stretches of takes it shows, its optional title card, and the end card.   |
| `assemble.ts`          | Cuts the video, preserving game audio, and checks duration, picture and sound.                                          |
| `cards.swift`          | Draws the "Vega Virtual Device on macOS" badge, title cards and end card, in the app's colours.                         |
| `vendor-narration.mjs` | Vendors Thinkle's narration from fortemate/dicechess-assets at a pinned commit into `narration/`, with its licence.     |
| `narration/`           | The narration: 15 clips, the pack's manifest and licence, and `narration.json`, which `test/demo-video.test.ts` checks. |

## What it needs

- macOS, with the Vega Virtual Device running, and the release build built:
  `npm run build --prefix native`. The tutorial take installs it afresh.
- [`vvd`](https://github.com/fortemate/vega-vvd-driver) on the PATH with gRPC
  on (`vvd enable-grpc`), and `vega`, `ffmpeg`, `ffprobe` and `swift`. `VVD`
  and `VEGA` name the first two when they are elsewhere, and `VPKG` the
  package. All Vega app commands explicitly target `VirtualDevice`, even when
  a physical device is also connected. Use a `vvd` with
  fortemate/vega-vvd-driver#14: earlier versions
  record long sounds, such as the characters' lines, with a hole every few
  packets, heard as a rattle (fortemate/vega-vvd-driver#13).
- A build with the portraits shows them in the takes (see "Portraits" in
  `native/README.md`). The takes and the video stay in `dist/`, which git
  ignores.

## Making the video

1. Record the takes, all of them or the ones named:

   ```sh
   node --experimental-strip-types scripts/demo-video/record.ts
   ```

   They are saved to `dist/demo-video/takes/`. Set `TAKES` to a different
   directory to preserve an earlier recording. Back up the emulator's state
   before a fresh install if its saved game or settings must be retained.
   - **The tutorial take uninstalls the app first**, which deletes the game, the
     results and the settings saved on the device, so a first launch can be
     filmed: Thinkle's offer, every lesson, the closing words and a first game
     against Rolly. A fresh install starts with music and voices on, and with
     Prowla as the Hot Seat host, whom the hotseat take that follows films.
   - The `flip` take turns the board-turning option on; run it after a fresh
     tutorial install, where that option starts off. The `rules` take explores
     the guide with the remote.
   - `launch-animation` renders one complete cycle from `native/build/splash`,
     with the menu theme. It is built artwork, not a recording of startup time,
     and carries no Virtual Device badge. `splash` records a real cold launch.
   - A take run on its own checks that music is on and says that the host must
     be Prowla. Recording replaces the game saved on the device.
   - A recording started a moment before the app launched once brought the
     Virtual Device down, so each take starts its recording a few seconds
     before it launches the app, as the ones that worked did.

2. Look through each take and set where each clip starts and ends in
   `storyboard.json`, and the short text and reading time of each `card`. For the
   narrated storyboard, `at` places each line in seconds from the start of its
   scene. The dice are random, so a take can miss
   what its scene needs: a capture by Grabby, a turn left part-way for the resume
   take, or in the rampage take the music turning tense and then critical as a
   king comes under threat. Record that take again.
   - Keep his lines off the characters' own: they speak in the takes, and he
     should not talk over them, or over himself in the tutorial.
   - The Virtual Device itself now and then sends a packet of silence in the
     middle of a sound while it is recorded, about once in 30 s of sound: keep
     such a moment out of the clips, or record the take again.

3. Cut the video:

   ```sh
   node --experimental-strip-types scripts/demo-video/assemble.ts
   ```

   Set `OUT` to a different directory to keep an earlier cut. It writes
   `dist/demo-video/dicechess-tv-demo.mp4`, `chapters.txt` for the
   YouTube description, and `sheet.png`, a frame every two seconds to check the
   cut by.
   - It refuses a storyboard whose lines run into each other, and warns of a
     line that runs past its scene.
   - It enforces that the video is shorter than three minutes, 1080p at 30
     frames a second, with AAC sound. It warns of any chapter shorter than the
     10 s YouTube needs. These are checked by assemble.ts, not on a device.

## How the cut is made

- A scene is its clips in a row, each faded through the app's background into
  the next, with the take's own sound: music, effects and the characters' lines.
- Optional title cards use the menu theme with short fades; gameplay keeps its
  own music and voices. Cards have a `kicker`, a short `title`, and `seconds`
  for reading.
- In `storyboard-narrated.json`, Thinkle's lines go in at their times. Under
  each one the take's sound dips by
  `duckDb`, as the game's music does under a character's line: down in 0.2 s
  before it, back in 0.6 s after it. `narrationGainDb` moves his level against
  the takes; the clips are packed at -16 LUFS.
- A clip's `hold` keeps its last frame up, with silence under it: room for a
  line of his over a screen the take pressed on from at once.
- The preliminary end card has the menu theme and the project URL. The
  narrated storyboard retains Thinkle's closing words. Neither card promises
  a price, ads or accounts, since plans may change (owner, 2026-10-05).
- The finished mix is brought to -16 LUFS, with PCM sample peaks limited to -1.5 dBFS before AAC encoding.
- The music is pepka-prygni's. `native/music/pepka-prygni-dicechess/LICENSE.txt`
  grants it for the game only; the owner reports that the author also allowed it
  in the demo video. The end card credits it.
- The narration is for Fortemate's Dice Chess apps and the videos that present
  them (`narration/LICENSE.txt`). To take a newer recording, vendor it again:

  ```sh
  node scripts/demo-video/vendor-narration.mjs ../dicechess-assets <full commit>
  ```
