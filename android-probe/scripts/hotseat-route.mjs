// Plan only remote navigation using the game's existing input reducer.
// The emulator test still sends every key to Android; it never injects moves.
import { boardInput } from '../../src/core/boardInput.ts';
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const { focus, view, game, target } = JSON.parse(raw);
const queue = [{ focus, keys: [] }];
const seen = new Set();
while (queue.length) {
  const next = queue.shift();
  if (next.focus.cursor === target) {
    process.stdout.write(JSON.stringify(next.keys));
    process.exit(0);
  }
  const id = JSON.stringify(next.focus);
  if (seen.has(id)) continue;
  seen.add(id);
  for (const key of ['up', 'down', 'left', 'right']) {
    const moved = boardInput(
      next.focus,
      key,
      view.legal,
      game.human === 'b',
      view.dfen.split(' ')[0],
    );
    if (moved.action.type === 'none')
      queue.push({ focus: moved.focus, keys: [...next.keys, key] });
  }
}
throw new Error(`No remote route to ${target}`);
