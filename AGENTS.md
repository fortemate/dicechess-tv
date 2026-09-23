# Agent guidance

Dice Chess TV is a Fire TV game on Vega OS. The application is `native/`, a React Native for Vega package that builds in this repository; `src/core/` is the shared pure controller it runs on. Read README.md for the agreed scope, and keep claims about verified runtime behavior separate from intentions.

## Repository-specific guidance

- The product is the native React Native for Vega application in `native/`. The Svelte + Chessground WebView probe that preceded it has been removed; `docs/` keeps its findings, and nothing should be rebuilt on it.
- Keep `src/core/` pure. It is compiled with `lib: ES2022` and `types: []`, so a DOM or Node global there is a build failure, not a style question. Platform code belongs in `native/src/`.
- Evidence from the Vega Virtual Device is not evidence from a Fire TV Stick, and neither is a passing test. Say which one a claim rests on.
- Keep Dice Chess rules in the canonical engine; render state and emit action intent from the board.
- Preserve the dice roll and full turn phase across saves and lifecycle events.
- Keep bot strength determined by algorithm/work budget, not elapsed wall-clock time.
- Verify every required action with D-pad, OK and Back. Mouse interaction alone is not TV validation.
- Audit licenses before importing code or assets. Do not silently select a license or treat private visibility as a license exemption.
- Before editing, inspect `git status`. Preserve unrelated changes and stage explicit paths only.
- Run `npm run check`, `npm run lint`, `npm run format:check`, `npm test` and `git diff --check` at the root, and `npm run check --prefix native`, `npm run lint --prefix native`, `npm test --prefix native` and `npm run build --prefix native` for the application. Use the Node version in mise.toml.
- For anything that changes what the television shows or how it responds, build the package and run it on a device: `npm run build --prefix native`, then `vega device install-app` and `launch-app`. A green gate has shipped a broken build before — a first-render fault that swallowed every key press passed every check. The device has no screenshot command, so have the app report what it built rather than trusting what you assume it painted.
- Work on branches and pull requests. Never merge, release, publish to Appstore or submit a contest entry without the required owner action/authorization.

## Publication boundary

<!-- dc-shared:publication v4 — keep identical across Fortemate repositories -->

- Fortemate is open-core. Public by nature, in the public repositories: their source (engine rules
  and search, feature definitions and extractors, bot templates, the play client and server), serving
  contracts, mechanics, and the programme numbers already published in the project READMEs. Private
  repositories (evaluation service, training pipelines, proprietary evaluators, house bots, analytics,
  infrastructure) stay private in full; this rule governs what may be written into the public ones.
- Always private, wherever it is written: trained weights, opening books, labelled corpora, production
  parameter **values** (search profiles, candidate limits, table sizes, blend weights, time budgets),
  experiment **verdicts** (win rates, feature importance, cost ratios, negative results) and the names
  of private artifacts, hosts and internal paths.
- Before writing to a public repository — code, docs, scaladoc, commit messages, Issues, pull requests,
  review replies — check the text against that list. Values and verdicts go to the private knowledge
  base (`fortemate-internal`, a private repository agents read and write through the owner's access;
  naming it is the address, not a disclosure) and are referenced from public text by page title only;
  examples use placeholders such as `<candidate-limit>` instead of real values.
- The rule is forward-only (ADR 009): nothing already published is retracted and history is never
  rewritten. When unsure whether something is a definition or a verdict, ask the owner before
  publishing.

<!-- /dc-shared:publication -->

## Issue management

<!-- dc-shared:issue-management v7 — keep identical across Fortemate repositories -->

- Classify work with the native GitHub Issue Type: `Bug` (unexpected or incorrect behavior), `Feature` (request, idea, new user-visible capability), `Task` (a specific piece of engineering, research, maintenance or documentation work). Labels on Issues name a technical domain or cross-cutting concern only, never repeat the Type, and must already exist in the repository.
- Never commit to a repository's default branch. Name branches you control `<type>/<short-description>` or `<type>/<issue-id>-<short-description>` with a type from `task|feat|bug|refactor|chore|docs|ci|test|perf`. A branch that carries an Issue id must be closed by its pull request (`Closes #<id>`, or `Closes owner/repository#<id>` across repositories); partial work uses a non-closing reference. Before dispatching an external tool, read the repository's live PR-policy workflow: a tool-managed branch name is acceptable only when that policy allows it and the pull request closes the delegated leaf Issue — never edit a workflow to make a generated branch pass. A delegated pull request and its commits close only their leaf Issue, never a parent or sibling.
- GitHub-facing text is English-only. Every Issue has `Context`, `Objective` and a testable `Definition of Done`; create it with `gh issue create --body-file <file>`, never with an inline multi-line body, and search open and closed Issues across Fortemate repositories for duplicates first. Every actionable Issue (never a pull request) belongs to the organization Project [Fortemate Engineering](https://github.com/orgs/fortemate/projects/1); triage (Type, `Execution tier`, `Status`, `Priority`, labels, relationships, assignee) and the mandatory read-back after every mutation follow the `github-issue-workflow` skill in `fortemate-internal/skills/`.
- `jules` is a live execution trigger, not a label. Jules, Antigravity, CI, delegated subagents and any agent without the current user's explicit task-scoped authorization never apply, reapply or remove it. Dispatch qualification, monitoring, feedback (only a submitted comment starting with `@jules`; every other comment by the triggering user wakes the session too), takeover, the audit-marker rule for closed Issues and the "no bare `#N` in a spec" rule are the `jules-delegation` skill; a repository must pass the `jules-repo-readiness` skill before its first dispatch.
- The human owner reviews, approves and merges pull requests. Agents never merge pull requests or execute releases.

<!-- /dc-shared:issue-management -->

## Security

<!-- dc-shared:security v3 — keep identical across Fortemate repositories -->

- Never print, log, or commit secrets. Local secrets live only in gitignored files
  (e.g. `.env.local`, `mise.local.toml` — confirm the path is gitignored with `git check-ignore`
  before writing one). Never bypass Git hooks (`--no-verify`).
- Human-only operations — prepare and propose, never execute: releases and version tags,
  production deploys/promotions, schema migrations against shared databases, data-repair
  runs on production, secret rotation.
- Never add private infrastructure details (hostnames, IP addresses, cloud identifiers,
  topology, credentials, tokens) to code, docs, commits, or PRs — regardless of the
  repository's visibility. A private repository is not a safe place for them either;
  operator-specific details belong in an approved private runbook.

<!-- /dc-shared:security -->
