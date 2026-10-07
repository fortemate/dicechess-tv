// Build-time artwork only. The OS plays these PNGs before React Native starts;
// nothing in this file, its rasterizer or its fonts goes into the JS bundle.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const pieces = join(here, '../../src/assets/pieces/rhosgfx');
const uri = (file, mime) =>
  `data:${mime};base64,${readFileSync(file).toString('base64')}`;

export const MOTION = {
  milliseconds: 600,
  frames: 18,
  holdMilliseconds: 1000,
  dieSize: 202,
  dieTop: 583,
  clipTop: 454,
  bounceHeight: 48,
};

const clamp = (value) => Math.max(0, Math.min(1, value));

// One accelerating fall, one small rebound, then rest. Starting below the
// heading keeps the title readable even when startup cuts the reveal short.
export function pose(frame, slot) {
  const progress = clamp(frame / (MOTION.frames - 1));
  const delay = slot * 0.04;
  const local = clamp((progress - delay) / (1 - delay));
  const impact = 0.68;
  const drop = clamp(local / impact);
  let y =
    -(MOTION.dieTop - MOTION.clipTop + MOTION.dieSize + 32) * (1 - drop * drop);
  if (local >= impact) {
    const rebound = clamp((local - impact) / (1 - impact));
    y = -MOTION.bounceHeight * Math.sin(Math.PI * rebound) * (1 - rebound);
  }
  return progress === 1
    ? { y: 0, angle: 0 }
    : { y, angle: [-12, 10, -8][slot] * (1 - drop) };
}

export function splashRenderer(root, width, height) {
  const font = {
    loadSystemFonts: false,
    fontFiles: ['Arimo-Regular.ttf', 'Arimo-Bold.ttf'].map((name) =>
      join(root, 'splash/fonts', name),
    ),
    defaultFontFamily: 'Arimo',
  };
  const mark = uri(
    join(root, 'brand/fortemate-mark-512-white.png'),
    'image/png',
  );
  const faces = ['bN', 'bR', 'bK'].map((name) =>
    uri(join(pieces, `${name}.svg`), 'image/svg+xml'),
  );
  // Measure the actual font glyphs so the developer credit, including the mark
  // and its clear space, is centred rather than guessed from character count.
  const credit =
    '<text x="0" y="50" font-family="Arimo" font-size="46">by Fortemate</text>';
  const bounds = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="80">${credit}</svg>`,
    { font },
  ).innerBBox();
  if (!bounds) throw new Error('the splash credit font did not render');
  const creditLeft = (width - (62 + 38 + bounds.width)) / 2;
  const textLeft = creditLeft + 62 + 38 - bounds.x;

  return (frame) => {
    const dice = faces
      .map((face, slot) => {
        const { y, angle } = pose(frame, slot);
        const x = 960 - 202 / 2 + (slot - 1) * 260;
        return `<g transform="translate(${x} ${MOTION.dieTop + y}) rotate(${angle} 101 101)">
        <rect x="1.5" y="1.5" width="199" height="199" rx="33" fill="#f4ead8" stroke="#00eaff" stroke-opacity="0.4" stroke-width="3"/>
        <image href="${face}" x="26" y="26" width="150" height="150"/>
      </g>`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><clipPath id="below-title"><rect x="0" y="${MOTION.clipTop}" width="${width}" height="${height - MOTION.clipTop}"/></clipPath></defs>
      <rect width="${width}" height="${height}" fill="#122737"/>
      <text x="960" y="390" text-anchor="middle" font-family="Arimo" font-size="163" font-weight="700" letter-spacing="-5.7" fill="#f4ead8">Dice Chess</text>
      <g clip-path="url(#below-title)">${dice}</g>
      <image href="${mark}" x="${creditLeft}" y="938" width="62" height="62"/>
      <text x="${textLeft}" y="982" font-family="Arimo" font-size="46" fill="#f4ead8">by Fortemate</text>
    </svg>`;
    const rgba = new Resvg(svg, { font }).render().pixels;
    const rgb = Buffer.alloc(width * height * 3);
    for (let source = 0, target = 0; source < rgba.length; source += 4) {
      rgb[target++] = rgba[source];
      rgb[target++] = rgba[source + 1];
      rgb[target++] = rgba[source + 2];
    }
    return rgb;
  };
}
