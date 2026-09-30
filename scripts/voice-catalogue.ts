// The bots' voice lines as a JSON document, for the generator in
// fortemate/dicechess-assets that synthesizes their voices (#171, #159).
//
//   npm run -s voices:catalogue > catalogue.json
//
// The ids and texts are the game's own, from src/core/botVoice.ts, with the
// commit they come from, so that a voice pack made from them can be checked
// against the catalogue later. Run it whenever a line changes, before the pack
// is synthesized again. A catalogue file with changes that are not committed is
// marked `dirty`, since no commit then holds the texts it lists.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { VOICE_CATALOGUE, type VoiceEvent } from '../src/core/botVoice.ts';
import { BOT_MODES, type BotMode } from '../src/core/game.ts';
import { opponentOf } from '../src/core/opponents.ts';

export const CATALOGUE_PATH = 'src/core/botVoice.ts';

export type VoiceCatalogueDocument = {
  schemaVersion: 1;
  source: {
    repository: 'fortemate/dicechess-tv';
    commit: string;
    path: string;
    dirty: boolean;
  };
  bots: Record<BotMode, { name: string; level: string }>;
  lines: { id: string; bot: BotMode; event: VoiceEvent; text: string }[];
};

export function catalogueDocument(
  commit: string,
  dirty: boolean,
): VoiceCatalogueDocument {
  const bots = Object.fromEntries(
    BOT_MODES.map((mode) => {
      const { name, level } = opponentOf(mode);
      return [mode, { name, level }];
    }),
  ) as VoiceCatalogueDocument['bots'];
  return {
    schemaVersion: 1,
    source: {
      repository: 'fortemate/dicechess-tv',
      commit,
      path: CATALOGUE_PATH,
      dirty,
    },
    bots,
    lines: VOICE_CATALOGUE.map(({ id, bot, event, text }) => ({
      id,
      bot,
      event,
      text,
    })),
  };
}

const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const commit = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--', CATALOGUE_PATH) !== '';
  if (dirty)
    console.error(
      `${CATALOGUE_PATH} has changes that are not committed: the document is marked dirty.`,
    );
  process.stdout.write(
    JSON.stringify(catalogueDocument(commit, dirty), null, 2) + '\n',
  );
}
