# Game icon

The launcher icon of Dice Chess TV: two dice mid-roll, a knight in front of a
rook, on warm orange. The owner chose it on 25 September 2026 (#83).

`icon-512.png` is copied verbatim from `fortemate/dicechess-assets`, from
`icons/dicechess-tv/exports/png/icon-512.png` at commit
`461ec123445bfd6c884e3510384e7bf2991c6e75`. Its SHA-256 is
`32d7ff20c4ba5bb31d543ba8c942e7da42b5e8a4971b7785a07373d187cabd2b`. The SVG
master, the manifest and the rendering notes live there. **Do not edit the icon
here.** A change is made in the asset repository and copied again.

`NOTICE.txt` is that repository's rights statement. The icon is Fortemate's
artwork and is not licensed under the AGPL. The two RhosGFX pieces inside it
are CC0.

The Vega launcher scales the icon to fill a 3:2 tile and crops the top and
bottom, so everything that matters stays within y 100–412 of 512.
`test/splash.test.ts` holds the icon to that band.
