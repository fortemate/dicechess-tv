# Offline game scope

Status: requirements and implementation plan, agreed on 21 September 2026. No gameplay or bot capability is implemented by this document.

## Accepted product requirements

- Hotseat and play against several local bots.
- Initial game without stake doubling or coins. Do not add a wallet, purchased currency, betting flow or coin-based score.
- Bot choices span a simple random opponent through an aggressive opponent.
- Every bot runs on the device without internet access. Never fall back to a remote search service.
- Track local wins, draws and losses (W/D/L).
- Hunter may be added if feasible; selling it as an optional purchase is an idea to investigate, not a release commitment.

## Bot roster and integration

| Bot | Intended role | Delivery status |
| --- | --- | --- |
| Random | Easy opponent choosing among engine-approved legal actions or turns | First bot to implement; specify the sampling policy explicitly |
| Aggressive | More challenging opponent using a compatible local search implementation | Initial roster target; validate runtime cost and actual strength |
| Hunter | Optional advanced opponent | Conditional extension after compatibility, performance and licensing review |

Random and Aggressive are product labels, not a measured strength ranking. Choose a concrete algorithm/version for each and evaluate them before claiming skill levels. An intermediate bot can be considered later; it is not required for the first roster.

Use one bot interface around canonical game state and complete-turn semantics. The adapter must handle dice phases correctly and validate returned actions with the engine. Run expensive work off the UI thread. Include a request ID and state version so late responses cannot alter a restarted or resumed game.

Keep search effort defined by algorithm/work budget rather than elapsed time. A watchdog may detect a failure, but must not silently change the selected difficulty. Record bot identity, implementation version and difficulty with each game; use seeds in reproducible tests.

Package all required executable code and approved assets locally. Test a cold start, a complete game, save/resume and statistics with networking disabled. A working development server or warm browser cache is not offline evidence.

## Local statistics

W/D/L is the accepted feature. The following are proposed MVP defaults, to refine during implementation:

- Against bots, show wins/draws/losses from the human player's perspective, both overall and per bot/difficulty.
- Keep hotseat separate: show Player 1 wins, draws and Player 2 wins using stable local seats rather than mixing them into the human-versus-bot total. Personal profiles are not required initially.
- Record only completed games. A confirmed resignation is a loss for the resigning side; a closed app, unfinished save, crash or abandoned game is not automatically a loss or draw.
- Obtain terminal outcomes from the canonical engine/controller. Do not invent a draw because a search timed out or the player left.
- Store a unique game ID, mode, player seats/colors, bot ID/version/difficulty where applicable, result and completion time, with a versioned storage schema.
- Commit each final result exactly once. Reopening a finished save must not increment counters again; a rematch gets a new game ID.
- Keep statistics and active-game saves local. No account, upload, cloud sync, leaderboard or cross-device restore is required.
- Provide a confirmed reset-statistics action. Document that local data may be lost after uninstall or clearing application data; do not promise backup that does not exist.

Prefer a small completed-game ledger with derived counters, subject to the verified storage implementation. Detailed move replay and analytical reports are separate features.

## Optional Hunter purchase

First establish that a suitable Hunter implementation can run locally in the selected runtime, with acceptable memory, package size and input responsiveness. Do not assume an existing server implementation is a drop-in Web Worker module or that a simplified port retains the same strength.

If it is feasible and its distribution rights are resolved, evaluate a **one-time non-consumable unlock** rather than coins or payment per game. The product requirement remains: an installed, unlocked bot must play offline, including after restarting the application.

A purchase or restoration may require an internet connection. Verify the actual store entitlement and offline behavior before promising this model. Never make a network entitlement check a prerequisite for each move or each already-unlocked game. If reliable offline access cannot be delivered, revisit the purchase model rather than introduce a cloud bot.

Bundled code and assets are distributed to customers; repository privacy does not make the shipped implementation secret. Resolve compatibility with Chessground and all reused engine/client licenses before bundling any proprietary component. Do not copy private weights, books or production configuration as part of this planning change.

## Delivery order and evidence

1. Complete the Vega/WebView feasibility milestone from the README.
2. Finish hotseat without doubling/coins, with canonical game completion and save/resume.
3. Add Random, then Aggressive through the same local bot interface and a clear selection screen.
4. Add the local result ledger and W/D/L view; verify completion, resignation, restart, abandoned games and duplicate-result protection.
5. Test both modes and every shipped bot without networking, including cold start and resume.
6. Assess Hunter and an optional purchase only after the base roster is playable. Neither should block the core hackathon demo.

Create implementation issues with dependencies and testable acceptance criteria when implementation is scheduled. This document is the scope proposal, not a claim that those issues or features already exist.
