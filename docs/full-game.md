# Full offline game prototype

Implemented on 21 September 2026, following the one-move Vega feasibility experiment. This is still a prototype, not an Appstore release or a physical Fire TV qualification.

## Run and play

```bash
npm ci
npm run build
npm run preview
# For the external Vega SDK 0.23 shell:
npm run build:vega-web
```

Copy `dist-vega/index.html` to the external shell's `assets/index.html`, rebuild its aarch64 Release VPKG, install and launch it. The installed game uses local HTML, CSS, engine code and a classic Blob Worker; no development server is required. The external shell configuration remains described in the SDK experiment. SDK 0.24 is not claimed to work.

- Choose **Hotseat** or **Play Random** with arrows and OK. Random plays Black; the human plays White.
- OK rolls three independent dice. Each die maps 1–6 to pawn, knight, bishop, rook, queen and king. Cryptographic bytes use rejection sampling, avoiding modulo bias.
- Move the cyan cursor with arrows. OK selects a piece with a legal action; yellow destinations show where it can move. OK on a destination applies that action. Invalid choices do not change the game.
- Back cancels a selected piece or promotion choice; otherwise it opens/closes the game menu.
- If promotion has multiple legal suffixes, arrows choose the piece and OK confirms. Only engine-approved choices appear.
- The controller requires every remaining legal action before offering **OK: continue**. An unusable roll produces a pass. Hotseat tells players when to pass the remote; orientation stays White at the bottom.
- Random rolls, selects a uniformly random complete legal path from the canonical engine’s candidates in a Worker, validates and saves its reply, then returns control to White. All bot work stays local.
- The menu offers resume, confirmed resignation, hotseat draw agreement and mode selection. Replacing an unfinished game requires confirmation with Cancel selected by default. Abandonment creates no result.
- Capturing the opposing king ends play immediately. The game-service draw policy checks 100 halfmoves without a pawn move/capture at the turn boundary and imposes a 5,000-turn cap. Conventional chess checkmate, repetition or insufficient material are not added as new rules.
- A finished game remains resumable as a result screen. OK opens mode selection for another game.

## State, saves and failure handling

Schema 2 stores a game ID, mode, revision, turn number, the six-field position at the start of the current turn, the original three dice, the already played actions, phase, last move and result. Current board and remaining dice are reconstructed and validated with the pinned engine. The original roll is retained; restart cannot reroll a partial turn.

The full game uses IndexedDB `dicechess-tv.games`, key `active.v2`, separately from the old one-move diagnostic database. There is no conversion of diagnostic snapshots into games. `SnapshotStore<T>` retains the strict-durability transaction behavior and the old `SaveStore` wrapper for regression tests. A move/result becomes visible only after transaction completion. Inputs pause during writes. Failure retains the last committed state and displays an error; no weaker transaction is silently substituted.

Worker replies carry request ID, game ID, revision and exact input DFEN. Every action is revalidated; incomplete or stale paths are rejected. Leaving play or opening a menu terminates the active Worker. Resuming restarts it from the saved position and roll. A 10-second watchdog reports failure and allows retry; it does not change difficulty, choose a fallback move or declare a draw.

W/D/L is not implemented in this step. Only the active game's result is stored. A separate exactly-once completed-game ledger is the next milestone.

## Engine API compatibility

Engine 0.12.2 `DiceChess.applyMove` applies board placement, castling rights, en passant and halfmove updates, but clears its output dice field. For example, applying `a2a3` to the initial `PPN` position returns six fields. Assuming it consumed only one die prematurely ended the TV turn; the new multi-action regression caught this.

The controller therefore reads the moving piece, validates the UCI action through `getLegalUciMoves`, calls `applyMove`, and reattaches the remaining dice. A normal move removes its piece die; castling removes king and rook dice. Promotion removes the pawn die. This follows the existing play-client integration and the canonical engine's `GameState.diceAfter` / `GameFlags.consumeDiceFor` contract. Board mutation, promotion eligibility and maximal-path filtering remain engine-owned. The compatibility code is confined to `viewGame`; it should be replaced by a canonical atomic turn-step export when that API becomes available. No engine package or source was modified or published here.

Result policy follows `dicechess-play-api`'s `EngineOps.applyPath` and `GameRoom.advanceOrEnd`: immediate king-capture result, boundary halfmove test and turn cap. Source references describe public rule contracts, not copied service deployment code. Existing engine/Chessground license obligations remain; no new runtime package or artwork was added.

## Verification record

- Node 26.8.2: 20 passing tests, including three-action turns, duplicate dice, unavailable rolls, promotion, castling consumption, en passant, immediate king capture, boundary draws, turn cap, stale/incomplete replies, strict persistence failures and save reconstruction.
- A reproducible controller-driven game from the standard initial position reaches a result. Additional sequential Random paths are checked against the canonical engine over varied rolls. These are model tests, not a claim that a human played an entire natural game on a TV.
- Production browser, keyboard only: full three-action hotseat turn and handoff; Random reply and return to White; cancellation/confirmation of resignation and unfinished-game replacement; reload of partial turn and bot reply. A local test fixture exercised promotion selection/cancellation, rook underpromotion, king capture and terminal reload. Fixtures are outside the shipped build.
- Layout bounds checked at 1920×1080 with no horizontal overflow. The interface is designed for landscape TV, not a narrow phone panel.
- Vega SDK 0.23: bundled full-game launch, roll, legal D-pad actions and exact partial-turn recovery after forced process termination verified through local DOM diagnostics. Hotseat handoff, forced pass and confirmed draw agreement also passed.

- Vega offline check: both guest network links disabled for 32 seconds; an external HTTP control timed out inside the window and succeeded before/after. A preloaded guest input script cold-launched the saved game, completed two human actions, triggered a fresh three-action Random reply, forced termination and cold-launched again. The saved and restored game ID, revision, phase and DFEN matched exactly, with diagnostic events observed before networking returned. The debug reporting bridge was local; raw reports, control scripts and instrumentation are not shipped. No full natural game under network isolation or physical device is claimed.

The prior owner's manual board/move confirmation applies to the diagnostic version. This expanded UI still benefits from owner playtesting. Physical Fire TV performance, SDK 0.24 compatibility, background/foreground lifecycle beyond tested restarts, aggressive search cost and production native packaging remain open.
