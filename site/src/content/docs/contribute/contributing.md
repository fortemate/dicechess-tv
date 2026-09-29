---
title: Contributing
description: Contribution guidelines, Contributor License Agreement, pull request conventions, and repository standards.
sidebar:
  order: 3
---

We welcome contributions to Dice Chess TV. Because this project is public, open source, and participates in hackathons and official competitions, all contributions must adhere to clear licensing and quality standards.

## Contributor License Agreement (CLA)

All contributors must agree to the project's [Contributor License Agreement](https://github.com/fortemate/dicechess-tv/blob/main/CLA.md) before contributions can be merged:

- You confirm that you have the right to submit your contribution under the GNU Affero General Public License v3.0 only (AGPL-3.0-only).
- You grant Fortemate the permissions necessary to distribute, publish, and relicense the project.
- Third-party assets or libraries must have compatible licenses (e.g. CC0, MIT, Apache 2.0) and be explicitly documented in [`THIRD_PARTY_NOTICES.md`](https://github.com/fortemate/dicechess-tv/blob/main/THIRD_PARTY_NOTICES.md).

## Branch and Pull Request Conventions

1. **Never commit directly to `main`:** All work happens on dedicated topic branches and enters `main` via pull requests reviewed by maintainers.
2. **Branch naming:**
   - `feature/<issue-number>-<short-description>`: New features (e.g. `feature/99-dice-roll-tumble`).
   - `fix/<issue-number>-<short-description>`: Bug fixes and regressions.
   - `docs/<issue-number>-<short-description>`: Documentation improvements.
   - `probe/<issue-number>-<short-description>`: Throwaway experimental probes (not intended for merge).
3. **Commit Messages & PR Descriptions:**
   - Write clear, concise commit messages in English.
   - Reference corresponding issue numbers (e.g. `Fixes #99` or `Addresses #92`).
   - Explain what was changed, the rationale behind design choices, and how the change was tested.

## Repository Standards

### English-Only Enforcement

The repository strictly enforces that all text files are written in English. An automated test (`test/english.test.ts`) scans every tracked and untracked file for Cyrillic characters:

```bash
# Run the check locally
npm test -- test/english.test.ts
```

Any Cyrillic characters in code, comments, documentation, or commit messages will fail continuous integration.

### Privacy & Infrastructure Guardrails

Never commit:

- API keys, tokens, or credentials.
- References to internal company systems, private server endpoints, or team chat logs.
- Unreleased proprietary assets or unverified audio files.

### Verification Checklist Before Opening a PR

Ensure all local checks pass cleanly before submitting your pull request:

```bash
# 1. Typecheck pure core and native application
npm run check
npm run check --prefix native

# 2. Run all 193 automated tests
npm test
npm test --prefix native

# 3. Verify code formatting
npm run format:check

# 4. Verify site documentation build
npm run build --prefix site
```
