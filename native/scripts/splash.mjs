// The native launch splash (#289): "Thinkle conjures", chosen by the owner on
// 2026-10-08 as a still. Thinkle sits in an ivory-rimmed medallion, the app's
// portrait language; three chess dice float on a dotted orbit beside him; "Dice
// Chess" leads on the left in Titan One; the Fortemate mark and its name sit
// together as the developer credit (BRAND.md prefers the mark with the name).
//
// One frame, because Vega loops the whole archive whatever desc.txt asks for:
// a still cannot repeat or be cut halfway. ../splash/README.md has the reasons,
// the sizes and the provenance of every input.
//
// Build-time only: the rasterizer, the fonts and Thinkle's vector stay out of
// the package; the device gets one PNG.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
// The game's own pieces, which the board draws too. They live with the shared
// sources, outside the native package, so they are found from this script.
const PIECES = join(here, '../../src/assets/pieces/rhosgfx');

const uri = (bytes, mime) => `data:${mime};base64,${bytes.toString('base64')}`;
const f = (v) => +v.toFixed(2);

// THEME in src/theme.ts: background, die face and cursor. The test reads the
// background back from the frame, so a change there fails until both agree.
const BACKGROUND = '#122737';
const IVORY = '#f4ead8';
const CYAN = '#00eaff';
const GOLD = '#f2b33d';
// The portraits' own outline navy, round the dice so they hold over Thinkle.
const INK = '#01082e';
// Thinkle's square background in his portrait, so the medallion is the same
// sky blue with or without it.
const SKY = '#d2e0ee';

// The medallion on screen, and the circle of the 2048-unit portrait it shows.
export const MEDALLION = { cx: 1422, cy: 546, r: 384, rim: 12 };
const CROP = { cx: 1030, cy: 1030, r: 900 };
const scale = MEDALLION.r / CROP.r;
const px = (u) => MEDALLION.cx + (u - CROP.cx) * scale;
const py = (v) => MEDALLION.cy + (v - CROP.cy) * scale;

// Titan One 400, two lines centred on the credit's axis. At 208 px its cap
// height is about 148 px, and "Chess" ends clear of the knight die.
export const TITLE = { x: 438, size: 208, track: -3, base: [410, 606] };
// The mark at 56 px, a multiple of its 14-unit canvas, so its 16 px cells and
// 4 px gaps land on whole pixels. The name is plain Arimo, as on the web.
export const CREDIT = {
  x: 258,
  base: 912,
  size: 62,
  mark: 56,
  gap: 27,
  cap: 44,
};

// Three dice on an arc concentric with the medallion: queen, knight, rook.
const DIE = 184;
const ORBIT_R = MEDALLION.r + MEDALLION.rim + 26 + DIE / 2;
export const DICE = [
  { piece: 'bQ', deg: 216, tilt: -7 },
  { piece: 'bN', deg: 180, tilt: 4 },
  { piece: 'bR', deg: 144, tilt: -5 },
].map((d) => ({
  ...d,
  x: MEDALLION.cx + ORBIT_R * Math.cos((d.deg * Math.PI) / 180),
  y: MEDALLION.cy + ORBIT_R * Math.sin((d.deg * Math.PI) / 180),
}));

function sparkle(x, y, r, fill, opacity) {
  const q = r * 0.26;
  return `<path transform="translate(${f(x)} ${f(y)})" d="M0 ${f(-r)}C${f(q * 0.5)} ${f(-q)} ${f(q)} ${f(-q * 0.5)} ${f(r)} 0C${f(q)} ${f(q * 0.5)} ${f(q * 0.5)} ${f(q)} 0 ${f(r)}C${f(-q * 0.5)} ${f(q)} ${f(-q)} ${f(q * 0.5)} ${f(-r)} 0C${f(-q)} ${f(-q * 0.5)} ${f(-q * 0.5)} ${f(-q)} 0 ${f(-r)}Z" fill="${fill}" fill-opacity="${f(opacity)}"/>`;
}

// A few sparkles by the tip of his hat.
function hatSparkles() {
  const tip = { x: px(1290), y: py(205) };
  return [
    sparkle(tip.x + 46, tip.y - 74, 28, IVORY, 0.95),
    sparkle(tip.x + 136, tip.y - 30, 15, GOLD, 0.9),
    sparkle(tip.x - 34, tip.y - 96, 12, IVORY, 0.9),
    sparkle(tip.x + 186, tip.y + 46, 10, IVORY, 0.9),
  ].join('');
}

// The orbit itself, a faint dotted arc behind the dice.
function orbitDots() {
  const dots = [];
  for (let deg = 146; deg <= 214; deg += 4.25) {
    const a = (deg * Math.PI) / 180;
    dots.push(
      `<circle cx="${f(MEDALLION.cx + ORBIT_R * Math.cos(a))}" cy="${f(MEDALLION.cy + ORBIT_R * Math.sin(a))}" r="3.5"/>`,
    );
  }
  return `<g fill="${IVORY}" fill-opacity="0.35">${dots.join('')}</g>`;
}

// A die as the game draws it: an ivory face, a half-strength cyan ring and a
// RhosGFX piece, with a thin navy outline.
function die(piece, { x, y, tilt }) {
  const h = DIE / 2;
  const r = DIE / 6;
  const ring = DIE / 36;
  const p = DIE * 0.72;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${tilt})">
    <rect x="${f(-h - 3)}" y="${f(-h - 3)}" width="${DIE + 6}" height="${DIE + 6}" rx="${f(r + 3)}" fill="${INK}"/>
    <rect x="${-h}" y="${-h}" width="${DIE}" height="${DIE}" rx="${f(r)}" fill="${IVORY}"/>
    <rect x="${f(-h + ring / 2)}" y="${f(-h + ring / 2)}" width="${f(DIE - ring)}" height="${f(DIE - ring)}" rx="${f(r - ring / 2)}" fill="none" stroke="${CYAN}" stroke-opacity="0.55" stroke-width="${f(ring)}"/>
    <image href="${piece}" x="${f(-p / 2)}" y="${f(-p / 2)}" width="${f(p)}" height="${f(p)}"/>
  </g>`;
}

// Without the private portraits, the medallion holds his starry hat instead,
// so a public checkout still builds a splash that makes sense.
function star(x, y, r) {
  const points = [];
  for (let j = 0; j < 10; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / 5;
    const rr = j % 2 ? r * 0.45 : r;
    points.push(`${f(x + rr * Math.cos(a))},${f(y + rr * Math.sin(a))}`);
  }
  return `<polygon points="${points.join(' ')}" fill="#e3e4e6"/>`;
}
export const HAT_BLUE = '#24548e';
function wizardHat() {
  return `<g stroke="${INK}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
    <path d="M1262 738 C1330 560 1404 372 1478 250 C1520 196 1606 214 1652 270 C1672 296 1660 334 1628 324 C1598 312 1572 300 1552 312 C1566 440 1592 600 1616 738 Z" fill="${HAT_BLUE}"/>
    <ellipse cx="1436" cy="752" rx="282" ry="70" fill="${HAT_BLUE}"/>
    <path d="M1262 744 C1340 784 1540 786 1612 744" fill="none" stroke-width="8"/>
  </g>
  <g>${star(1478, 330, 26)}${star(1520, 470, 30)}${star(1410, 560, 26)}${star(1548, 650, 24)}</g>`;
}

// The scene as SVG. `portrait` is Thinkle's vector (an SVG data URI) or null;
// `pieces` and `mark` are data URIs. Pure, so a test can draw it with any
// portrait it likes.
export function splashSvg({ portrait, pieces, mark }) {
  const markY = CREDIT.base - CREDIT.cap / 2 - CREDIT.mark / 2;
  const side = 2048 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs><clipPath id="medallion"><circle cx="${MEDALLION.cx}" cy="${MEDALLION.cy}" r="${MEDALLION.r}"/></clipPath></defs>
  <rect width="1920" height="1080" fill="${BACKGROUND}"/>
  <g font-family="Titan One" font-size="${TITLE.size}" letter-spacing="${TITLE.track}" fill="${IVORY}" text-anchor="middle">
    <text x="${TITLE.x}" y="${TITLE.base[0]}">Dice</text>
    <text x="${TITLE.x}" y="${TITLE.base[1]}">Chess</text>
  </g>
  <g clip-path="url(#medallion)">
    <rect x="${MEDALLION.cx - MEDALLION.r}" y="${MEDALLION.cy - MEDALLION.r}" width="${2 * MEDALLION.r}" height="${2 * MEDALLION.r}" fill="${SKY}"/>
    ${portrait ? `<image href="${portrait}" x="${f(px(0))}" y="${f(py(0))}" width="${f(side)}" height="${f(side)}"/>` : wizardHat()}
  </g>
  <circle cx="${MEDALLION.cx}" cy="${MEDALLION.cy}" r="${MEDALLION.r + MEDALLION.rim / 2}" fill="none" stroke="${IVORY}" stroke-width="${MEDALLION.rim}"/>
  ${hatSparkles()}
  ${orbitDots()}
  ${[...DICE]
    .reverse()
    .map((d) => die(pieces[d.piece], d))
    .join('')}
  <image href="${mark}" x="${CREDIT.x}" y="${markY}" width="${CREDIT.mark}" height="${CREDIT.mark}"/>
  <text x="${CREDIT.x + CREDIT.mark + CREDIT.gap - 5}" y="${CREDIT.base}" font-family="Arimo" font-size="${CREDIT.size}" fill="#ffffff">Fortemate</text>
</svg>`;
}

// The frame as opaque RGB bytes, 1920 x 1080. `portrait` is the bytes of
// Thinkle's vector, or null for a checkout without the private portraits.
export function renderSplash(root, portrait) {
  const svg = splashSvg({
    portrait: portrait ? uri(portrait, 'image/svg+xml') : null,
    pieces: Object.fromEntries(
      DICE.map(({ piece }) => [
        piece,
        uri(readFileSync(join(PIECES, `${piece}.svg`)), 'image/svg+xml'),
      ]),
    ),
    mark: uri(
      readFileSync(join(root, 'brand/fortemate-mark-white.svg')),
      'image/svg+xml',
    ),
  });
  const image = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [
        join(root, 'splash/fonts/titan-one/TitanOne-Regular.ttf'),
        join(root, 'splash/fonts/arimo/Arimo-Regular.ttf'),
      ],
      defaultFontFamily: 'Arimo',
    },
  }).render();
  const rgba = image.pixels;
  const rgb = Buffer.alloc(image.width * image.height * 3);
  for (let s = 0, t = 0; s < rgba.length; s += 4) {
    rgb[t++] = rgba[s];
    rgb[t++] = rgba[s + 1];
    rgb[t++] = rgba[s + 2];
  }
  return rgb;
}
