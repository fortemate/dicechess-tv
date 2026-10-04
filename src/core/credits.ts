// Who made what the player sees, as the About screen shows it.
//
// This is where a licence's credit requirement is met, so the words are the
// authors' own rather than ours. A pack's manifest in dicechess-assets words its
// credit as "<who> – <link>", and the screen splits it the way every card is
// laid out: who made it on the line, and the link, without its scheme, as the
// start of the source. test/credits.test.ts holds this list to the manifests
// and to THIRD_PARTY_NOTICES.md, so the screen and the notices cannot drift
// apart.
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

// The rules engine is Fortemate's own, like the app, so the About screen names it
// under the maker rather than on a card: the four cards go to other authors.
export const ENGINE: Credit = {
  subject: 'Rules engine',
  line: 'Dice Chess engine by Fortemate',
  licence: 'AGPL-3.0-only',
  source: 'github.com/fortemate/dicechess-engine',
};

// The voices, the bots', the Hot Seat hosts' and Thinkle's in the tutorial, are
// Fortemate's own too, made for this game with ElevenLabs (#187, #202, #258,
// #264) and licensed to Fortemate's Dice
// Chess apps only. They are named with the engine, which leaves the four cards
// to other authors. ElevenLabs asks for no credit on a paid plan; the line says
// the voices are synthetic, and made with what.
export const VOICES: Credit = {
  subject: 'Voices',
  line: 'Voices made with ElevenLabs',
  licence: 'Fortemate apps only',
  source: 'elevenlabs.io',
};

// The opponents' portraits are Fortemate's own as well: Rolly, Grabby and
// Rampage, drawn for this game with Recraft on a paid plan
// (fortemate/dicechess-assets#31) and licensed to Fortemate's Dice Chess apps
// only. Like the voices' line, theirs says they are AI-generated, and made with
// what. They are named with the voices, and only in a build that has them
// (#212).
export const PORTRAITS: Credit = {
  subject: 'Opponent portraits',
  line: 'Portraits made with Recraft',
  licence: 'Fortemate apps only',
  source: 'recraft.ai',
};

// Two packs by one artist, the chess pieces and the opponents' faces. A build
// with the portraits shows no face, so its card names only the pieces.
// Public domain: no credit is required. It is given anyway, with a link to the
// artist's page, which both packs ask for.
export const PIECES: Credit = {
  subject: 'Pieces',
  line: 'Pieces by RhosGFX',
  licence: 'CC0 1.0',
  source: 'rhosgfx.itch.io',
};
export const PIECES_AND_FACES: Credit = {
  ...PIECES,
  subject: 'Pieces and opponent faces',
  line: 'Pieces and faces by RhosGFX',
};

// The four cards of a build with the portraits: the About screen has room for
// four, in two columns.
export const CREDITS: readonly Credit[] = [
  PIECES,
  {
    subject: 'Piece sounds',
    // The licence requires visible credit and gives this wording as its
    // example; a link is optional. The author's permission for this repository
    // asks for a link to his page, which the source is.
    line: 'Sounds by JDSherbert',
    licence: 'Free with attribution',
    source: 'jdsherbert.itch.io/tabletop-games-sfx-pack',
  },
  {
    subject: 'Dice and result sounds',
    // CC0: no credit is required. It is given anyway, as the pack invites.
    line: 'Sounds by Kenney',
    licence: 'CC0 1.0',
    source: 'kenney.nl',
  },
  {
    subject: 'Music',
    // The author's permission covers this game only, and asks for this credit
    // with a link to his channel (#76).
    line: 'Music by pepka-prygni',
    licence: 'Permission for this game',
    source: 'youtube.com/@genreexplorer-h5o',
  },
];

// The cards a build shows. One without the portraits shows the RhosGFX faces in
// their place, and credits them with the pieces.
export const creditsFor = (portraits: boolean): readonly Credit[] =>
  portraits
    ? CREDITS
    : CREDITS.map((credit) => (credit === PIECES ? PIECES_AND_FACES : credit));
