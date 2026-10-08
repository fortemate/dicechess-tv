import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../vite.config.ts';

// The bench's tests run in Node, which has a `global` of its own, so the crash
// this guards against only showed in a browser: react-native-web's Animated
// calls global.cancelAnimationFrame when a slide is stopped before it ends.
test('the bench gives react-native-web the global that React Native has', () => {
  assert.equal(config.define?.global, 'globalThis');
});
