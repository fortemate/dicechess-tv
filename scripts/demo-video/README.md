# Demo video

These scripts record and cut the demo video in the form of a silent film: a
title card before each scene, the app on the Vega Virtual Device after it, and
one track of the game's music under the whole video, cards included. A card
takes the place of a caption, which read as one more line of the app's own
text over its menus.

| File              | What it does                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `record.ts`       | Drives the Virtual Device through six takes with `vvd`: home, hotseat, opponents, grabby, tutorial, rules. |
| `storyboard.json` | The cut: each card's kicker and title, the stretch of a take that follows it, the music and the end card.  |
| `assemble.ts`     | Cuts the video from the takes and the storyboard, and checks it against the contest's rules.               |
| `cards.swift`     | Draws the cards, the "Vega Virtual Device on macOS" badge and the end card, in the app's colours.          |

## What it needs

- macOS, with the Vega Virtual Device running and the release build installed
  and open: `npm run build --prefix native`, then `vega device install-app` and
  `vega device launch-app`.
- [`vvd`](https://github.com/fortemate/vega-vvd-driver) on the PATH with gRPC
  on (`vvd enable-grpc`), and `vega`, `ffmpeg`, `ffprobe` and `swift`. `VVD`
  and `VEGA` name the first two when they are elsewhere.
- In the app's Settings: music off, sound effects on and "Turn board in
  hotseat" on. The takes carry only the sound effects, and `record.ts` stops if
  the home screen is not silent. The music is laid in afterwards, so it does not
  break at the cuts.

## Making the video

1. Record the takes, all of them or the ones named:

   ```sh
   node --experimental-strip-types scripts/demo-video/record.ts
   ```

   They are saved to `dist/demo-video/takes/`. Recording replaces the game
   saved on the device.

2. Look through each take and set where each clip starts and ends in
   `storyboard.json`. The dice are random, so a take can miss what its scene
   needs, such as a die dimmed by the roll; record that take again. The times in
   the file belong to the takes the last cut was made from.

3. Cut the video:

   ```sh
   node --experimental-strip-types scripts/demo-video/assemble.ts
   ```

   It writes `dist/demo-video/dicechess-tv-demo.mp4`, `chapters.txt` for the
   YouTube description, and `sheet.png`, a frame every two seconds to check the
   cut by. The script enforces that the video is shorter than three minutes,
   1080p at 30 frames a second, with AAC sound, and prints a warning for any
   chapter shorter than the 10 s YouTube needs (checked by assemble.ts, not on
   a device).

## How the cut is made

- A card holds one idea in about ten words. Its duration is configurable and
  scales with the word count of its title; `seconds` in the storyboard overrides
  it.
- The music is the menu theme at the game's own balance: the track's gain and
  the default volume step. It is louder while a card is up, where there are
  no effects, and the finished mix is brought to a target loudness level.
- A clip's `hold` keeps its last frame up. The takes press OK at a steady pace,
  so a screen the app keeps up until a key is pressed, such as a result, closes
  at once in the take.
- The music is pepka-prygni's. `native/music/pepka-prygni-dicechess/LICENSE.txt`
  grants it for the game only; the owner reports that the author also allowed it
  in the demo video. The end card credits it.
