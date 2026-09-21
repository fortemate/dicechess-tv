# Browser feasibility probe

## Purpose and boundary

This is the web portion of the proposed Vega WebView experiment. It uses Svelte, Chessground, the canonical engine rules entry and the full engine inside a dedicated classic Worker. It does not include a React Native/Vega shell or a VPKG.

The fixture starts from the normal piece placement with **one remaining knight die** for White. After one legal White action, the engine ends the turn and the diagnostic supplies one knight die to Black. The local Random bot makes one reply, which is validated and saved. The probe then stops. These predetermined dice are diagnostic inputs, not the game's random-roll implementation. Full games, promotions, dice rolling, hotseat, Aggressive, W/D/L and purchases are outside this probe.

## Run

Use Node 26.8.2 (pinned in mise.toml) and npm. Dependencies come from the public npm registry; no GitHub package token is needed.

```bash
npm ci
npm run check
npm run format:check
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/. `npm run dev` is available for editing, but the browser checks below use the production build through preview.

## Keyboard-only scenario

1. Initial cursor is b1. Press Enter to select the knight.
2. Press Up, Up, Right to focus c3, then Enter.
3. Observe the white knight on c3, a legal black knight reply, phase `done` and a validated Worker result.
4. Reload. Both moved pieces and phase `done` must be restored; no second bot reply is applied.
5. Press Escape to open the menu, Down to select Restart diagnostic, and Enter.
6. Select b1 with Enter, then Escape. Selection clears without making a move.
7. With no selection, Escape opens/closes the menu; directions and Enter operate it.

Escape and Backspace are browser stand-ins for Back. Vega delivers `GoBack`, normalized to Escape by the input handler; this was observed using SDK-injected virtual-remote input. A physical remote remains untested.

A cyan outline shows cursor focus; dashed yellow outlines show legal destinations. Pieces use system Unicode glyphs, whose appearance and availability must also be checked in Vega.

## State and failure behavior

The versioned diagnostic save contains the validated human/bot action sequence. Position, fixed dice and phase are reconstructed with the same pinned engine. Illegal or incompatible saves display an error and require explicit restart from the menu. A failed storage write must not advance the visible game state. Saves now use IndexedDB with `durability: 'strict'`; the app waits for transaction completion before showing a committed move or starting the bot. Input is paused during load/write, and the Worker watchdog is stopped once a validated response enters its save transaction. The UI exposes Loading/Saving/Committed/Restored/Failed status.

On first load, an existing localStorage snapshot is validated and copied into IndexedDB before use. Thereafter the database is authoritative, including an explicit reset. The old entry is retained for rollback and never supersedes an existing database snapshot. Corrupt data causes an explicit error; unsupported strict transactions are rejected rather than silently downgraded.

Worker requests carry IDs and the requested DFEN. Restart terminates the current Worker and invalidates its request; responses are checked against the current position. A 10-second watchdog reports a failure without substituting a remote or main-thread bot. This is a failure guard, not the bot's search budget.

The UI heartbeat is a diagnostic counter, not a performance benchmark. The probe does not measure real Stick latency or bot strength.

## Verified on 21 September 2026

- macOS arm64, Node 26.8.2; npm install completed with zero reported vulnerabilities.
- Svelte/TypeScript diagnostics: zero errors and warnings.
- The original three Node tests passed: engine/bot transition and save round trip; invalid saves/actions; cursor edges and orientation.
- Vite production build passed and initially emitted separate local JS/CSS/Worker assets. The follow-up embeds a classic Worker and adds a single-HTML packaging command for Vega.
- In-app browser: Enter and directions completed b1-c3 and a local Random Worker reply; reload restored the moved pieces and completed phase. The Back menu, restart and cancel-selection scenario passed.
- Visual inspection caught a non-reactive board update during development; the corrected build was inspected with restored knights on their moved squares.

## Vega gate still open

The initial setup and local-file loading blockers were investigated on the same MacBook Air. See the [SDK experiment](vega-sdk-experiment.md) for the native 0.24 crash, the 0.23 comparison, file-origin restrictions and observed gameplay.

Build the web payload for the external Vega shell:

```bash
npm run build:vega-web
# Copy dist-vega/index.html to the shell's assets/index.html, then rebuild its VPKG.
```

This command embeds the bundled module and CSS into HTML. The bot uses Vite's inline Worker import with IIFE output, producing a separate classic Worker from bundled code instead of a file URL. No security flags, web server or main-thread fallback are needed. The script expects one JS entry and one stylesheet and fails if that build structure changes. It is a narrow probe packager, not a general asset inliner. The roughly 740 kB JS bundle triggers Vite's size warning; optimization is deferred.

SDK 0.23 runtime diagnostics and the owner's manual test confirmed the board, input, a legal human action and a local bot reply. `GoBack` opens the menu. Following the storage change, three forced-stop/relaunch runs restored the exact DFEN and `done` phase. With both emulated network links disabled, cold launch, b1-a3, a local reply and restore passed; the external connectivity control failed during the offline window and succeeded before/after. See [durable save and offline verification](durable-save-and-offline.md) for the method and limits.

Remaining acceptance checklist:

1. Adopt and review a reproducible native shell/package in the repository, including SDK-template licensing and dependencies.
2. Resolve SDK 0.24 compatibility or choose a supported release target with evidence.
3. Extend save/recovery testing to full games, interrupted bot work, promotions and real dice rolls as those features are implemented.
4. Test real Fire TV hardware, its physical remote, fonts, sizing and performance.
5. Build the full hotseat/Random game loop; this probe is still a fixed two-action fixture.

The offline result applies to the installed diagnostic on the tested VVD image. It is not a physical-device, power-loss or Appstore-readiness claim.
