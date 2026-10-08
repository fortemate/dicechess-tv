// The native launch splash (#289): "Thinkle conjures". Thinkle sits in an
// ivory-rimmed medallion, the app's portrait language, with three chess dice
// stacked over his raised palm. They rise from it one after another and float
// out to a dotted orbit beside him, where they hover. "Dice Chess" leads on the
// left in Titan One; the Fortemate mark and its name sit together as the
// developer credit (BRAND.md prefers the mark with the name).
//
// Vega loops the whole archive whatever desc.txt asks for, so the motion is a
// loop: the dice are on their orbit by about 1.1 s and hover until 2.5 s, then
// glide back into his palm, and the last frame leads straight into the first.
// A cool start on our Stick shows the splash for about 2.2 s, so a typical
// launch hands over while they hover. ../splash/README.md has the reasons, the
// sizes and the provenance of every input.
//
// Build-time only: the rasterizer, the fonts and Thinkle's vector stay out of
// the package; the device gets the PNG frames.
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
const clamp = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const out = (t) => 1 - Math.pow(1 - t, 3);

// The frame rate in desc.txt and the frames in one loop: 3.125 s. Each frame
// is a whole 1920 x 1080 PNG in the archive, so the count is what its size
// buys: about 3 MB with Thinkle, which the Stick prepared in time (README).
export const MOTION = { fps: 8, frames: 25 };
// Frames 20..24 glide the dice home; frame 24 leads into frame 0.
const RETURN_FROM = 20;
// The frame the dice rest in, on their orbit: what most launches hand over on.
export const REST_FRAME = 17;

// THEME in src/theme.ts: background, die face and cursor. The test reads the
// background back from the frames, so a change there fails until both agree.
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
// His open palm, under his own die, where the three dice start and end.
const PALM = { x: px(470), y: py(1235) };

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

// Frame 0: the dice stacked in a little pyramid over his palm, at half size,
// as if he were holding them out. The queen sits on top and leaves first.
const FAN = {
  scale: 0.52,
  tilt: [3, -6, 7],
  at: [
    { x: PALM.x + 4, y: PALM.y - 160 },
    { x: PALM.x - 46, y: PALM.y - 70 },
    { x: PALM.x + 52, y: PALM.y - 66 },
  ],
};

// The frame each die leaves at (top, middle, bottom), how many frames a flight
// takes, and the gentle hover on the orbit.
const LEAVE = [0.5, 1.4, 2.3];
const FLIGHT = 6.2;
const BOB = { amp: 5, period: 2.6 };

function bezier(p0, p1, p2, p3, u) {
  const a = (1 - u) ** 3;
  const b = 3 * (1 - u) ** 2 * u;
  const c = 3 * (1 - u) * u * u;
  const d = u ** 3;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

// Out: a fountain arc, up out of the palm first, then over to the orbit.
function outPath(k, u) {
  const s = FAN.at[k];
  const e = DICE[k];
  return bezier(
    s,
    { x: s.x - 30, y: s.y - 230 },
    { x: e.x + 40, y: e.y - 140 },
    e,
    u,
  );
}

// Home: a short, low inner arc back into the palm.
function homePath(k, from, u) {
  const s = FAN.at[k];
  return bezier(
    from,
    { x: from.x + 70, y: from.y + 60 },
    { x: s.x - 60, y: s.y + 70 },
    s,
    u,
  );
}

const bob = (k, i) =>
  BOB.amp * Math.sin((2 * Math.PI * i) / MOTION.fps / BOB.period + k * 2.1);

// Where die k is in frame i: position, scale, tilt, and how far it has flown.
function dieState(k, i) {
  const e = DICE[k];
  if (i >= RETURN_FROM) {
    const v = (i - RETURN_FROM + 1) / (MOTION.frames - RETURN_FROM);
    const u = 0.5 - 0.5 * Math.cos(Math.PI * v);
    const p = homePath(k, { x: e.x, y: e.y + bob(k, i) }, u);
    return {
      ...p,
      scale: lerp(1, FAN.scale, u),
      tilt: lerp(e.tilt, FAN.tilt[k], u),
      fly: 1 - u,
    };
  }
  const u = clamp((i - LEAVE[k]) / FLIGHT);
  const eased = 0.5 * (u * u * (3 - 2 * u)) + 0.5 * (1 - (1 - u) * (1 - u));
  const p = outPath(k, eased);
  const settle = clamp((i - LEAVE[k] - FLIGHT) / 4);
  return {
    x: p.x,
    y: p.y + bob(k, i) * settle,
    scale: lerp(FAN.scale, 1, out(clamp(u * 1.25))),
    tilt: lerp(FAN.tilt[k], e.tilt, eased),
    fly: u,
  };
}

function sparkle(x, y, r, fill, opacity) {
  if (r < 1) return '';
  const q = r * 0.26;
  return `<path transform="translate(${f(x)} ${f(y)})" d="M0 ${f(-r)}C${f(q * 0.5)} ${f(-q)} ${f(q)} ${f(-q * 0.5)} ${f(r)} 0C${f(q)} ${f(q * 0.5)} ${f(q * 0.5)} ${f(q)} 0 ${f(r)}C${f(-q * 0.5)} ${f(q)} ${f(-q)} ${f(q * 0.5)} ${f(-r)} 0C${f(-q)} ${f(-q * 0.5)} ${f(-q * 0.5)} ${f(-q)} 0 ${f(-r)}Z" fill="${fill}" fill-opacity="${f(opacity)}"/>`;
}

// Sparkle dust behind a die on its way out: two motes each.
function trail(k, i) {
  const state = dieState(k, i);
  if (i >= RETURN_FROM || state.fly <= 0 || state.fly >= 1) return '';
  const motes = [];
  for (const [lag, r, colour, dx, dy] of [
    [0.16, 15, GOLD, 10, 18],
    [0.32, 10, IVORY, -14, -6],
  ]) {
    const v = clamp(state.fly - lag);
    const u = 0.5 * (v * v * (3 - 2 * v)) + 0.5 * (1 - (1 - v) * (1 - v));
    if (u <= 0.02) continue;
    const p = outPath(k, u);
    motes.push(sparkle(p.x + dx, p.y + dy, r, colour, 0.95));
  }
  return motes.join('');
}

// One soft glint at a die's corner as it settles, then gone.
function glint(k, i) {
  const t = i - LEAVE[k] - FLIGHT * 0.8;
  if (i >= RETURN_FROM || t <= 0 || t >= 3.5) return '';
  const w = Math.sin((Math.PI * t) / 3.5);
  const e = DICE[k];
  return sparkle(
    e.x + DIE / 2 - 6,
    e.y - DIE / 2 + 4 + bob(k, i),
    22 * w,
    IVORY,
    0.95,
  );
}

// Calm sparkles by the tip of his hat: each breathes once per loop.
function hatSparkles(i) {
  const tip = { x: px(1290), y: py(205) };
  return [
    { x: tip.x + 46, y: tip.y - 74, r: 30, colour: IVORY },
    { x: tip.x + 136, y: tip.y - 30, r: 17, colour: GOLD },
    { x: tip.x - 34, y: tip.y - 96, r: 13, colour: IVORY },
    { x: tip.x + 186, y: tip.y + 46, r: 11, colour: IVORY },
  ]
    .map((s, j) => {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i / MOTION.frames + j / 4));
      return sparkle(
        s.x,
        s.y,
        s.r * (0.72 + 0.28 * w),
        s.colour,
        0.8 + 0.2 * w,
      );
    })
    .join('');
}

// Gold sparkles at his palm while he holds the dice: there at the start, gone
// once they have flown, back as they come home.
function palmSparkles(i) {
  const leaving = 1 - clamp(i / 5);
  const home = clamp((i - RETURN_FROM + 1) / (MOTION.frames - RETURN_FROM));
  const k = Math.max(leaving, home);
  if (k <= 0.02) return '';
  return [
    sparkle(PALM.x - 118, PALM.y - 120, 20 * k, GOLD, 1),
    sparkle(PALM.x + 98, PALM.y - 150, 15 * k, IVORY, 1),
    sparkle(PALM.x - 22, PALM.y - 176, 12 * k, GOLD, 1),
  ].join('');
}

// The orbit itself, a faint dotted arc behind the dice, in every frame.
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
function die(piece, { x, y, scale: s, tilt }) {
  const size = DIE * s;
  const h = size / 2;
  const r = size / 6;
  const ring = Math.max(2, size / 36);
  const p = size * 0.72;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)})">
    <rect x="${f(-h - 3)}" y="${f(-h - 3)}" width="${f(size + 6)}" height="${f(size + 6)}" rx="${f(r + 3)}" fill="${INK}"/>
    <rect x="${f(-h)}" y="${f(-h)}" width="${f(size)}" height="${f(size)}" rx="${f(r)}" fill="${IVORY}"/>
    <rect x="${f(-h + ring / 2)}" y="${f(-h + ring / 2)}" width="${f(size - ring)}" height="${f(size - ring)}" rx="${f(r - ring / 2)}" fill="none" stroke="${CYAN}" stroke-opacity="0.55" stroke-width="${f(ring)}"/>
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

// Frame i of the scene as SVG. `portrait` is Thinkle's vector (an SVG data
// URI) or null; `pieces` and `mark` are data URIs. Pure, so a test can draw it
// with any portrait it likes.
export function splashSvg(i, { portrait, pieces, mark }) {
  const states = DICE.map((_, k) => dieState(k, i));
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
  ${hatSparkles(i)}
  ${palmSparkles(i)}
  ${orbitDots()}
  ${DICE.map((_, k) => trail(k, i)).join('')}
  ${[2, 1, 0].map((k) => die(pieces[DICE[k].piece], states[k])).join('')}
  ${DICE.map((_, k) => glint(k, i)).join('')}
  <image href="${mark}" x="${CREDIT.x}" y="${markY}" width="${CREDIT.mark}" height="${CREDIT.mark}"/>
  <text x="${CREDIT.x + CREDIT.mark + CREDIT.gap - 5}" y="${CREDIT.base}" font-family="Arimo" font-size="${CREDIT.size}" fill="#ffffff">Fortemate</text>
</svg>`;
}

// A function from a frame index to that frame as opaque RGB bytes, 1920 x
// 1080. `portrait` is the bytes of Thinkle's vector, or null for a checkout
// without the private portraits. The inputs are read once.
export function splashRenderer(root, portrait) {
  const inputs = {
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
  };
  const font = {
    loadSystemFonts: false,
    fontFiles: [
      join(root, 'splash/fonts/titan-one/TitanOne-Regular.ttf'),
      join(root, 'splash/fonts/arimo/Arimo-Regular.ttf'),
    ],
    defaultFontFamily: 'Arimo',
  };
  return (i) => {
    const image = new Resvg(splashSvg(i, inputs), { font }).render();
    const rgba = image.pixels;
    const rgb = Buffer.alloc(image.width * image.height * 3);
    for (let s = 0, t = 0; s < rgba.length; s += 4) {
      rgb[t++] = rgba[s];
      rgb[t++] = rgba[s + 1];
      rgb[t++] = rgba[s + 2];
    }
    return rgb;
  };
}
