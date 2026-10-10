---
title: Contributing
description: Contribution guidelines, Contributor License Agreement, pull request conventions, and repository standards.
sidebar:
  order: 3
---

We welcome contributions to Dice Chess TV. Because this project is public, open source, and participates in hackathons and official competitions, all contributions must adhere to clear licensing and quality standards.

[CONTRIBUTING.md](https://github.com/fortemate/dicechess-tv/blob/main/CONTRIBUTING.md) in the repository is the full guide; this page summarizes it.

## Contributor License Agreement (CLA)

Before a first pull request can be merged, sign the project's [Contributor License Agreement](https://github.com/fortemate/dicechess-tv/blob/main/CLA.md):

- You confirm that you are entitled to grant its licences, and that your contribution is your own work or is marked as third-party material, with its source and licence.
- You keep your copyright and grant Fortemate the right to distribute and relicense your contribution. It always stays available under the repository's licence, the GNU Affero General Public License v3.0 only (AGPL-3.0-only).
- To sign, add an entry for yourself to `.github/cla-signatures.json` in that first pull request: your GitHub username, your name, the date and the agreement's version. The `CI: CLA` check verifies it. Owners, organization members, collaborators and bots are exempt.

### Third-party work

- A new asset or library needs a licence that allows its use here, recorded in `THIRD_PARTY_NOTICES.md`. When the licence asks for credit, the line the About screen shows goes in `src/core/credits.ts`, and `test/credits.test.ts` holds the two together.
- A dependency change that brings an npm package into the app's bundle, or takes one out, makes `npm run bundle --prefix native` fail and name it. Rewrite the notices the package ships with `npm run notices --prefix native`, read the diff, and name the package in `THIRD_PARTY_NOTICES.md` and on [Credits and licences](/contribute/credits/).

## Branch and Pull Request Conventions

Branches, pull requests and issues follow the organization's [contributing guide](https://github.com/fortemate/.github/blob/main/CONTRIBUTING.md):

1. **Never commit directly to `main`:** all work happens on branches and enters `main` through pull requests, which the owner reviews and merges.
2. **Branch names:** `<type>/<short-description>`, or `<type>/<issue>-<short-description>` for work on an issue, with a type from `task`, `feat`, `bug`, `refactor`, `chore`, `docs`, `ci`, `test` or `perf` (e.g. `feat/99-dice-roll-tumble`). A branch that carries an issue number is closed by its pull request, with `Closes #<issue>`; partial work refers to the issue without closing it.
3. **Commit messages and pull requests:** in English. Explain what changed, why, and how it was checked. Say which kind of evidence a claim about the television rests on, the Vega Virtual Device, a Fire TV Stick or a test, because they are not interchangeable.

## Repository Standards

### English-Only Enforcement

The repository is written in English. A test, `test/english.test.ts`, reads every tracked file and every new file Git does not ignore, skipping binary files, and fails on any Cyrillic character. It runs with the root tests, so CI runs it, and the pre-commit hook runs it too. To run it alone:

```bash
node --experimental-strip-types --test test/english.test.ts
```

It reads files, not commit messages, issues or pull requests; keep those in English as well.

### Privacy & Infrastructure Guardrails

Never commit:

- API keys, tokens, or credentials.
- References to internal company systems, private server endpoints, or team chat logs.
- Unreleased proprietary assets or unverified audio files.

### Verification Checklist Before Opening a PR

CI runs these checks on every pull request. With mise, one command runs them, apart from coverage, the application's build and this site:

```bash
mise run check
```

Without mise, the same checks are:

```bash
# Types, lint and formatting
npm run check
npm run lint
npm run format:check
npm run check --prefix native
npm run lint --prefix native

# Tests: the core with the English-only check, the app, the test bench
npm test
npm test --prefix native
npm test --prefix web

# The whitespace of the change, the app's Metro bundle and its notices, the bench's build
git diff --check
npm run bundle --prefix native
npm run build --prefix web

# This site, after npm ci --prefix site
npm run build --prefix site
```

A green gate is not evidence of what the television shows. For anything that changes the screen or how the remote works, also build the package and run it on a device ([Build and run](/contribute/build/)).
