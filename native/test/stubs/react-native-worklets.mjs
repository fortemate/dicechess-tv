// A separate Node vm context for protocol tests. This does not model Vega's
// native threading: responsiveness and Hermes execution need device evidence.
import { createContext, runInContext } from 'node:vm';

export const scheduleOnRN = (callback, ...args) => callback(...args);
export const createWorkletRuntime = () => ({
  context: createContext({ scheduleOnRN }),
});
export const runOnRuntime =
  (runtime, worklet) =>
  (...args) => {
    const execute = runInContext(`(${worklet.toString()})`, runtime.context);
    queueMicrotask(() => execute(...args));
  };
