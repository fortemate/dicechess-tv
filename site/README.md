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

## The icon

The logo, the favicon and the picture on the home page are the app icon,
`native/icon/icon-512.png`, read from there rather than copied. It is Fortemate's
artwork, not licensed under the AGPL; [its README](../native/icon/README.md) says
where it comes from.

## Formatting

Prettier formats the site with the rest of the repository: `npm run format` at the
root, and the Git hooks on each commit. It cannot parse Astro components without
`prettier-plugin-astro`, and the site has none. The pull request that adds the
first component adds the plugin too.
