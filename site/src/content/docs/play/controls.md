---
title: Controls
description: How to navigate Dice Chess TV with a Fire TV remote, keyboard shortcuts for emulators, and living-room ergonomics.
sidebar:
  order: 2
---

Dice Chess TV is designed from the ground up for a television remote. The entire game is played using only three controls: **Directional Pad (D-pad)**, **OK**, and **Back**.

```text
     ┌──────────────┐
     │      ▲       │    D-pad: Jumps between movable pieces
     │  ◄   OK   ►  │    OK: Rolls, selects piece, confirms move
     │      ▼       │
     └──────────────┘
         [Back]          Back: Deselects piece, opens menu, leaves app
```

## The Fire TV Remote

### 1. Directional Pad (Arrows)

Moving square-by-square across an 8x8 chessboard is frustrating on a remote. Dice Chess TV replaces grid stepping with **smart directional jumps**:

- **Between movable pieces:** When no piece is selected, pressing an arrow jumps directly to the nearest piece permitted to move by your current dice roll. In simulations across 200 random games, this reduced remote presses from **23.0 to 9.2 per turn** (60% fewer).
- **Between destinations:** Once a piece is picked up, the arrows jump only between that piece's valid destination squares (marked with dots for quiet moves or rings for captures).
- **In menus and cards:** Moves focus through menu options, difficulty cards, and rules topics. Holding an arrow repeats smoothly.

### 2. OK / Select (Center Button)

The primary action button handles roll initiation, piece selection, and move execution:

- **Roll the dice:** When a turn begins, pressing OK rolls the three dice, tumbling them onto the tray in 260 ms. The board shows no cursor until then: the cyan frame appears after the roll, on a piece the dice let you move. This was seen on the Vega Virtual Device in a game against Rolly, and `native/test/input.test.tsx` checks it in Hot Seat and against Rolly.
- **Pick up a piece:** Pressing OK on an active piece picks it up and positions the cursor on the move players usually make. If the piece can take, the cursor lands on the most valuable piece it can take, the king above all. A pawn that cannot take but can still advance two squares lands on the two-square push, and one arrow press towards the pawn reaches the single step. Any other piece lands on its most central destination square. If a landing would leave another destination out of the arrows' reach, the cursor lands on the central destination instead. On the Vega Virtual Device the two-square landing was seen in the tutorial's first step, and the capture landing in its two capture lessons and in a Hot Seat game; `test/boardInput.test.ts` and `native/test/screen.test.ts` check both.
- **Play a move:** Pressing OK on a destination square executes the action. The piece smoothly slides to its new square in 220 ms on the native driver.
- **Single-destination shortcut:** If a piece has only one legal destination, pressing **OK then OK** immediately plays the move.
- **Confirm menu items:** Selects the focused menu row. OK acts on release (`eventKeyAction === 1`), with a distinct 97% scale compression and highlight while held.
- **Accidental press protection:** Following an empty roll ("No legal moves"), OK is guarded and ignored for 700 ms to prevent an unintentional double-press from skipping past the notice before you have read it.

### 3. Back Button

The Back button provides clean, predictable reversal at every stage of the game:

- **Deselect piece:** If you have picked up a piece, pressing Back puts the piece down and returns the cursor to its starting square.
- **In-game menu:** When no piece is in hand during active play, pressing Back opens the pause menu (Resume game, Resign, Agree a draw in Hot Seat, New game, Rules reference, Settings).
- **Submenus and guides:** Inside Settings, the Rules guide, or About screen, Back navigates up one level.
- **Exit application:** On the Home screen, pressing Back returns `false` to Vega OS, allowing the app to close and returning you to the Fire TV launcher.

---

## Keyboard Controls (Virtual Device & Emulators)

When playing on the Vega Virtual Device or developing on a computer, the remote keys map to standard keyboard keys:

| Action                      | Fire TV Remote                | Virtual Device Keyboard                    | Emulated Remote Skin     |
| --------------------------- | ----------------------------- | ------------------------------------------ | ------------------------ |
| **Move Cursor / Navigate**  | D-pad (Up, Down, Left, Right) | Arrow keys (`Up`, `Down`, `Left`, `Right`) | Arrow buttons            |
| **Roll / Select / Confirm** | OK / Select                   | Enter / Return (`enter`)                   | Keypad Enter (`kpenter`) |
| **Deselect / Menu / Leave** | Back                          | Escape (`Esc` → `KEY_BACK`)                | Back button              |

_Note on Keypad Enter (`kpenter`):_ The Vega Virtual Device on-screen remote skin binds its visual center button to `KEY_KPENTER`. Dice Chess TV supports all three names of OK (`enter`, `kpenter`, and `select`) transparently.

---

## Living-Room Ergonomics & Accessibility

### TV Safe Area & Visibility

- **5% Overscan Margin:** All gameplay UI, board squares, status panels, and dialogs are inset 48 dp horizontally and 27 dp vertically (on a 960x540 dp canvas), ensuring no text or pieces are clipped by television bezels.
- **Sofa Legibility:** All captions and labels use a minimum font size of 20 dp (exceeding Amazon's 14 sp guideline) for effortless reading from across the living room.
- **Framed Cyan Focus:** Focused menu items, piece squares, and difficulty cards feature a luminous cyan border frame combined with a subtle fill, ensuring focus remains obvious regardless of lighting.

### Hot Seat Board Turning (Optional)

When two players share a sofa or sit opposite each other, looking at an upside-down position can feel unnatural for the second player. In **Settings**, players can enable **Turn board in Hot Seat** (off by default):

- The board smoothly turns to the side to move at turn boundaries (fading out for 100 ms and back in for 100 ms in the new orientation).
- Arrow navigation naturally follows the television screen (Up moves towards the top of the TV regardless of board orientation).
- After the roll, the cursor appears on a piece of the active player that can move, on their side of the board. Two tests check this: `native/test/screen.test.ts`, that the cursor starts on Black's side when the board turns, and `native/test/input.test.tsx`, that its frame appears only after the roll.
- The setting is saved to device storage via MMKV and persists across application restarts.

### Reduced Motion Support

For players sensitive to motion or animation effects, the application detects `AccessibilityInfo.isReduceMotionEnabled`. When enabled:

- Piece moves draw immediately at their destinations rather than sliding across the board.
- Dice land instantly without 3D tumbling animations.
- The board flips immediately between turns in Hot Seat without fading out and back in.
