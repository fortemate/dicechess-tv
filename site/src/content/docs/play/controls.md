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

- **Between movable pieces:** When no piece is selected, pressing an arrow jumps directly to the nearest piece permitted to move by your current dice roll. In simulations across 200 random games, this reduced remote presses from **22.6 to 8.7 per turn** (a 61% reduction).
- **Between destinations:** Once a piece is picked up, the arrows jump only between that piece's valid destination squares (marked with dots for quiet moves or rings for captures).
- **In menus and cards:** Moves focus through menu options, difficulty cards, and rules topics. Holding an arrow repeats smoothly.

### 2. OK / Select (Center Button)

The primary action button handles roll initiation, piece selection, and move execution:

- **Roll the dice:** When a turn begins, pressing OK rolls the three dice, tumbling them onto the tray in 260 ms.
- **Pick up a piece:** Pressing OK on an active piece picks it up and automatically positions the cursor on its most central destination square.
- **Play a move:** Pressing OK on a destination square executes the action. The piece smoothly slides to its new square in 220 ms on the native driver.
- **Single-destination shortcut:** If a piece has only one legal destination, pressing **OK then OK** immediately plays the move.
- **Confirm menu items:** Selects the focused menu row. OK acts on release (`eventKeyAction === 1`), with a distinct 97% scale compression and highlight while held.
- **Accidental press protection:** Following an empty roll ("No legal moves"), OK is guarded and ignored for 700 ms to prevent an unintentional double-press from skipping past the notice before you have read it.

### 3. Back Button

The Back button provides clean, predictable reversal at every stage of the game:

- **Deselect piece:** If you have picked up a piece, pressing Back puts the piece down and returns the cursor to its starting square.
- **In-game menu:** When no piece is in hand during active play, pressing Back opens the pause menu (Resume game, Settings, Rules, New game, Main menu).
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

### Hotseat Board Turning (Optional)

When two players share a sofa or sit opposite each other, looking at an upside-down position can feel unnatural for the second player. In **Settings**, players can enable **Turn board in hotseat** (off by default):

- The board smoothly turns to the side to move at turn boundaries (fading out for 100 ms and back in for 100 ms in the new orientation).
- Arrow navigation naturally follows the television screen (Up moves towards the top of the TV regardless of board orientation).
- The cursor starts on the active player's side (`e2` for White, `e7` for Black).
- The setting is saved to device storage via MMKV and persists across application restarts.

### Reduced Motion Support

For players sensitive to motion or animation effects, the application detects `AccessibilityInfo.isReduceMotionEnabled`. When enabled:

- Piece moves draw immediately at their destinations rather than sliding across the board.
- Dice land instantly without 3D tumbling animations.
- The board flips immediately between turns in hotseat without fading out and back in.
