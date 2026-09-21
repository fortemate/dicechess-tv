// Package this small diagnostic as one local HTML document for Vega WebView.
// Vite's worker&inline import keeps the bot in a separate Blob-backed Worker.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('dist-vega');
const entry = resolve(directory, 'index.html');
let html = await readFile(entry, 'utf8');
const scripts = [
  ...html.matchAll(
    /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  ),
];
const styles = [
  ...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g),
];
if (scripts.length !== 1 || styles.length !== 1) {
  throw new Error('Expected one bundled entry script and one stylesheet');
}
for (const [tag, relative] of [...scripts, ...styles]) {
  const path = resolve(directory, relative);
  if (!path.startsWith(directory + '/'))
    throw new Error('Asset outside output directory');
  const content = await readFile(path, 'utf8');
  const inline = tag.startsWith('<script')
    ? '<script type="module">' +
      content.replaceAll('</script', '<\\/script') +
      '</script>'
    : '<style>' + content + '</style>';
  html = html.replace(tag, () => inline);
}
await writeFile(entry, html);
console.log('Vega local HTML ready: dist-vega/index.html');
