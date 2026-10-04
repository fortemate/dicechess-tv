// The Hot Seat hosts' lines (#202, #258), by event: what each host says, and
// nothing about when. src/core/hostVoice.ts numbers them into the ids their
// clips are recorded under and picks among them.
//
// Written in dicechess-assets, in the catalogue.json of
// voices/elevenlabs-dicechess-host (Rolly's) and of
// voices/elevenlabs-dicechess-host-prowla, and copied here word for word:
// native/test/vendoredVoices.test.ts fails when a line here and the clip
// recorded from it say different things. Every host has the same shape, one
// list for each event, so this table is left out of duplication analysis
// (sonar-project.properties).

import type { HostEvent } from './hostPacing.ts';

export type HostScript = Readonly<Record<HostEvent, readonly string[]>>;

// Every event of events.json has its lines, or this does not compile.
export const ROLLY: HostScript = {
  white_wins: [
    'White wins! What a game, both of you!',
    'Victory for White! You both played great!',
    'Hooray, White! And hooray, Black, too!',
  ],
  black_wins: [
    'Black takes the game! Well played, both!',
    "It's Black's game! What a match, you two!",
    'Three cheers for Black, and for White too!',
  ],
  win: [
    "And that's the game! Bravo, you two!",
    'We have a winner! Great game, everyone!',
  ],
  draw: [
    'A draw! Nobody wins, and everybody wins!',
    "It's a draw! You two are perfectly matched!",
    'All even! Shake hands, both of you!',
  ],
  intro: [
    "You two play, and I'll do the cheering!",
    "No dice for me! I'm just the host!",
    'Welcome, both of you! White rolls first!',
    'One board, two players, three dice! Go!',
    "Ooh, a brand new game... I can't wait!",
  ],
  again: [
    'Another game? Yay, more cheering for me!',
    "New game, new luck! Who's ready?",
    'Back for more? The dice are all warmed up!',
  ],
  handoff: [
    "Now pass the remote over! Black's turn!",
    'After every turn, the remote changes hands!',
    'Remote swap time! Black, roll away!',
  ],
  en_passant: [
    'En passant! A rare sideways capture!',
    'Did you see that? A pawn caught in passing!',
    "Psst... that's called en passant!",
  ],
  promotion: [
    'Look! That little pawn grew up!',
    'A pawn crossed the whole board! Amazing!',
    'Ta-da! The pawn got a big upgrade!',
  ],
  capture_queen: [
    'A queen is taken! Deep breaths, you two!',
    'Oh, the queen! My heart just did a flip!',
    'Ooh... there goes a queen!',
    'Queen down! My microphone is shaking!',
  ],
  capture_heavy: [
    'Wowee! The whole board felt that one!',
    'Kaboom! A mighty piece leaves the board!',
    'Timber! What a tumble!',
    'Big, big moment! Somebody pinch me!',
    'Oh my! Hold on to your seats, you two!',
  ],
  empty_roll: [
    'The dice said no! Pass it along!',
    'Aww, bad luck! Those dice are so cheeky!',
    'Oh no, the dice took a nap! Next turn!',
    'Uh-oh! The dice are playing tricks on us!',
  ],
  capture: [
    'Pop! One piece hops off the board!',
    'Oho! The plot thickens!',
    'A capture! A little more room on the board!',
    'And that piece is off for a little rest!',
  ],
};

// Prowla's: a warm, unhurried cat who purrs at the drama (dicechess-assets#56).
export const PROWLA: HostScript = {
  white_wins: [
    'White wins! Bravo, both of you.',
    'The game goes to White. Well played, Black.',
    'White takes it. What a chase, you two.',
  ],
  black_wins: [
    'Black takes the game! Lovely, you two.',
    'The game goes to Black. Well played, White.',
    'Black pounces last. What a chase, darlings.',
  ],
  win: [
    'And the game is caught. Bravo, you two.',
    'A winner! Purrr... beautifully done.',
    "That's the game, darlings. What fun.",
  ],
  draw: [
    'A draw! Two paws, perfectly matched.',
    'All even, darlings. Shake paws.',
    'A draw! You two are far too well matched.',
  ],
  intro: [
    'Two players, one board. How delicious.',
    "Mmm, a game for two. I'll watch from here.",
    'Welcome, darlings. White rolls first.',
    "Don't mind me... I'm only here to purr.",
    'No dice for me, darlings. I only watch.',
  ],
  again: [
    "Another round? Oh, I hoped you'd say that.",
    'Again? My tail is twitching already.',
    'Fresh board, fresh chase. Off you go.',
    'Back so soon? I adore a rematch.',
  ],
  handoff: [
    "Now pass the remote, darling. Black's turn.",
    'Paw it over. The remote moves every turn.',
    'Remote to Black, please. Gently now.',
  ],
  en_passant: [
    'En passant! Caught in passing, darlings.',
    'Sneaky! A pawn caught en passant.',
    'Psst... that sideways catch is en passant.',
  ],
  promotion: [
    'A pawn crossed the board! How bold.',
    'Look who grew up. A brand new piece!',
    'From little pawn to something grand.',
    'All the way across? Well done, little one.',
  ],
  capture_queen: [
    'A queen falls! Oh, I adore drama.',
    'A queen... gone. Breathe, darlings.',
    'The queen! Now we have a game.',
    'Farewell, Your Majesty. What a moment.',
  ],
  capture_heavy: [
    'Oh my! A big piece leaves the board.',
    'Now that was a proper pounce.',
    'My whiskers felt that one, darlings.',
    'What a catch! The whole board shivers.',
    'A grand piece gone. Now it gets serious.',
  ],
  empty_roll: [
    'The dice say no. Pass it along, darling.',
    'No move at all? The dice are teasing.',
    'Nothing to play? Even a cat must wait.',
    'The dice took a catnap. Next turn.',
    'No move... patience, darlings, patience.',
  ],
  capture: [
    'Caught! One piece leaves the board.',
    'Pounce! Someone was paying attention.',
    'Mmm, a capture. Things are warming up.',
    'Off it goes. The board breathes a little.',
    'Shh... a piece just slipped away.',
    'A tidy little catch. Purrr...',
  ],
};
