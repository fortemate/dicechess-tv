// @ts-check
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

const REPOSITORY = 'https://github.com/fortemate/dicechess-tv';

// The site map agreed in #63: one sidebar group per directory of
// src/content/docs, in this order. A group appears once its directory holds a
// page, so the sidebar never lists a page that does not exist, and adding a
// page needs no change here. Pages order themselves with `sidebar.order`.
const SITE_MAP = [
  { label: 'The project', directory: 'project' },
  { label: 'Play', directory: 'play' },
  { label: 'Design', directory: 'design' },
  { label: 'Technology', directory: 'technology' },
  { label: 'Quality', directory: 'quality' },
  { label: 'Developer experience', directory: 'developer-experience' },
  { label: 'Build & contribute', directory: 'contribute' },
  { label: 'Roadmap', directory: 'roadmap' },
];

// The tester pages of #108 and #109. They are unlisted: nothing links to them,
// the owner hands their addresses to people, and they are kept out of the
// sitemap here (and ask search engines not to index them).
const UNLISTED = ['/check/', '/feedback/'];

// The Mermaid diagrams, drawn in the browser. They take Starlight's system font,
// which Mermaid has to know because it sizes each box by measuring its label,
// and the colours in src/styles/mermaid.css. The spacing is tighter than
// Mermaid's own, which suits a diagram standing alone: here a diagram shares a
// 45rem column with the text, and one drawn wider is shrunk to fit, labels and
// all.
const MERMAID = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif",
  themeVariables: { fontSize: '14px' },
  themeCSS: readFileSync(
    new URL('./src/styles/mermaid.css', import.meta.url),
    'utf8',
  ),
  flowchart: {
    nodeSpacing: 24,
    rankSpacing: 36,
    padding: 12,
    wrappingWidth: 320,
  },
};

/** @param {string} directory */
function hasPages(directory) {
  const path = new URL(`./src/content/docs/${directory}/`, import.meta.url);
  return (
    existsSync(path) &&
    readdirSync(path, { recursive: true }).some((file) =>
      /\.mdx?$/.test(String(file)),
    )
  );
}

export default defineConfig({
  // GitHub Pages serves the site at fortemate.github.io/dicechess-tv/. `site`
  // is what canonical links and the sitemap point at, so it names the address
  // that actually serves the pages.
  site: 'https://fortemate.github.io',
  base: '/dicechess-tv',
  markdown: {
    // Heading attributes, `### Title {#id}`, give a heading an anchor of its
    // own choosing. The friction log's entries are cited from outside by
    // number, #fl-01 to #fl-21, so their anchors must not follow their titles.
    processor: satteri({ features: { headingAttributes: true } }),
  },
  integrations: [
    mermaid({ mermaidConfig: MERMAID }),
    starlight({
      title: 'Dice Chess TV',
      description:
        'Dice Chess for Amazon Fire TV: chess with a roll of the dice, played on one remote or against an on-device bot.',
      // The app icon, read from where the app keeps it rather than copied:
      // native/icon/README.md says where it comes from and why it is not
      // licensed under the AGPL. The alt text is empty because the site title
      // follows it.
      logo: { src: '../native/icon/icon-512.png', alt: '' },
      customCss: ['./src/styles/theme.css'],
      social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY }],
      editLink: { baseUrl: `${REPOSITORY}/edit/main/site/` },
      lastUpdated: true,
      // Points the favicon at the same icon; see the file.
      routeMiddleware: './src/routeData.ts',
      sidebar: SITE_MAP.filter(({ directory }) => hasPages(directory)).map(
        ({ label, directory }) => ({
          label,
          items: [{ autogenerate: { directory } }],
        }),
      ),
    }),
    // Starlight adds this integration itself unless the configuration already
    // has it; it is added here only to leave the tester pages out.
    sitemap({
      filter: (page) => !UNLISTED.some((path) => page.endsWith(path)),
    }),
  ],
});
