// The mark gallery (#121): the board at both steps of a move, once for each
// variant of the cursor and the picked-up piece that was compared, side by
// side. 1B and 2E were chosen and are now the television's. The boards are
// native/src/Board.tsx with the bench's squares, at the size the game draws
// them. ?only=<id> draws one board alone and ?step=choose or ?step=move one
// step, for a screenshot; ?cvd= views the page through a colour-vision
// simulation.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { Board } from '../../native/src/Board';
import { THEME } from '../../native/src/theme';
import { boardSide, drawnSide } from '../../native/src/layout';
import { TV_HEIGHT, TV_WIDTH } from './shims/react-native';
import { CvdFilters, filterOf } from './Cvd';
import { CVD, DEFAULT_MARKS, type Marks } from './marks';
import { Carried } from './Square';
import { MarksOverride } from './useMarks';

// Four Knights with ...d5: White to move, the dice a pawn, a knight and a
// bishop. Nine pieces can move, and the cursor starts on a light square.
const BOARD = 'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/2N2N2/PPPP1PPP/R1BQKB1R';
const MOVABLE = ['a2', 'b2', 'd2', 'g2', 'h2', 'e4', 'c3', 'f3', 'f1'];
// The knight on c3, a dark square, is picked up. Its destinations are light
// squares, one of them a capture, and the cursor is on b5.
const PICKED = 'c3';
const LEGAL = ['c3b5', 'c3d5', 'c3a4', 'c3b1', 'c3e2'];
const TARGET = 'b5';

type Step = 'choose' | 'move';

type Variant = {
  id: string;
  title: string;
  note: string;
  marks: Partial<Marks>;
};

// The cursor and the picked-up piece as the television drew them before.
const BEFORE: Partial<Marks> = {
  cursor: 'frame',
  selected: 'tint-frame',
  arrow: 'off',
};

const STEPS: Record<Step, { title: string; variants: Variant[] }> = {
  choose: {
    title: 'Step 1: choosing a piece',
    variants: [
      {
        id: '1a',
        title: 'Before',
        note: 'A thin cyan frame among green fills.',
        marks: BEFORE,
      },
      {
        id: '1b',
        title: 'Bold two-tone cursor (chosen)',
        note: 'Cyan frame twice as wide, with a dark line inside.',
        marks: {},
      },
      {
        id: '1c',
        title: 'Corners, bold cursor',
        note: 'Pieces that can move get corners only (#105 C).',
        marks: { movable: 'corners' },
      },
      {
        id: '1d',
        title: 'Corners, filled cursor',
        note: 'The cursor is the one filled square on the board.',
        marks: { movable: 'corners', cursor: 'fill' },
      },
    ],
  },
  move: {
    title: 'Step 2: choosing where it goes',
    variants: [
      {
        id: '2a',
        title: 'Before',
        note: 'Both marks cyan: a tint with a double frame, and a thin frame.',
        marks: BEFORE,
      },
      {
        id: '2b',
        title: 'Bold cursor, same picked-up mark',
        note: 'Only the frames are stronger; both are still cyan.',
        marks: { selected: 'tint-frame', arrow: 'off' },
      },
      {
        id: '2c',
        title: 'Raised piece',
        note: 'The picked-up piece is lifted on a shadow, with no frame.',
        marks: { arrow: 'off' },
      },
      {
        id: '2d',
        title: 'Ghost',
        note: 'The piece fades where it stands and shows under the cursor.',
        marks: { selected: 'ghost', arrow: 'off' },
      },
      {
        id: '2e',
        title: 'Raised piece and arrow (chosen)',
        note: 'An arrow joins the picked-up piece to the cursor.',
        marks: {},
      },
      {
        id: '2f',
        title: 'Warm frame',
        note: 'The picked-up piece has an orange frame, the cursor cyan.',
        marks: { selected: 'warm', arrow: 'off' },
      },
      {
        id: '2g',
        title: 'Raised piece, filled cursor',
        note: 'Goes with 1d: the cursor stays the one filled square.',
        marks: { movable: 'corners', cursor: 'fill', arrow: 'off' },
      },
    ],
  },
};

const SIZE = drawnSide(boardSide(TV_WIDTH, TV_HEIGHT));

const Figure = ({ step, variant }: { step: Step; variant: Variant }) => {
  const marks = { ...DEFAULT_MARKS, ...variant.marks };
  const input =
    step === 'choose'
      ? { cursor: 'f3', movable: MOVABLE }
      : { cursor: TARGET, selected: PICKED, legal: LEGAL };
  return (
    <MarksOverride.Provider value={marks}>
      <Carried.Provider value="N">
        <View style={{ width: SIZE, height: SIZE }}>
          <Board size={SIZE} board={BOARD} {...input} />
        </View>
      </Carried.Provider>
    </MarksOverride.Provider>
  );
};

const params = new URLSearchParams(location.search);
const only = params.get('only');
const shown = (Object.keys(STEPS) as Step[]).filter(
  (step) => !params.get('step') || params.get('step') === step,
);
const cvd = CVD.find((name) => name === params.get('cvd')) ?? 'none';

const all = (Object.keys(STEPS) as Step[]).flatMap((step) =>
  STEPS[step].variants.map((variant) => ({ step, variant })),
);

const page: React.CSSProperties = {
  margin: 0,
  background: THEME.background,
  color: '#e8eef4',
  fontFamily: 'system-ui, sans-serif',
  filter: filterOf(cvd),
};

const Gallery = () => {
  const single = all.find(({ variant }) => variant.id === only);
  if (single)
    return (
      <div style={{ ...page, display: 'inline-block', padding: 16 }}>
        <Figure {...single} />
      </div>
    );
  return (
    <div style={{ ...page, padding: 24 }}>
      {shown.map((step) => (
        <section key={step}>
          <h2 style={{ fontWeight: 600 }}>{STEPS[step].title}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            {STEPS[step].variants.map((variant) => (
              <figure key={variant.id} style={{ margin: 0, width: SIZE }}>
                <Figure step={step} variant={variant} />
                <figcaption style={{ marginTop: 8, lineHeight: 1.4 }}>
                  <strong>
                    {variant.id.toUpperCase()} · {variant.title}
                  </strong>
                  <br />
                  {variant.note}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

document.body.style.margin = '0';
document.body.style.background = THEME.background;
const root = document.getElementById('root');
if (!root) throw new Error('No #root in gallery.html');
createRoot(root).render(
  <>
    <CvdFilters />
    <Gallery />
  </>,
);
