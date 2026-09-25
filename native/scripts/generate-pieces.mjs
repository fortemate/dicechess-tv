// Generates React Native piece components from the RhosGFX SVG sources.
//
// @amazon-devices/react-native-svg accepts inline JSX elements only: it supports
// neither external .svg files (no SvgUri/SvgXml) nor CSS <style> blocks, which is
// exactly how the RhosGFX sources are authored. This script resolves each class
// into inline props and emits one component per piece.
//
// The sources use only svg, defs, style, g, path, rect and circle. Everything but
// <style> is supported by the Vega library, so no shape is approximated.
//
// Elements with opacity 0 are dropped: each source carries an invisible 72x72
// bounding rect that would otherwise cost a node per piece on every board.
//
// Run: node native/scripts/generate-pieces.mjs && npm run format
// The emitted files are checked in, and npm run format:check covers native/,
// so always format after regenerating or the gate will fail.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(root, 'src', 'assets', 'pieces', 'rhosgfx');
const TARGET = join(root, 'native', 'src', 'pieces');

const TAGS = { g: 'G', path: 'Path', rect: 'Rect', circle: 'Circle' };
// SVG presentation attributes that need renaming for the JSX components.
const PROP = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

// `.cls-1, .cls-2 { fill: #fff; opacity: 0; }` -> { 'cls-1': {fill, opacity}, ... }
function parseStyle(css) {
  const classes = {};
  // Split on the braces rather than matching rules with a regular expression,
  // which would backtrack over a long run without one.
  for (const rule of css.split('}')) {
    const [selector, body] = rule.split('{');
    if (body === undefined) continue;
    const declarations = {};
    for (const part of body.split(';')) {
      const [name, value] = part.split(':').map((s) => s.trim());
      if (name && value) declarations[name] = value;
    }
    for (const name of selector.split(',')) {
      const key = name.trim().replace(/^\./, '');
      if (key) classes[key] = { ...classes[key], ...declarations };
    }
  }
  return classes;
}

function attributes(raw) {
  const out = {};
  // Each attribute follows a space, so a match can only start at one: a long
  // word without an = is scanned once, not once per character.
  for (const [, name, value] of raw.matchAll(/\s([\w:-]+)\s*=\s*"([^"]*)"/g)) {
    out[name] = value;
  }
  return out;
}

function renderProps(attrs, classes) {
  const style = classes[attrs.class] ?? {};
  const props = { ...style };
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class' || name === 'id' || name.startsWith('data-')) continue;
    props[name] = value;
  }
  return Object.entries(props)
    .map(([name, value]) => {
      const key = PROP[name] ?? name;
      const numeric = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value);
      return numeric ? `${key}={${value}}` : `${key}="${value}"`;
    })
    .join(' ');
}

function convert(svg, classes) {
  // The sources are machine-generated and carry no comments, CDATA or text
  // outside <style>, so a tag stream is enough. Anything unexpected throws.
  const body = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1);
  const lines = [];
  let depth = 2;
  // A tag cannot contain another <, which XML forbids inside one, so a < with
  // no > stops at the next < instead of scanning to the end.
  for (const [tag] of body.matchAll(/<[^<>]+>/g)) {
    if (/^<\/?(svg|defs|style)/.test(tag)) continue;
    const name = tag.match(/^<\/?([\w-]+)/)?.[1];
    if (!name || !TAGS[name]) throw new Error('Unsupported element: ' + tag);
    const component = TAGS[name];
    if (tag.startsWith('</')) {
      lines.push(' '.repeat(--depth * 2) + `</${component}>`);
      continue;
    }
    const attrs = attributes(tag);
    const style = classes[attrs.class] ?? {};
    if (style.opacity === '0') continue;
    const props = renderProps(attrs, classes);
    const open = props ? `<${component} ${props}` : `<${component}`;
    if (tag.endsWith('/>')) {
      lines.push(' '.repeat(depth * 2) + open + ' />');
    } else {
      lines.push(' '.repeat(depth * 2) + open + '>');
      depth++;
    }
  }
  if (depth !== 2) throw new Error('Unbalanced elements after conversion');
  return lines.join('\n');
}

const names = readdirSync(SOURCE)
  .filter((f) => f.endsWith('.svg'))
  // Code-unit order, the same on every machine; localeCompare is not.
  .sort((a, b) => Number(a > b) - Number(a < b));
if (names.length !== 12)
  throw new Error('Expected 12 pieces, found ' + names.length);

for (const file of names) {
  const name = file.replace('.svg', '');
  const svg = readFileSync(join(SOURCE, file), 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) throw new Error('No viewBox in ' + file);
  const css = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? '';
  const children = convert(svg, parseStyle(css));
  // Import only the elements this piece draws; the lint gate rejects unused
  // imports, and not every piece has a rect or a circle.
  const used = Object.values(TAGS).filter((component) =>
    new RegExp(String.raw`<${component}[\s/>]`).test(children),
  );
  writeFileSync(
    join(TARGET, name + '.tsx'),
    `// Generated from src/assets/pieces/rhosgfx/${file}.
// Do not edit by hand; run node native/scripts/generate-pieces.mjs instead.
// RhosGFX vector chess pieces, CC0. See licenses/RhosGFX-CC0.txt and
// THIRD_PARTY_NOTICES.md for provenance and credit.
import React from 'react';
import { ${['Svg', ...used].join(', ')} } from '@amazon-devices/react-native-svg';
import type { PieceProps } from './types';

export const ${name} = ({ size }: PieceProps) => (
  <Svg width={size} height={size} viewBox="${viewBox}">
${children}
  </Svg>
);
`,
  );
  console.log('wrote', name + '.tsx');
}

const letters = names.map((f) => f.replace('.svg', ''));
writeFileSync(
  join(TARGET, 'index.ts'),
  `// Generated by node native/scripts/generate-pieces.mjs. Do not edit by hand.
${letters.map((n) => `import { ${n} } from './${n}';`).join('\n')}
export type { PieceProps } from './types';

// Keyed by FEN piece letter: uppercase is White, lowercase is Black.
export const PIECES = {
${letters
  .map((n) => `  ${n.startsWith('w') ? n[1] : n[1].toLowerCase()}: ${n},`)
  .join('\n')}
} as const;
`,
);
console.log('wrote index.ts for', letters.length, 'pieces');
