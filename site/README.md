# The project site

The public site of Dice Chess TV, <https://fortemate.github.io/dicechess-tv/>. It
presents the project to players and judges and documents it for developers. It is
an [Astro Starlight](https://starlight.astro.build/) project, and its own npm
package with its own lockfile; `mise run setup` does not install it.
[`deploy-site.yaml`](../.github/workflows/deploy-site.yaml) builds it on every
pull request that touches `site/` and deploys it to GitHub Pages from `main`.

## Working on it

```bash
cd site
npm ci
npm run dev     # http://localhost:4321/dicechess-tv/, reloading as you edit
npm run build   # into dist/, as CI builds it
```

Install with `npm ci` here, and do not symlink `node_modules` from another
checkout. Vite resolves a symlink to its real path, outside this directory, and
Astro then fails to build — which is what a symlink into a git worktree does.

## Adding a page

Pages are Markdown in `src/content/docs/`, one directory per group of the site map
in [`astro.config.mjs`](astro.config.mjs). A group appears in the sidebar once its
directory holds a page, so a new page needs no change to the configuration;
`sidebar.order` in its frontmatter sets its place within the group. A page is
added when it has its content: nothing is published as a placeholder.

## The home page and screenshots

The home page is MDX, `src/content/docs/index.mdx`, because its cards and its
screenshot strip use Starlight's components and `astro:assets`; every other page
is plain Markdown.

Screenshots live in `src/assets/screenshots/` as 1280 x 720 PNGs, and Astro
converts them to WebP when it builds. They are captured on the Vega Virtual
Device with scripted presses of the remote, from the interface as it ships, and
the pages say so: nothing is claimed for a physical Fire TV device before it has
been tested on one (#10). Retake a screenshot when the screen it shows changes.

## The friction log

The submission cites the friction log's entries by number, so each keeps its
own anchor, written as a heading attribute: `### FL-08 · Title {#fl-08}`. Titles
may change; numbers and anchors may not, and a new entry takes the next number.
After every build, `scripts/check-friction-log.mjs` fails `npm run build` if an
anchor is lost, the numbering has a gap, or the summary table stops linking to
an entry.

## The tester pages

Two pages serve the tester round
([#107](https://github.com/fortemate/dicechess-tv/issues/107)) and are not part of
the site proper:

- `/check/` asks visitors to find the marked pieces on six board pictures, for
  the colour-blind check of the movable-piece mark
  ([#108](https://github.com/fortemate/dicechess-tv/issues/108),
  [#105](https://github.com/fortemate/dicechess-tv/issues/105));
- `/feedback/` is a short form for people who have played the game
  ([#109](https://github.com/fortemate/dicechess-tv/issues/109)).

**Unlisted.** They are standalone Astro pages in `src/pages/`, outside Starlight.
Nothing links to them, `astro.config.mjs` keeps them out of the sitemap, they are
not in the search index, and they ask search engines not to index them. The
repository is public, so they are not secret either.

**Answers.** Send posts the answers to the Apps Script in
[`answers-sheet/`](answers-sheet/README.md), which appends them to the owner's
Google Sheet; its README says how to set it up. The build reads the script's
address from the repository variable `FEEDBACK_URL`; without it, nothing is
sent. Both pages were checked in a browser against a local stand-in for the
script, at phone and desktop widths, and the script by its tests outside Google.
On 2026-09-26 one submission from the published check page reached the deployed
script and the owner's sheet, and the page read the script's reply
([#109](https://github.com/fortemate/dicechess-tv/issues/109)).

**The pictures** in `src/assets/check/` are Release builds on the Vega Virtual
Device, one hotseat game played on through three builds that differ only in the
mark. A worked example, `example.png`, comes first: it is the position the
legends are cut from, not a scored picture.
[`src/check/items.ts`](src/check/items.ts) lists what each picture shows and
scores an answer; the marked squares were read from the pictures' pixels and
checked by eye. [`scripts/check-results.mjs`](scripts/check-results.mjs)
summarises the answers.

## The icon

The logo, the favicon and the picture on the home page are the app icon,
`native/icon/icon-512.png`, read from there rather than copied. It is Fortemate's
artwork, not licensed under the AGPL; [its README](../native/icon/README.md) says
where it comes from.

## Formatting

Prettier formats the site with the rest of the repository: `npm run format` at the
root, and the Git hooks on each commit. The root's `prettier-plugin-astro` lets it
format the Astro components as well.
