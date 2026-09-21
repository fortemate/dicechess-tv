# Browser feasibility probe

## Purpose and boundary

This is the web portion of the proposed Vega WebView experiment. It uses Svelte, Chessground, the canonical engine rules entry and the full engine inside a dedicated module Worker. It does not include a React Native/Vega shell or a VPKG.

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

Escape and Backspace are browser stand-ins for Back. Vega's actual system Back delivery and focus behavior must be verified through the SDK; browser key handling does not prove that mapping.

A cyan outline shows cursor focus; dashed yellow outlines show legal destinations. Pieces use system Unicode glyphs, whose appearance and availability must also be checked in Vega.

## State and failure behavior

The versioned diagnostic save contains the validated human/bot action sequence. Position, fixed dice and phase are reconstructed with the same pinned engine. Illegal or incompatible saves display an error and require explicit restart from the menu. A failed storage write must not advance the visible game state.

Worker requests carry IDs and the requested DFEN. Restart terminates the current Worker and invalidates its request; responses are checked against the current position. A 10-second watchdog reports a failure without substituting a remote or main-thread bot. This is a failure guard, not the bot's search budget.

The UI heartbeat is a diagnostic counter, not a performance benchmark. The probe does not measure real Stick latency or bot strength.

## Verified on 21 September 2026

- macOS arm64, Node 26.8.2; npm install completed with zero reported vulnerabilities.
- Svelte/TypeScript diagnostics: zero errors and warnings.
- Three Node tests passed: engine/bot transition and save round trip; invalid saves/actions; cursor edges and orientation.
- Vite production build passed and emitted separate local JS/CSS/Worker assets with relative base paths.
- In-app browser: Enter and directions completed b1-c3 and a local Random Worker reply; reload restored the moved pieces and completed phase. The Back menu, restart and cancel-selection scenario passed.
- Visual inspection caught a non-reactive board update during development; the corrected build was inspected with restored knights on their moved squares.

## Vega gate still open

The initial disk-space blocker was resolved and SDK installation completed. See the [SDK experiment](vega-sdk-experiment.md) for versions, reproducible commands and the SDK 0.24 native WebView crash and the non-crashing SDK 0.23 comparison, whose visual/gameplay checks remain open.

Remaining acceptance checklist (build/install evidence alone does not close these checks):

1. Record CLI/SDK versions and run the official Hello World in VVD.
2. Generate the official `vegaWebview` shell, then package the built web assets using the documented local-file path.
3. Verify module JS, CSS, Unicode fonts and the module Worker under the actual local-file origin. Relative Vite paths alone do not prove these work; file-origin Worker/CORS behavior may require a different packaging strategy.
4. Verify virtual-remote directions/OK/Back and avoid competing native/WebView navigation.
5. Verify save behavior across app termination and restart, including interruption before the Worker reply.
6. Install the package, disable networking, and verify cold launch, move, local reply and resume without a development server.
7. Record results and decide whether the WebView architecture is viable.

No offline cold-start or Vega compatibility claim is made by the browser results. A preview server on localhost is still a server.
