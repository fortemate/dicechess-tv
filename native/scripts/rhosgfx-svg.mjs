// Converts a RhosGFX SVG into the JSX children of a react-native-svg <Svg>.
//
// @amazon-devices/react-native-svg accepts inline JSX elements only: it supports
// neither external .svg files (no SvgUri/SvgXml) nor CSS <style> blocks, which is
// exactly how the RhosGFX sources are authored. This module resolves each class
// into inline props. generate-pieces.mjs and generate-faces.mjs use it.
//
// The sources use only svg, defs, style, title, g, path, rect, circle, ellipse
// and polygon. Everything but <style> and <title> has a component in the Vega
// library, so no shape is approximated; anything else throws.
//
// Elements with opacity 0 are dropped: each source carries an invisible
// bounding rect that would otherwise cost a node every time it is drawn.

export const TAGS = {
  g: 'G',
  path: 'Path',
  rect: 'Rect',
  circle: 'Circle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
};

// SVG presentation attributes that need renaming for the JSX components.
const PROP = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

// `.cls-1, .cls-2 { fill: #fff; opacity: 0; }` -> { 'cls-1': {fill, opacity}, ... }
export function parseStyle(css) {
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

// The children of the source's <svg>, as JSX lines indented for a component
// body. Throws on an element the Vega library cannot draw.
export function convert(svg) {
  const css = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? '';
  const classes = parseStyle(css);
  // The sources are machine-generated and carry no comments or CDATA; the only
  // text is inside <style> and <title>. A tag stream is enough.
  const body = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1);
  const lines = [];
  let depth = 2;
  // A tag cannot contain another <, which XML forbids inside one, so a < with
  // no > stops at the next < instead of scanning to the end.
  for (const [tag] of body.matchAll(/<[^<>]+>/g)) {
    if (/^<\/?(svg|defs|style|title)[\s>]/.test(tag)) continue;
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

// The components the converted children use, for the import line: the lint
// gate rejects unused imports, and not every source has every element.
export const usedComponents = (children) =>
  Object.values(TAGS).filter((component) =>
    new RegExp(String.raw`<${component}[\s/>]`).test(children),
  );

export const viewBoxOf = (svg, file) => {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) throw new Error('No viewBox in ' + file);
  return viewBox;
};

// Code-unit order, the same on every machine; localeCompare is not.
export const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);
