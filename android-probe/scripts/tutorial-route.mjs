// Plan remote keys against the shared lesson reducer. The smoke suite sends
// every key to Android and compares its observed report; no state is injected.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({
  stdin: {
    contents: `export * from './native/src/tutorial';
      export { viewGame } from './src/core/game';
      export { boardInput } from './src/core/boardInput';
      export { TUTORIAL, isMissed } from './src/core/tutorial';`,
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const {
  initialTutorial,
  tutorialReducer,
  step,
  viewGame,
  boardInput,
  TUTORIAL,
  CLOSING_CHOICES,
  isMissed,
} = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
let state = initialTutorial();
const report = () => {
  const view = viewGame(state.game);
  return [
    `tutorial ${state.index + 1}/${TUTORIAL.length}`,
    `step ${step(state).id}`,
    `complete ${state.complete}`,
    `finished ${state.finished}`,
    `choice ${state.finished ? CLOSING_CHOICES[state.choice].label : '-'}`,
    `dice "${view.remaining}"`,
    `playable "${view.playable}"`,
    `cursor ${state.focus.cursor}`,
    `selected ${state.focus.selected ?? '-'}`,
    `last ${state.game.lastMove ?? '-'}`,
  ].join(' | ');
};
const plan = [{ key: null, expected: report(), capture: 'move-opening' }];
const send = (key, capture) => {
  state = tutorialReducer(state, key);
  plan.push({ key, expected: report(), capture });
};
const navigate = (target) => {
  const view = viewGame(state.game);
  const queue = [{ focus: state.focus, keys: [] }];
  const seen = new Set();
  while (queue.length) {
    const next = queue.shift();
    if (next.focus.cursor === target) {
      next.keys.forEach((key) => send(key));
      return;
    }
    const id = JSON.stringify(next.focus);
    if (seen.has(id)) continue;
    seen.add(id);
    for (const key of ['up', 'down', 'left', 'right']) {
      const moved = boardInput(
        next.focus,
        key,
        view.legal,
        false,
        view.dfen.split(' ')[0],
      );
      if (moved.action.type === 'none')
        queue.push({ focus: moved.focus, keys: [...next.keys, key] });
    }
  }
  throw new Error(`No remote route to ${target}`);
};
const move = (action) => {
  navigate(action.slice(0, 2));
  send('select');
  navigate(action.slice(2, 4));
  send('select');
};
for (const lesson of TUTORIAL) {
  assert.equal(step(state).id, lesson.id);
  send('select', `${lesson.id}-rolled`);
  if (lesson.id === 'move') {
    send('select', 'move-selected');
    assert.ok(state.focus.selected);
    send('back', 'move-deselected');
    assert.equal(state.focus.selected, null);
    assert.equal(state.exit, false);
  }
  if (lesson.id === 'capture') {
    move('d1d2');
    assert.ok(isMissed(lesson, state.game));
    send('left', 'capture-missed');
    send('select', 'capture-retry');
    assert.equal(state.game.phase, 'roll');
    send('select');
  }
  for (let i = 0; i < 4 && !state.complete; i++) {
    const legal = viewGame(state.game).legal;
    if (!legal.length) send('select');
    else {
      const target =
        lesson.goal.kind === 'capture'
          ? lesson.goal.square
          : lesson.goal.kind === 'kingCapture'
            ? 'a8'
            : null;
      move(legal.find((action) => action.slice(2, 4) === target) ?? legal[0]);
    }
  }
  assert.ok(state.complete, lesson.id);
  send('up', `${lesson.id}-complete`);
  send(
    'select',
    state.index + 1 < TUTORIAL.length
      ? `${TUTORIAL[state.index + 1].id}-opening`
      : 'closing',
  );
}
assert.ok(state.finished);
process.stdout.write(JSON.stringify(plan));
