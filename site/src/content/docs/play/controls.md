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
- **Pick up a piece:** Pressing OK on an active piece picks it up and positions the cursor on the move players usually make. If the piece can take, the cursor lands on the most valuable piece it can take, the king above all. A pawn that cannot take but can still advance two squares lands on the two-square push, and one arrow press toward the pawn reaches the single step. Any other piece lands on its most central destination square. If a landing would leave another destination out of the arrows' reach, the cursor lands on the central destination instead. On the Vega Virtual Device the two-square landing was seen in the tutorial's first step, and the capture landing in its two capture lessons and in a game against a friend; `test/boardInput.test.ts` and `native/test/screen.test.ts` check both.
- **Play a move:** Pressing OK on a destination square executes the action. The piece smoothly slides to its new square in 220 ms on the native driver.
- **Single-destination shortcut:** If a piece has only one legal destination, pressing **OK then OK** immediately plays the move.
- **Only one move (optional):** With **Auto-play only move** turned on in Settings, OK presses itself when the dice leave only one move: one piece with one square to go to is picked up and played there. A piece with several squares, or one you pick up yourself, waits for your OK. See [Auto-play Only Move](#auto-play-only-move-optional) below.
- **Confirm menu items:** Selects the focused menu row. OK acts on release (`eventKeyAction === 1`), with a distinct 97% scale compression and highlight while held.
- **Accidental press protection:** Following an empty roll ("No legal moves"), OK is guarded and ignored for 700 ms to prevent an unintentional double-press from skipping past the notice before you have read it.

### 3. Back Button

The Back button provides clean, predictable reversal at every stage of the game:

- **Deselect piece:** If you have picked up a piece, pressing Back puts the piece down and returns the cursor to its starting square.
- **Stop an automatic OK:** While the prompt reads _Only one choice · Back: stop_, Back stops the press that was coming and changes nothing else. Press Back again to put the piece down or open the menu.
- **In-game menu:** When no piece is in hand during active play, pressing Back opens the [game menu](#the-game-menu).
- **Menus and guides:** Back returns to where a screen was opened from: Settings and the rules guide to the menu they were opened from, the choice of color to the opponent cards, the cards to their menu, and a confirmation to where its action began. The tutorial and About return to the home screen.
- **Exit application:** On the Home screen, pressing Back returns `false` to Vega OS, allowing the app to close and returning you to the Fire TV launcher. On the first launch's offer of the tutorial, Back goes to the home screen instead.

### 4. Menu Button

The remote's Menu button (three lines) is a shortcut:

- **On the board:** it opens the game menu at once. A piece in hand is put down first.
- **In the game menu:** it resumes the game.
- **In Settings, the opponent cards, the choice of color, a confirmation or the result screen:** it goes to the home screen.
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

- _OK: play_, with Play as on Random: the game starts in a color drawn for you.
- _OK: play White_ or _OK: play Black_: the game starts in that color.
- _OK: choose a color_, with Play as on Ask: OK opens _Play Grabby as_ (with the chosen opponent's name), and Random, White or Black starts the game.

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

| Row                        | Default  | Keys                                                                                                                                                                                 |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Music**                  | 7        | Left and Right set the volume from 0 to 10, shown as ten rings: _Music: 7_, or _Music: off_ at 0. OK mutes the music, and pressed again brings it back at the same level.            |
| **Sounds**                 | 10       | Left and Right set the volume from 0 to 10, shown as ten rings: _Sounds: 10_, or _Sounds: off_ at 0. OK mutes the sounds, and pressed again brings them back at the same level.      |
| **Voices**                 | 10       | Left and Right set the volume from 0 to 10, shown as ten rings: _Voices: 10_, or _Voices: off_ at 0. OK mutes the voices, and pressed again brings them back at the same level.      |
| **Highlights**             | Standard | Standard, Enhanced, Color-blind or High contrast: how movable pieces, the piece in hand, destinations, the cursor and the last move are drawn. Right and OK step forward, Left back. |
| **Auto-play only move**    | off      | Left sets off, Right sets on, and OK toggles. See [Auto-play only move](#auto-play-only-move-optional).                                                                              |
| **Play as**                | Random   | Ask, Random, White or Black: your color in new games against the computer. Changing this leaves the running game as it is. Right and OK step forward, Left back.                     |
| **Turn board for friends** | off      | Left sets off, Right sets on, and OK toggles. See [Turning the board](#turning-the-board-for-friends-optional).                                                                      |
| **Host for friends**       | Prowla   | Prowla, Rolly, Thinkle or off: who hosts a game against a friend. Right and OK step forward, Left back.                                                                              |

The focused row shows its controls. Auto-play only move explains that it plays the only legal move for you; Play as explains that it selects your color in new computer games. VoiceView announces these explanations when focus arrives, and only the new value when it changes. Holding Left or Right on either switch keeps the value stable.

`native/test/voiceView.test.tsx` checks the announcements with AccessibilityInfo stubbed; `native/test/settingsHint.test.tsx` checks switch repeats, OK release and persistence. D-pad navigation, direction and OK holds, and Back were checked on the Vega Virtual Device. VoiceView listening on a physical Fire TV Stick remains unverified for these explanations.

Each setting is saved on the TV as it changes and read again at the next launch. The tests check each press of the volume rows (`native/test/screen.test.ts`), that each is saved and read back (`native/test/soundApp.test.tsx`, `native/test/soundSetting.test.ts`, `native/test/voiceSetting.test.ts`, `native/test/highlights.test.tsx`), and that every row fits one line of the panel (`native/test/hints.test.tsx`).

### The End of a Game

- **Against the computer:** the result names who won, or says _Draw_, with the reason under it, and _What next?_ offers **Rematch** or **Main menu**. A rematch plays the same opponent with the color choice of the game it repeats, whatever Play as says now; if that was Random, it draws a color again. Back and Menu go to the home screen.
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

### Board Highlights (Color-Vision & High-Contrast Modes) {#board-highlights-colour-vision--high-contrast-modes}

In **Settings**, players can cycle **Highlights** between four board-mark styles ([issue 404](https://github.com/fortemate/dicechess-tv/issues/404), [pull request 413](https://github.com/fortemate/dicechess-tv/pull/413)):

- **Standard (default):** the original television board marks — translucent green fill for movable pieces, translucent cyan fill and double-width cyan frame for the picked-up piece, green dots and capture rings for destinations, and a cyan perimeter frame for the cursor.
- **Enhanced:** lifts the picked-up piece (`1.18x`) above a soft oval drop shadow and gives the cursor a bold two-tone frame (cyan outer band, dark inner band) so the piece in hand and the destination cursor no longer share a cyan perimeter border.
- **Color-blind:** replaces the green/cyan palette with the **Okabe–Ito** color-vision-safe palette and pairs every state with a distinct geometric shape — blue fill with four corner triangles (`#0072b2`) for movable pieces, a lifted piece over a reddish-purple pedestal (`#cc79a7`) for the piece in hand, white-rimmed vermilion dots and double-rimmed capture rings (`#d55e00`) for destinations, a semi-transparent ghost preview of the carried piece on the destination under the cursor, a bold two-tone yellow/black cursor frame (`#f0e442`), and a sky-blue inset outline (`#56b4e9`) for the last move.
- **High contrast:** pure black and white marks with full shape redundancy — black corner triangles for movable pieces, a lifted piece with a drop shadow for the piece in hand, black dots and capture rings with crisp white rims, a ghost preview of the carried piece under the cursor, a white wash with a two-tone black/white cursor frame, and a white inset outline for the last move.

The setting is saved via MMKV (`dicechess-tv.highlights.v1`) and applies to both the game board and the interactive tutorial board. `native/test/highlights.test.tsx` checks the setting and the rendered marks of all four styles; [Readable from the sofa](/design/sofa/#colour-blind-viewers) gives the contrast measurements and geometry table.

### Turning the Board for Friends (Optional)

When two players share a sofa or sit opposite each other, looking at an upside-down position can feel unnatural for the second player. In **Settings**, players can enable **Turn board for friends** (off by default):

- The board smoothly turns to the side to move at turn boundaries (fading out for 100 ms and back in for 100 ms in the new orientation).
- Arrow navigation naturally follows the television screen (Up moves toward the top of the TV regardless of board orientation).
- After the roll, the cursor appears on a piece of the active player that can move, on their side of the board. Two tests check this: `native/test/screen.test.ts`, that the cursor starts on Black's side when the board turns, and `native/test/input.test.tsx`, that its frame appears only after the roll.
- The setting is saved to device storage via MMKV and read again at the next launch; `native/test/turnSetting.test.ts` checks that it is saved and read back.

<a id="auto-select-only-choice-optional"></a>

### Auto-play Only Move (Optional)

Some moves leave nothing to decide: the dice let one piece move, and it has one square to go to. In **Settings**, players can enable **Auto-play only move** (off by default), and OK then presses itself for such a move: the piece is picked up and played there ([issue 302](https://github.com/fortemate/dicechess-tv/issues/302), narrowed in [issue 360](https://github.com/fortemate/dicechess-tv/issues/360)):

- **Only the only move:** a piece with several squares is never picked up for you, even when it is the only piece that can move. An OK you press by habit only picks it up, and where it goes stays your choice.
- **A piece you pick up yourself waits for your OK,** even when it has only one square.
- **A pawn promotes on its only square:** it is picked up and played there, the _Promote to_ choice opens, and the piece is always yours to choose.
- **One step at a time:** each automatic press waits 600 ms, the computer opponent's pace, so a chain of them can be followed. With rook, rook and knight in the starting position, you choose the knight and its square; the two rook moves that follow, four presses of OK, play themselves.
- **Back stops it:** while the prompt reads _Only one choice · Back: stop_, Back stops the coming press and leaves the rest of that move to you. OK, Back or Menu at any other point of a move also leaves the rest of it to you, so a piece put down with Back stays down. The next move is automatic again.
- **Never for anything else:** it does not roll the dice, hand the turn over, play for the computer opponent, or act behind a menu or in the tutorial.
- **In 1.0.0, build 26,** which build 28 replaced, the first rule still applies: the only piece that can move is picked up even when it has several squares, and a piece in hand with one square is played there, whoever picked it up.
- The setting is saved to device storage via MMKV and read again at the next launch: the tests check it, and on the Vega Virtual Device it was still on after the app was reinstalled.

`native/test/autoSelect.test.tsx` checks each of these, through the screen's reducer and through the whole app. On a Fire TV Stick 4K Select, on October 10, 2026, a pawn with one square was played there by itself, and Back stopped a press that was coming ([pull request 342](https://github.com/fortemate/dicechess-tv/pull/342)). That was under the first rule, before issue 360 narrowed it to the only move. On the Vega Virtual Device, on October 11, 2026, the narrowed rule left a lone queen with four squares for the player to pick up and send where they chose, kept a forced rook the player picked up in hand until their OK, and still played forced rook moves by itself.

### Reduced Motion Support

For players sensitive to motion or animation effects, the application detects `AccessibilityInfo.isReduceMotionEnabled`. When enabled:

- Piece moves draw immediately at their destinations rather than sliding across the board.
- Dice land instantly without 3D tumbling animations.
- The board flips immediately between turns in a game against a friend without fading out and back in.

Only unit tests cover this (`native/test/boardMotion.test.tsx`). On the Vega Virtual Device the query answers no, and there is no setting to change it; whether a Fire TV Stick offers the setting is not yet checked ([Performance](/technology/performance/)).

### VoiceView (Screen Reader)

VoiceView, Fire TV's screen reader, reads what holds the platform's focus. Dice Chess keeps its own: the arrows move a cursor and a highlight that the game draws, so VoiceView alone would find nothing to read. So while VoiceView is on, the game tells it in words what changed, through React Native's `AccessibilityInfo` announcements ([issue 257](https://github.com/fortemate/dicechess-tv/issues/257)):

- **Menus and choices:** the name of a menu as it opens, its note if it has one, then the focused item and its place: _Dice Chess. Play a friend, 1 of 6._ Moving the focus says the item, _Play the computer, 2 of 6_, and a setting changed where the focus stands says its new value, _Sounds: off_. The confirmations, the choice of color and of promotion, the offer of the tutorial and _What next?_ after a game work the same way.
- **The choice of opponent:** each card's name, level and line on how it plays: _Rolly, Easy. Plays any legal turn, at random, 1 of 3._
- **The board:** the square under the cursor, what stands on it and the mark the board shows there, since the board draws no coordinates: _g1, white knight, can move_; _f3, empty, can go here_; _d5, black knight, can take_.
- **The game:** each roll and the dice no move can use; each move, by the person, the friend or the computer; a turn that is over and whose turn comes next; and the result. Against Rolly a turn sounds like this: _Rolly's turn. Rolly rolled queen, rook and knight. The queen can't be used. Rolly moved the knight from g8 to f6. Rolly moved the rook from h8 to g8. Your turn. OK: roll three dice._ The result uses the words on screen: _Rolly wins. You resigned._
- **The prompts that ask for a press:** _OK: roll three dice_, _OK: move the knight here_, _OK: Black's turn_.
- **The rules reference:** the topic and its text, as the focus moves.
- **Short, and in order:** a move of the focus cuts short whatever is being said, so a held arrow is heard where it stops rather than square by square. The steps of a game wait their turn, so none of the computer's moves is lost.

Squares, dice, menu items and opponent cards also carry accessibility labels and roles, with the volume settings as sliders and the on/off settings as switches. No element is made focusable for the platform: on Vega that would hand the arrows to the system's focus instead of the game's. No title carries a heading role either: VoiceView reads a heading by itself as it appears, and on the Virtual Device that cut off the result announced just before it. The words come from `src/core/announcements.ts`, the same module that words the result on screen. Nothing is worked out while VoiceView is off.

Not covered yet: the tutorial, which Thinkle speaks aloud anyway, About, and the screen shown after an error.

Unit tests check the wording against the engine and, with `AccessibilityInfo` stubbed, when each line is said: the home menu, a held arrow, a setting, a game against a friend, a turn of the computer's, a resignation and its result, and the rules reference (`test/announcements.test.ts`, `native/test/screenSpeech.test.ts`, `native/test/voiceView.test.tsx`).

On the Vega Virtual Device, on October 11, 2026, VoiceView was turned on with the `inputd-cli` hold of Back and Menu ([FL-29](/developer-experience/friction-log/#fl-29)) and its speech was recorded with `vvd record`. With D-pad and OK: the home menu, Settings with two settings changed, the choice of opponent, two rolls that could not be used, a turn of Rampage's, a turn of the person's with the cursor moved and a pawn played, the Resign confirmation and the result of a game against the computer and of one against a friend, and the rules reference. Each press was followed by speech of the expected length and pauses, the computer's lines were queued, not lost, and with VoiceView off a press was silent. No transcript was made: the timing is the evidence, and the words were not checked by ear. The Virtual Device could not check a held arrow, since the driver's hold sent no repeats. Nothing has been checked with VoiceView on a Fire TV Stick yet.
