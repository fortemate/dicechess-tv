import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';
import { newGame } from '../../src/core/game';
import { isHost } from './support';

const slot = Symbol.for('android-host-presentation-test');
registerHooks({
  /** Keep the renderer's React instance; control only the already-tested cue hook. */
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/android-probe/')) {
      if (specifier === 'react' || specifier.startsWith('react/'))
        return nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
      if (specifier.endsWith('/useHostVoice'))
        return {
          url:
            'data:text/javascript,' +
            encodeURIComponent(
              "export const useHostVoice = () => globalThis[Symbol.for('android-host-presentation-test')];",
            ),
          shortCircuit: true,
        };
    }
    return nextResolve(specifier, context);
  },
});
// A runtime URL preserves native CI's independence from Android dependencies.
const componentUrl = new URL(
  '../../android-probe/src/HostCommentary.tsx',
  import.meta.url,
);
const { HostCommentary } = await import(componentUrl.href);

test('Android host reserves its space after a caption expires and hides behind menus, Off and bots', () => {
  const line = HOST_CATALOGUE.find((each) => each.host === 'prowla')!;
  const game = newGame('hotseat', 'host-layout');
  Reflect.set(globalThis, slot, line);
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<HostCommentary game={game} host="prowla" live />);
  });
  const blocks = () =>
    tree.root.findAll(
      (node) => isHost(node, 'View') && node.props.testID === 'host-block',
    );
  const space = () =>
    tree.root.findAll((node) => isHost(node, 'View'))[0]?.props.style;
  try {
    assert.equal(blocks().length, 1);
    const reserved = space();
    act(() => {
      tree.update(<HostCommentary game={game} host="prowla" live={false} />);
    });
    assert.equal(blocks().length, 0);
    assert.deepEqual(space(), reserved);
    Reflect.set(globalThis, slot, null);
    act(() => {
      tree.update(<HostCommentary game={game} host="prowla" live />);
    });
    assert.equal(blocks().length, 0);
    assert.deepEqual(space(), reserved);
    act(() => {
      tree.update(<HostCommentary game={game} host="off" live />);
    });
    assert.equal(space(), undefined);
    act(() => {
      tree.update(
        <HostCommentary game={newGame('random', 'bot')} host="prowla" live />,
      );
    });
    assert.equal(space(), undefined);
  } finally {
    act(() => tree.unmount());
    Reflect.deleteProperty(globalThis, slot);
  }
});
