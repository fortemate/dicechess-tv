// Who made what the player sees, as the About screen shows it.
//
// This is where a licence's credit requirement is met, so the lines are the
// authors' own wording rather than ours: a pack's manifest in dicechess-assets
// carries the exact attribution its licence asks for, and a credit copies it.
// test/credits.test.ts holds this list to THIRD_PARTY_NOTICES.md, so the screen
// and the notices cannot drift apart.
//
// It names components and their licences. It does not settle how the combined
// application may be distributed — that question is open, and recorded as open
// in the notices and the README.

export type Credit = {
  // What it is, in the player's words.
  subject: string;
  // The credit as its author asks for it to be shown.
  line: string;
  licence: string;
  // Where it comes from. Written without a scheme: it is read off a television,
  // not followed.
  source: string;
};

export const APP = {
  title: 'Dice Chess TV',
  maker: 'Made by Fortemate',
} as const;

export const CREDITS: readonly Credit[] = [
  {
    subject: 'Chess pieces',
    line: 'Vector Chess Pieces by RhosGFX',
    // Public domain: no credit is required. It is given anyway.
    licence: 'CC0 1.0',
    source: 'rhosgfx.itch.io/vector-chess-pieces',
  },
  {
    subject: 'Rules engine',
    line: 'Dice Chess engine by Fortemate',
    licence: 'AGPL-3.0-only',
    source: 'github.com/fortemate/dicechess-engine',
  },
];
