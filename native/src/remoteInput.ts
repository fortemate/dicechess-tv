import { createContext } from 'react';
import type { BoardKey } from '../../src/core/boardInput';

export type RemoteEvent = {
  key: Exclude<BoardKey, 'back'>;
  phase: 'down' | 'up';
};

// Stable for a mounted app. Back is a consuming channel: false from every
// subscriber delegates to the platform's default exit behavior.
export type RemoteInput = {
  subscribe(listener: (event: RemoteEvent) => void): () => void;
  subscribeBack(handler: () => boolean): () => void;
};

export const RemoteInputContext = createContext<RemoteInput | null>(null);

// A platform bridge publishes raw button transitions, including repeats and
// releases while unfocused. The shared hook owns hold tracking and gating.
export function createRemoteChannel() {
  const listeners = new Set<{ call: (event: RemoteEvent) => void }>();
  const backHandlers = new Set<{ call: () => boolean }>();
  const input: RemoteInput = {
    subscribe(call) {
      const entry = { call };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    subscribeBack(call) {
      const entry = { call };
      backHandlers.add(entry);
      return () => {
        backHandlers.delete(entry);
      };
    },
  };
  return {
    input,
    emit(event: RemoteEvent) {
      // A screen mounted during dispatch starts with the next event.
      const snapshot = [...listeners];
      for (const entry of snapshot) entry.call(event);
    },
    back() {
      // Newest mounted screen gets first refusal, as with native Back handlers.
      for (const entry of [...backHandlers].reverse()) {
        if (entry.call()) return true;
      }
      return false;
    },
  };
}
