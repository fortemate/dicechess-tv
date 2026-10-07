---
title: Readable from the sofa
description: 'The board, the dice, the sizes and the focus of Dice Chess for Fire TV, chosen to be read from across a room, and how the marks hold up for colour-blind viewers.'
sidebar:
  order: 2
---

A television is read from three metres away, often by several people at once, and it may crop the edges of the picture. Everything on the screen is sized and placed for that.

## The board

The squares use the brown palette of Chessground, the board of the open-source chess site Lichess, which many players already know. Each mark on the board looks different, not only a different colour:

| Mark                  | How it looks                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| The cursor            | A cyan frame around the square, with a dark line inside it               |
| A piece that can move | A translucent green fill                                                 |
| The piece in hand     | Raised: larger, lifted over its shadow, joined to the cursor by an arrow |
| A destination         | A dot on an empty square; a ring around a piece that would be taken      |
| The last move         | A translucent yellow-green tint on both of its squares                   |

A dot covers 32 % of its square, and a capture ring 94 %, drawn under the piece so that it does not cover the piece's edges. A dot the arrow passes over, such as a pawn's single step under the arrow to its double one, is drawn on top of the arrow.

### The cursor and the piece in hand

Testers found the cursor hard to see, and the piece in hand hard to tell from it (#121). Both were cyan: the cursor a thin frame, the piece in hand a tint with the same frame twice as thick. Cyan is almost as light as the light squares, 1.08:1 by WCAG luminance, so on them the frame stood out by hue alone. Two changes, chosen by the owner from seven variants on the browser bench:

- **The cursor** is twice as wide, with a dark line inside it. The line is 12.9:1 against the light squares and 5.6:1 against the dark ones.
- **The piece in hand** has no frame or tint of its own. It is a fifth larger and lifted over its shadow, and a cyan arrow, outlined in the cursor's dark line, joins it to the cursor.

Measured as in the next section, both stand apart from the squares for every simulated vision: the cursor's cyan by 9.9 or more, its dark line by 42.6 or more, the arrow by 8.7 or more and the shadow by 24.6 or more. The old tint of the piece in hand was 3.2 from a light square for a protanope.

## The dice

![A turn that ended with a die left over: the knight and the rook dice are spent, smaller and faded, and the queen die is dimmed at full size without its ring](../../../assets/screenshots/partial-turn.png)

The roll is drawn as three dice, as the other Dice Chess clients draw it. Each face shows the piece it allows, in the colour of the side to move. The state of each die shows in more than its colour:

- **A die still to play** carries a cyan ring.
- **A spent die** fades to 30 % and shrinks.
- **A die no legal turn can use** loses its ring and fades to 45 %, but keeps its size: it will not be played. It dims as soon as that is known, at the roll or after an action, and not only once the turn is over. In the opening with queen, bishop and knight, only a knight can move, and no knight move frees the bishop or the queen, so both of those dice dim at the roll.

A roll tumbles in: each die turns onto its face, and the three land lit in about a quarter of a second. A die that no legal turn can use dims as it lands.

## Sizes and the safe area

The app lays out a 960 x 540 dp screen, which is how a 1920 x 1080 television reports itself.

- **Text.** The headline is 38 dp, and no text is smaller than 20 dp: that is the minimum the React Native TV guide by Amazon and Callstack recommends, above Amazon's own 14sp.
- **The safe area.** Nothing sits in the outer 5 % of any edge (48 dp across, 27 dp down), where a television may crop. The board is 460 dp, and it leaves a 372 dp panel beside it, wide enough for the longest headline on one line.
- **Evidence.** Each screen was checked on the Vega Virtual Device: a script counted anything but the background inside that margin, and found nothing.

## Focus

![The home menu with OK held down on Rules: the focused item is framed, filled more strongly while the button is held, and slightly smaller](../../../assets/screenshots/focus-pressed.png)

- **Focus.** A focused menu item or rules topic is framed and filled, not only coloured.
- **Press.** While OK is held down, the item fills more strongly and shrinks a little, so the press shows before its choice takes effect.
- **Wrapping.** The text sits inside the frame, so a long title that wraps keeps its second line under its first.

## Colour-blind viewers

The marks were checked by simulating colour-vision deficiency on the board's own colours, for this page:

- the Machado, Oliveira and Fernandes (2009) model;
- differences measured in OKLab, ×100, each overlay blended over the square it sits on;
- read by the usual thresholds: 8 or more tells two colours apart, 6 to 8 only with a second cue, and under 6 does not.

| Pair                                | Normal vision | Protanopia | Deuteranopia | Tritanopia |
| ----------------------------------- | ------------: | ---------: | -----------: | ---------: |
| Green fill vs plain dark square     |          12.8 |        5.9 |      **0.3** |       14.7 |
| Green fill vs plain light square    |          15.1 |        7.5 |         10.8 |       16.1 |
| Green fill vs last-move tint, light |           8.6 |        5.0 |          7.4 |       10.7 |
| Green fill vs last-move tint, dark  |           8.1 |        4.2 |          6.1 |       10.5 |

Most marks already have a second cue: destinations are dots or rings, the dice differ by ring and size, and the cursor and the focus are frames. The green fill for a piece that can move is the exception. For a deuteranope it all but disappears on dark squares, and even with normal vision it sits close to the last-move tint. A planned change gives it a shape of its own ([Roadmap](/roadmap/)). The same concern retired an earlier amber mark ([Designing for the remote](/design/remote/)).

## Sources

- `native/src/theme.ts`: the colours.
