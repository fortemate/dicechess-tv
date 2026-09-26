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

export const CREDITS: readonly Credit[] = [
  {
    // Two packs by one artist, the chess pieces and the opponents' faces, on
    // one card: the About screen has room for four, in two columns.
    subject: 'Pieces and opponent faces',
    line: 'Pieces and faces by RhosGFX',
    // Public domain: no credit is required. It is given anyway, with a link to
    // the artist's page, which both packs ask for.
    licence: 'CC0 1.0',
    source: 'rhosgfx.itch.io',
  },
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
    subject: 'Rules engine',
    line: 'Dice Chess engine by Fortemate',
    licence: 'AGPL-3.0-only',
    source: 'github.com/fortemate/dicechess-engine',
  },
];
