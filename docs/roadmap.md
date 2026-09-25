# Hackathon delivery roadmap

Agreed with the owner on 21 September 2026. This is planned work, not a completion claim.

Minimum success is **M1 + M2 + M3**: a reliable, polished, understandable offline TV game and a reviewable contest submission. Multiple themes and advanced bots are stretch goals. The existing full-game prototype is the starting point; see [verified behavior](full-game.md).

[GitHub milestones](https://github.com/fortemate/dicechess-tv/milestones) track these delivery gates. Dates are internal targets in Europe/Riga, not promises. Do not close a milestone solely because its date has arrived.

## M1 — Reliable complete games

Target: 2026-10-04.

Required minimum. Finish hotseat and offline Random games with exact save/resume, clear results, a rematch against the bot and a local completed-game ledger. Count each result exactly once across reloads; abandoned games and tutorials do not count. Separate bot W/D/L by opponent and human side; report hotseat White wins/draws/Black wins without implying player identities. Done: complete keyboard/remote games, partial-turn and terminal-state restart checks, and focused ledger regressions pass.

## M2 — TV experience and onboarding

Target: 2026-10-04.

Required minimum. Deliver one polished, legible piece set, board theme and sound set; D-pad/OK/Back throughout; clear dice, focus, legal destinations and turn handoff. Add an in-game rules guide and a skippable/replayable 3–5 minute interactive tutorial using fixed positions and rolls validated by the canonical engine. Teach remote movement, dice permissions, multi-action turns, captures and king capture; reserve castling/promotion details for reference. Tutorial never changes W/D/L or the saved real game. Audio covers move, capture, castling, promotion, roll, handoff and result, with mute and visual equivalents; do not import orthodox check/checkmate cues. Done: first-time players complete the basic flow without coaching, with readable TV-distance visuals, no focus traps and locally bundled licensed assets.

## M3 — Submission-ready build and evidence

Target: 2026-10-11.

Required minimum. Prepare a reproducible self-contained Vega package with shell sources/configuration and versioned build instructions; resolve distribution and asset licensing. Verify cold launch, complete play, save recovery and local bot operation offline; distinguish simulator evidence from physical Fire TV testing. Prepare English demo under 3 minutes, project description, reused-versus-new work, product feedback, actionable friction logs and reviewer-access checklist. Start evidence collection alongside M1/M2. Done: another person can follow build/run instructions and the submission checklist is ready for owner review. October 11 is readiness target, not actual submission; owner submission target October 21, official deadline October 23 at 19:00 UTC. Registration is already confirmed; submission and Appstore publication remain separate.

## M4 — A second local opponent

Target: 2026-10-11.

Stretch goal, only after minimum scope is secure. Add an offline Aggressive bot, opponent descriptions, human-side selection and per-bot statistics. Use algorithm/work budgets independent of elapsed time, run off the UI thread, validate all moves and retain stale-reply/restart protections. Done: reproducible scenarios demonstrate behavior distinct from Random, responsiveness is measured in Vega, and offline/restart checks pass. Do not market it as stronger without evaluation.

## M5 — Visual and audio personalization

Target: 2026-10-16.

Stretch goal. Target two piece sets, three board themes and two sound sets with remote-friendly previews, independent choices and persisted settings. Every combination must preserve piece recognition, focus/selection/legal-move contrast and silent-play usability. Bundle assets locally, record origins/licenses/attributions and check loading and responsiveness in Vega. Done: settings survive relaunch and all combinations pass visual and input review. Reduce the number of variants before compromising baseline quality.

## M6 — Optional advanced features

Target: unscheduled.

Optional; no committed deadline. Consider Hunter, advanced castling/promotion/tactics lessons or additional restrained animations only when M1–M5 are complete and verification time remains before feature freeze. Hunter requires local inference, acceptable device resource use and cleared model/distribution rights; availability is not assumed. No purchases, coins, stake doubling, accounts, online play or cloud bots in the hackathon scope. Done is feature-specific and must be defined before starting; do not delay submission for this milestone.

## Delivery order and cutoff

Implement the result ledger first, then prioritize onboarding and the single polished visual/audio experience over optional bots. Collect M3 evidence throughout development. M4 and M5 must never consume time required for M1–M3.

- Through October 4: M1 and M2.
- October 5–11: M3 readiness; M4 only if the minimum is secure.
- October 12–16: optional M5 and new-player checks.
- From October 17: feature freeze; fixes, repeat validation and final video only.
- October 21: owner submission target, leaving a buffer before October 23.

Tutorials use a separate session and fixed instructional rolls, never altering real-game randomness or statistics. Rules remain owned by the canonical engine. Artwork/sound inspiration is not permission to copy Chess.com assets. Physical Fire TV testing is desirable if hardware becomes available; simulator-only evidence must remain explicitly labeled. Appstore release is a separate future decision.
