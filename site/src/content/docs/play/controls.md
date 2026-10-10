---
title: Controls
description: How to play Dice Chess with a Fire TV remote, from the board to the menus and every row of Settings, the keyboard keys on the Virtual Device, and living-room ergonomics.
sidebar:
  order: 2
---

Dice Chess is designed from the ground up for a television remote. The entire game is played with three controls: the **Directional Pad (D-pad)**, **OK** and **Back**. The remote's **Menu** button is a shortcut to the menus.

```text
     ┌──────────────┐
     │      ▲       │    D-pad: Jumps between movable pieces
     │  ◄   OK   ►  │    OK: Rolls, selects piece, confirms move
     │      ▼       │
     └──────────────┘
         [Back]          Back: Deselects piece, opens menu, leaves app
         [Menu]          Menu: Opens the game menu, or goes home
```

## The Fire TV Remote

### 1. Directional Pad (Arrows)

Moving square-by-square across an 8x8 chessboard is frustrating on a remote. Dice Chess replaces grid stepping with **smart directional jumps**:

- **Between movable pieces:** When no piece is selected, pressing an arrow jumps directly to the nearest piece permitted to move by your current dice roll. In the original simulation before horizontal cycling, across 200 random games, jumping reduced remote presses from **23.0 to 9.2 per turn** (60% fewer).
- **Between destinations:** Once a piece is picked up, the arrows jump only between that piece's valid destination squares (marked with dots for quiet moves or rings for captures).
- **In menus and cards:** Moves focus through menu options, opponent cards, and rules topics. Holding an arrow repeats smoothly.

At the end of the available choices, a new Left or Right press cycles to the opposite end of the same row. For example, with all starting pawns available, Right from `h2` selects `a2`. This also works between a selected piece’s destinations. Holding an arrow walks to the end and stops: release and press again to cycle. Ordinary choices ahead take priority, and Up/Down keep their directional behavior. The [Board selection algorithm](/design/board-selection/) gives the exact directional and cursor-placement rules, with examples.

### 2. OK / Select (Center Button)

The primary action button handles roll initiation, piece selection, and move execution:

- **Roll the dice:** When a turn begins, pressing OK rolls the three dice, tumbling them onto the tray in 260 ms. The board shows no cursor until then: the cyan frame appears after the roll, on a piece the dice let you move. This was seen on the Vega Virtual Device in a game against Rolly, and `native/test/input.test.tsx` checks it in a game against a friend and against Rolly.
- **Pick up a piece:** Pressing OK on an active piece picks it up and positions the cursor on the move players usually make. If the piece can take, the cursor lands on the most valuable piece it can take, the king above all. A pawn that cannot take but can still advance two squares lands on the two-square push, and one arrow press towards the pawn reaches the single step. Any other piece lands on its most central destination square. If a landing would leave another destination out of the arrows' reach, the cursor lands on the central destination instead. On the Vega Virtual Device the two-square landing was seen in the tutorial's first step, and the capture landing in its two capture lessons and in a game against a friend; `test/boardInput.test.ts` and `native/test/screen.test.ts` check both.
- **Play a move:** Pressing OK on a destination square executes the action. The piece smoothly slides to its new square in 220 ms on the native driver.
- **Single-destination shortcut:** If a piece has only one legal destination, pressing **OK then OK** immediately plays the move.
- **Only one choice (optional):** With **Auto-select only choice** turned on in Settings, OK presses itself whenever there is nothing to choose: the only piece that can move is picked up, and a piece in hand with only one destination is played there. See [Auto-select Only Choice](#auto-select-only-choice-optional) below.
- **Confirm menu items:** Selects the focused menu row. OK acts on release (`eventKeyAction === 1`), with a distinct 97% scale compression and highlight while held.
- **Accidental press protection:** Following an empty roll ("No legal moves"), OK is guarded and ignored for 700 ms to prevent an unintentional double-press from skipping past the notice before you have read it.

### 3. Back Button

The Back button provides clean, predictable reversal at every stage of the game:

- **Deselect piece:** If you have picked up a piece, pressing Back puts the piece down and returns the cursor to its starting square.
- **Stop an automatic OK:** While the prompt reads _Only one choice · Back: stop_, Back stops the press that was coming and changes nothing else. Press Back again to put the piece down or open the menu.
- **In-game menu:** When no piece is in hand during active play, pressing Back opens the [game menu](#the-game-menu).
- **Menus and guides:** Back returns to where a screen was opened from: Settings and the rules guide to the menu they were opened from, the choice of colour to the opponent cards, the cards to their menu, and a confirmation to where its action began. The tutorial and About return to the home screen.
- **Exit application:** On the Home screen, pressing Back returns `false` to Vega OS, allowing the app to close and returning you to the Fire TV launcher. On the first launch's offer of the tutorial, Back goes to the home screen instead.

### 4. Menu Button

The remote's Menu button (three lines) is a shortcut:

- **On the board:** it opens the game menu at once. A piece in hand is put down first.
- **In the game menu:** it resumes the game.
- **In Settings, the opponent cards, the choice of colour, a confirmation or the result screen:** it goes to the home screen.
- **On the home screen:** it does nothing.

---

## The Menus

Up and Down move through a menu, and it wraps: Up from the first row reaches the last. OK chooses. `native/test/screen.test.ts` checks how each menu below answers the remote.

### The Home Screen

The app opens on the home screen, titled **Dice Chess**:

- **Resume game**, only while a game is in play: back to it, as it was left.
- **Play a friend**: a new game against a friend on one remote. Over a game in play, it asks _Replace this game?_ first.
- **Play the computer**: the [opponent cards](#the-opponent-cards).
- **Learn to play**: the six-lesson tutorial, taught by Thinkle the wizard.
- **Rules reference**: the rules guide, nine topics.
- **Settings**: see [Settings](#settings) below.
- **About**: the credits.

The very first launch opens on Thinkle's offer of the tutorial instead: **Learn to play** or **Skip**. Skip, Back and Menu go to the home screen, and the offer is not shown again.

### The Opponent Cards

**Play the computer** shows three cards, Rolly (Easy), Grabby (Medium) and Rampage (Hard), each with its face, its level and a line on how it plays. Left and Right choose one. The hint under the cards says what OK does, which follows **Play as** in Settings:

- _OK: play_, with Play as on Random: the game starts in a colour drawn for you.
- _OK: play White_ or _OK: play Black_: the game starts in that colour.
- _OK: choose a colour_, with Play as on Ask: OK opens _Play Grabby as_ (with the chosen opponent's name), and Random, White or Black starts the game.

Over a game in play, _Replace this game?_ comes last, right before that game is replaced. `native/test/playAs.test.tsx` checks each Play as choice and where the confirmation comes.

### The Game Menu

Back with no piece in hand, or Menu, opens the game menu over the board:

- **Resume game**: back to the board. Back and Menu do the same.
- **Resign**: asks _Resign?_ ("The other player wins."), with **Cancel** focused first and **Yes** after it.
- **Agree a draw**, only in a game against a friend: one press ends the game drawn.
- **New game**: in a game against the computer, the opponent cards, on this game's opponent; in a game against a friend, _Replace this game?_ ("The game in progress is lost."), Cancel first.
- **Main menu**: the home screen, with no confirmation. The game stays saved, and **Resume game** there comes back to it.
- **Rules reference**: the rules guide; Back returns to the game menu.
- **Settings**: last, so Up from Resume game reaches it in one press.

### Confirmations

_Resign?_ and _Replace this game?_ offer **Cancel** and **Yes**, with Cancel focused, so a stray OK changes nothing. Cancel and Back return to where the action began; Menu goes to the home screen.

### Settings

Settings opens from the home screen and from the game menu. Up and Down move between its rows; Back returns to the menu it was opened from, and Menu goes to the home screen. The rows, in order:

| Row                         | Default | Keys                                                                                                                                                                      |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Music**                   | 7       | Left and Right set the volume from 0 to 10, shown as ten rings: _Music: 7_, or _Music: off_ at 0. OK mutes the music, and pressed again brings it back at the same level. |
| **Sound effects**           | on      | Left, Right or OK turns them on or off.                                                                                                                                   |
| **Voices**                  | on      | Left, Right or OK turns the characters' voices on or off.                                                                                                                 |
| **Play as**                 | Random  | Ask, Random, White or Black: the colour you play against the computer. Right and OK step forward, Left back.                                                              |
| **Host for friends**        | Prowla  | Prowla, Rolly, Thinkle or off: who hosts a game against a friend. Right and OK step forward, Left back.                                                                   |
| **Turn board for friends**  | off     | Left, Right or OK turns it on or off. See [Turning the board](#turning-the-board-for-friends-optional).                                                                   |
| **Auto-select only choice** | off     | Left, Right or OK turns it on or off. See [Auto-select only choice](#auto-select-only-choice-optional).                                                                   |

Each setting is saved on the TV as it changes and read again at the next launch. The tests check that each is saved and read back, and that every row fits one line of the panel (`native/test/hints.test.tsx`).

### The End of a Game

- **Against the computer:** the result names who won, or says _Draw_, with the reason under it, and _What next?_ offers **Rematch** or **Main menu**. A rematch plays the same opponent with the colour choice of the game it repeats, whatever Play as says now; if that was Random, it draws a colour again. Back and Menu go to the home screen.
- **Against a friend:** the finished game stays on the board, and OK, Back or Menu returns to the home screen.

---

## Keyboard Controls (Virtual Device & Emulators)

When playing on the Vega Virtual Device or developing on a computer, the remote keys map to standard keyboard keys:

| Action                      | Fire TV Remote                | Virtual Device Keyboard                    | Emulated Remote Skin     |
| --------------------------- | ----------------------------- | ------------------------------------------ | ------------------------ |
| **Move Cursor / Navigate**  | D-pad (Up, Down, Left, Right) | Arrow keys (`Up`, `Down`, `Left`, `Right`) | Arrow buttons            |
| **Roll / Select / Confirm** | OK / Select                   | Enter / Return (`enter`)                   | Keypad Enter (`kpenter`) |
| **Deselect / Menu / Leave** | Back                          | Escape (`Esc` → `KEY_BACK`)                | Back button              |

_Note on Keypad Enter (`kpenter`):_ The Vega Virtual Device on-screen remote skin binds its visual center button to `KEY_KPENTER`. Dice Chess supports all three names of OK (`enter`, `kpenter`, and `select`) transparently.

---

## Living-Room Ergonomics & Accessibility

### TV Safe Area & Visibility

- **5% Overscan Margin:** All gameplay UI, board squares, status panels, and dialogs are inset 48 dp horizontally and 27 dp vertically (on a 960x540 dp canvas), the margin a television may crop. `native/test/layout.test.ts` checks the insets, and on the Vega Virtual Device `vvd safe-area` found the margins of the rules guide, About and the tutorial's first lesson clear ([Quality & review](/quality/)). Whether a television with overscan crops anything is not yet checked ([Performance](/technology/performance/)).
- **Sofa Legibility:** All captions and labels use a minimum font size of 20 dp (exceeding Amazon's 14 sp guideline) for effortless reading from across the living room.
- **Framed Cyan Focus:** Focused menu items, piece squares, and opponent cards feature a luminous cyan border frame combined with a subtle fill, ensuring focus remains obvious regardless of lighting.

### Turning the Board for Friends (Optional)

When two players share a sofa or sit opposite each other, looking at an upside-down position can feel unnatural for the second player. In **Settings**, players can enable **Turn board for friends** (off by default):

- The board smoothly turns to the side to move at turn boundaries (fading out for 100 ms and back in for 100 ms in the new orientation).
- Arrow navigation naturally follows the television screen (Up moves towards the top of the TV regardless of board orientation).
- After the roll, the cursor appears on a piece of the active player that can move, on their side of the board. Two tests check this: `native/test/screen.test.ts`, that the cursor starts on Black's side when the board turns, and `native/test/input.test.tsx`, that its frame appears only after the roll.
- The setting is saved to device storage via MMKV and read again at the next launch; `native/test/turnSetting.test.ts` checks that it is saved and read back.

### Auto-select Only Choice (Optional)

Some steps of a turn leave nothing to decide: one piece is the only one the dice let move, or the piece in hand has one square to go to. In **Settings**, players can enable **Auto-select only choice** (off by default), and OK then presses itself on those steps ([issue 302](https://github.com/fortemate/dicechess-tv/issues/302)):

- **Only one piece can move:** it is picked up for you, and you still choose where it goes if it has several squares.
- **The piece in hand has one destination:** it is played there, whether you picked it up or it was picked up for you.
- **A pawn promotes on its only square:** the _Promote to_ choice opens, and the piece is always yours to choose.
- **One step at a time:** each automatic press waits 600 ms, the computer opponent's pace, so a chain of them can be followed. With rook, rook and knight in the starting position, you choose the knight and its square; the two rook moves that follow, four presses of OK, play themselves.
- **Back stops it:** while the prompt reads _Only one choice · Back: stop_, Back stops the coming press and leaves the rest of that move to you. Back or Menu at any other point of a move also leaves the rest of it to you, so a piece put down with Back stays down. The next move is automatic again.
- **Never for anything else:** it does not roll the dice, hand the turn over, play for the computer opponent, or act behind a menu or in the tutorial.
- The setting is saved to device storage via MMKV and read again at the next launch: the tests check it, and on the Vega Virtual Device it was still on after the app was reinstalled.

`native/test/autoSelect.test.tsx` checks each of these, through the screen's reducer and through the whole app. On a Fire TV Stick 4K Select, on 10 October 2026, the only piece was picked up by itself, a pawn with one square was played there, and Back stopped a press that was coming ([pull request 342](https://github.com/fortemate/dicechess-tv/pull/342)).

### Reduced Motion Support

For players sensitive to motion or animation effects, the application detects `AccessibilityInfo.isReduceMotionEnabled`. When enabled:

- Piece moves draw immediately at their destinations rather than sliding across the board.
- Dice land instantly without 3D tumbling animations.
- The board flips immediately between turns in a game against a friend without fading out and back in.

Only unit tests cover this (`native/test/boardMotion.test.tsx`). On the Vega Virtual Device the query answers no, and there is no setting to change it; whether a Fire TV Stick offers the setting is not yet checked ([Performance](/technology/performance/)).
