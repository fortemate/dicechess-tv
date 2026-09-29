---
title: How to play
description: The rules of Dice Chess on Fire TV, from three-dice turns and maximal use to king capture, castling, and promotion.
sidebar:
  order: 1
---

Dice Chess keeps the traditional chess pieces and the way they move, but introduces three dice to decide which pieces may act each turn. Luck gives newcomers a real chance of winning against experienced players, while skill determines how effectively you use the rolls and protect your king.

Every rule described below is enforced by Fortemate's canonical rules engine, [`@fortemate/dicechess-engine`](https://github.com/fortemate/dicechess-engine).

## The Turn & The Three Dice

At the start of your turn, you roll three dice. Each die displays a piece symbol:

- **P** — Pawn
- **N** — Knight
- **B** — Bishop
- **R** — Rook
- **Q** — Queen
- **K** — King

A turn consists of up to three actions, one per die:

1. **One action per die:** Moving a piece spends the corresponding die.
2. **Duplicate dice:** If the same piece appears on more than one die (e.g. Knight, Knight, Bishop), you may move that piece type multiple times in the same turn—either moving the same piece again or moving different pieces of that type.
3. **Sequential chain:** Actions happen in sequence. Moving a pawn or knight to open a diagonal or file so that a bishop or rook can move on the next action of the same turn is standard play.

## The Maximal Use Rule

In Dice Chess, you **must use as many dice as the position legally allows**:

- You cannot choose to end your turn early to keep a piece safely where it is.
- You cannot choose a move order that leaves you with fewer total actions if an alternative order would allow you to spend more dice.
- The game's move highlighter automatically prevents actions that would illegally limit the turn's total length.

### Dimmed Dice & Empty Rolls

- **Unplayable dice dim at once:** As soon as the dice land, the engine evaluates the position. Any die that cannot be spent by any legal sequence of moves dims immediately, so you never waste time looking for moves that do not exist.
- **Empty rolls:** If no die rolled can be used by any piece on the board (which happens in about 1 in 12 rolls, and nearly 1 in 3 opening rolls), the turn passes automatically with a "No legal moves" announcement.

## No Check, No Checkmate: Capture the King

Dice Chess fundamentally redefines how games are won:

- **Capture the King to win:** A game is won immediately by taking the opponent's king.
- **No check:** A king under attack is **not** in check, and the game will not warn either player.
- **Moving into attack:** You are permitted to leave your king attacked, and you are permitted to move your king onto an attacked square.
- **No checkmate or stalemate:** There is no checkmate. Guarding your king against surprise rolls is a matter of player judgement, not a platform rule.

## Special Moves

### Castling

Castling follows standard chess geometry (the king moves two squares toward a rook, and the rook hops over to the adjacent square), with specific dice requirements:

- **Requires two dice:** Castling requires both a **King die** and a **Rook die**, and it **spends both**.
- **Counts as one action:** Even though two dice are consumed, castling counts as a single action in the turn.
- **Conditions:** Neither the king nor the chosen rook may have moved previously, and all squares between them must be empty.
- **Through attack:** Because check does not exist in Dice Chess, castling out of attack, through attack, or into attack is completely legal.

### Promotion

When a pawn reaches the eighth rank (or first rank for Black), it immediately promotes:

- **Spends a Pawn die:** Moving to the final rank uses a standard Pawn action.
- **Choice of piece:** You may choose a Queen, Rook, Bishop, or Knight.
- **Legal continuation filter:** The promotion dialog only offers piece choices that allow the remainder of your turn to remain legal according to your remaining dice.

### En Passant

- When an opposing pawn advances two squares on its first move and lands beside your pawn, you may capture it "in passing" as if it had only advanced one square.
- En passant requires a **Pawn die**.
- The capture must be made on the very next action immediately following that two-square advance; otherwise, the right is lost.

## How a Game Draws

Because king capture is required to win, stalemate and three-fold repetition do not cause automatic draws:

1. **Agreed Draw:** In a two-player hotseat game, players may agree to a draw at any time via the in-game menu.
2. **100-Halfmove Rule:** A game draws automatically when a turn concludes 100 half-moves (50 full turns per side) after the last pawn move or piece capture.
