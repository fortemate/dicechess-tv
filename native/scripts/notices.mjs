// Writes, or checks, the notices of the third-party software the package ships
// (#338): licenses/THIRD_PARTY_NOTICES.txt, which generate-assets.mjs copies to
// assets/licenses/, /pkg/assets/licenses/ on the device.
//
//   node scripts/notices.mjs           check the file against the last bundle
//   node scripts/notices.mjs --write   rewrite it from the last bundle
//   node scripts/notices.mjs --build   check it against the last Vega build
//
// MIT asks that its notice be included in every copy, and BSD-3-Clause that a
// binary carry it in the materials that come with it. Minifying keeps almost
// none of them, so the package carries them in a file of their own.
//
// Which packages ship is read from the bundles themselves: every source under a
// node_modules/ in a bundle's source map is a package the bundle includes.
// package.json would name too few (React Native's own dependencies) and too
// many (what is only built with). `npm run bundle` writes Metro's source map
// beside its bundle, without the Vega SDK. The Vega build bundles differently:
// it leaves most of React Native for Vega, React and the packages built on them
// to the device, which has them as system bundles
// (build/lib/rn-bundles/Release/system-bundle-app-dependencies.json), and it
// adds what BUILD_ADDS names. The notices name both sets, so they hold for
// either.
//
// `npm run bundle`, which CI runs, checks the file against Metro's bundle and
// BUILD_ADDS, and `mise run build` checks that the Vega build's bundle has
// nothing the file does not name. Either fails until the file is rewritten and
// reviewed.
//
// Each package's licence is its own LICENSE file, with trailing spaces trimmed.
// A package that ships none takes the text of the repository it comes from.
// Fortemate's own packages are not third-party, and are left to the notices of
// the game itself.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const NOTICES = 'licenses/THIRD_PARTY_NOTICES.txt';
export const SOURCE_MAP = 'build/metro/index.bundle.map';
// The source map of the bundle `react-native build-vega` packages.
export const BUILD_SOURCE_MAP =
  'build/debugging/Release/srcmap/index.bundle.map';

// What the Vega build adds to the app's bundle and Metro's does not have: the
// module map that Amazon's kepler-compatibility-metro-config puts at its top.
const BUILD_ADDS = ['@amazon-devices/kepler-compatibility-metro-config'];

// Shipped beside the notices, unchanged: Amazon's notices for the MMKV native
// library, lib/<arch>/libreact-native-mmkv-kepler.so in every package, which
// list Tencent's MMKV and what it is built from. They are long, and they are
// Amazon's to word.
export const NATIVE_NOTICES = [
  {
    package: '@amazon-devices/react-native-mmkv',
    from: 'node_modules/@amazon-devices/react-native-mmkv/LICENSE-THIRD-PARTY',
    to: 'react-native-mmkv-LICENSE-THIRD-PARTY.txt',
  },
];

// Packages that ship no LICENSE file of their own, and the file that has their
// text. Both are Meta's MIT notice: React Native's repository has it for its
// @react-native/* packages, and Metro's (v0.83.8) has the same text, byte for
// byte, for metro-runtime.
const SHARED_TEXT = [
  [/^@react-native\//, 'node_modules/react-native/LICENSE'],
  [/^metro-runtime$/, 'node_modules/react-native/LICENSE'],
];

// Amazon's packages are under its Program Materials License Agreement. Three
// are built on open-source projects whose notice they do not all carry, so the
// project's notice follows Amazon's.
const AMAZON = '@amazon-devices/';
const AMAZON_LICENCE = 'Amazon Program Materials License Agreement';
const UPSTREAM = {
  // React Native 0.83, as its version, 4.0.1+rn0.83.0, says. Its files carry
  // Meta's MIT header and name a LICENSE the package does not have.
  '@amazon-devices/react-native-kepler': {
    project: 'React Native',
    from: 'node_modules/react-native/LICENSE',
  },
  // react-native-svg 15.11.1. Amazon ships its notice.
  '@amazon-devices/react-native-svg': {
    project: 'react-native-svg',
    from: 'node_modules/@amazon-devices/react-native-svg/THIRD_PARTY_NOTICES.txt',
  },
  // react-native-mmkv 3.0.2, whose LICENSE Amazon does not ship. Copied from
  // github.com/mrousavy/react-native-mmkv at tag v3.0.2 (8d0b764).
  '@amazon-devices/react-native-mmkv': {
    project: 'react-native-mmkv',
    from: 'licenses/upstream/react-native-mmkv.LICENSE',
  },
};

const FIRST_PARTY = '@fortemate/';

// Paths and names in code-unit order, the same on every machine and locale.
const inOrder = (a, b) => (a < b ? -1 : Number(a > b));
const byName = (a, b) => inOrder(a.name, b.name);

// The package each source belongs to: the name after its last node_modules/,
// and the directory that ends with it.
export const packagesIn = (sources) => {
  const found = new Map();
  for (const source of sources) {
    const at = source.lastIndexOf('node_modules/');
    if (at < 0) continue;
    const parts = source.slice(at + 'node_modules/'.length).split('/');
    const name = parts[0].startsWith('@')
      ? `${parts[0]}/${parts[1]}`
      : parts[0];
    if (name.startsWith(FIRST_PARTY)) continue;
    const dir = source.slice(0, at + 'node_modules/'.length + name.length);
    if (!found.has(name)) found.set(name, new Set());
    found.get(name).add(dir);
  }
  return [...found.entries()]
    .map(([name, dirs]) => ({ name, dirs: [...dirs].sort(inOrder) }))
    .sort(byName);
};

// The packages the notices name: those of Metro's bundle, and what the Vega
// build adds.
export const shippedPackages = (sources, root = native) => {
  const found = packagesIn(sources);
  for (const name of BUILD_ADDS)
    if (!found.some((one) => one.name === name))
      found.push({ name, dirs: [join(root, 'node_modules', name)] });
  return found.sort(byName);
};

// A licence as it is printed: line endings, trailing spaces and blank lines at
// either end are tidied, the words are not touched.
const tidy = (text) =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

const licenceFile = (dir) =>
  readdirSync(dir).find((file) => /^licen[cs]e(\.(md|txt))?$/i.test(file));

// The licence text of one copy of a package, and what it is called.
const licenceOf = (name, dir, root) => {
  const own = licenceFile(dir);
  let text;
  if (own) text = readFileSync(join(dir, own), 'utf8');
  else {
    const shared = SHARED_TEXT.find(([pattern]) => pattern.test(name));
    if (!shared)
      throw new Error(
        `${name} ships no LICENSE file: say in SHARED_TEXT in scripts/notices.mjs where its text is`,
      );
    text = readFileSync(join(root, shared[1]), 'utf8');
  }
  const { license } = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  );
  const called = name.startsWith(AMAZON) ? AMAZON_LICENCE : license;
  if (typeof called !== 'string' || /^see licen[cs]e/i.test(called))
    throw new Error(`${name}: no licence named in its package.json`);
  return { called, text: tidy(text) };
};

const RULE = '='.repeat(78);
const THIN = '-'.repeat(78);

const HEADER = `Dice Chess: third-party software notices

Generated by native/scripts/notices.mjs from the app's bundles. Do not edit:
run \`npm run notices --prefix native\` instead.

Dice Chess includes the software below, written by others. Each package is
named with its licence, and followed by that licence as the package gives it.
Some of it, most of React Native for Vega among it, the device may provide
rather than the app; it is named here either way.

The MMKV native library that comes with the app has notices of its own, in
${NATIVE_NOTICES.map((notice) => notice.to).join(', ')}, beside this file.`;

// The whole file, for the packages a bundle includes.
export const noticesFor = (packages, root = native) => {
  const sections = packages.map(({ name, dirs }) => {
    // Two copies of one package may differ in their notice; each is kept.
    const licences = [];
    for (const dir of dirs) {
      const licence = licenceOf(name, dir, root);
      if (!licences.some((known) => known.text === licence.text))
        licences.push(licence);
    }
    const parts = [
      RULE,
      name,
      [...new Set(licences.map((licence) => licence.called))].join(', '),
      THIN,
      licences.map((licence) => licence.text).join(`\n\n${THIN}\n\n`),
    ];
    const upstream = UPSTREAM[name];
    if (upstream)
      parts.push(
        '',
        `Built on ${upstream.project}, whose notice follows.`,
        '',
        tidy(readFileSync(join(root, upstream.from), 'utf8')),
      );
    return parts.join('\n');
  });
  return `${[HEADER, ...sections].join('\n\n')}\n`;
};

// The packages named in a notices file, in its order.
export const packagesNamed = (notices) =>
  [...notices.matchAll(new RegExp(String.raw`^${RULE}\n(.+)$`, 'gm'))].map(
    (match) => match[1],
  );

const sourcesOf = (path, hint) => {
  const map = join(native, path);
  if (!existsSync(map)) throw new Error(`${path} is missing: ${hint}`);
  return JSON.parse(readFileSync(map, 'utf8')).sources;
};

// After a Vega build: every package its bundle includes must be named.
const checkBuild = () => {
  const named = packagesNamed(readFileSync(join(native, NOTICES), 'utf8'));
  const built = packagesIn(
    sourcesOf(BUILD_SOURCE_MAP, 'run npm run build first'),
  );
  const missing = built
    .map((found) => found.name)
    .filter((name) => !named.includes(name));
  if (missing.length) {
    console.error(
      [
        `${NOTICES} does not name what the Vega build bundled: ${missing.join(', ')}`,
        'Add it to BUILD_ADDS in native/scripts/notices.mjs, rewrite the file with',
        '`npm run notices --prefix native`, and review the diff.',
      ].join('\n'),
    );
    process.exit(1);
  }
  console.log(
    `notices: the Vega build's ${built.length} packages are all in ${NOTICES}`,
  );
};

// Only when run as a script, so a test can import the pieces above.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes('--build')) {
    checkBuild();
    process.exit(0);
  }
  const packages = shippedPackages(
    sourcesOf(SOURCE_MAP, 'run npm run bundle first'),
  );
  for (const notice of NATIVE_NOTICES)
    if (
      packages.some((found) => found.name === notice.package) &&
      !existsSync(join(native, notice.from))
    )
      throw new Error(`${notice.from} is missing`);
  const written = noticesFor(packages);
  const target = join(native, NOTICES);
  if (process.argv.includes('--write')) {
    writeFileSync(target, written);
    console.log(`notices: ${packages.length} packages -> ${NOTICES}`);
  } else if (!existsSync(target) || readFileSync(target, 'utf8') !== written) {
    const named = existsSync(target)
      ? packagesNamed(readFileSync(target, 'utf8'))
      : [];
    const gained = packages
      .map((found) => found.name)
      .filter((name) => !named.includes(name));
    const lost = named.filter(
      (name) => !packages.some((found) => found.name === name),
    );
    console.error(
      [
        `${NOTICES} does not match the packages in the bundle.`,
        gained.length
          ? `  in the bundle, not in the file: ${gained.join(', ')}`
          : '',
        lost.length
          ? `  in the file, not in the bundle: ${lost.join(', ')}`
          : '',
        !gained.length && !lost.length ? '  a licence text changed' : '',
        'Rewrite it with `npm run notices --prefix native`, and review the diff.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    process.exit(1);
  } else
    console.log(`notices: ${packages.length} packages, ${NOTICES} matches`);
}
