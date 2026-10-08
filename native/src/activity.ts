// One foreground gate for audio, remote input and work between frames (#254).
// Its snapshot changes synchronously with Vega's event, before React renders.
import React from 'react';

export type Activity = {
  isActive: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

export function createActivity(initial: boolean) {
  let active = initial;
  const listeners = new Set<() => void>();
  return {
    isActive: () => active,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setActive(next: boolean) {
      if (next === active) return;
      active = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

export const ActivityContext = React.createContext<Activity>({
  isActive: () => true,
  subscribe: () => () => undefined,
});

export function useActivity() {
  const activity = React.useContext(ActivityContext);
  const active = React.useSyncExternalStore(
    activity.subscribe,
    activity.isActive,
  );
  return { activity, active };
}

export const afterDelay = (step: () => void, wait: number) => {
  const timer = setTimeout(step, wait);
  return () => clearTimeout(timer);
};

// Keeps the unfinished wait across blur/focus. Already queued callbacks become
// harmless, including a timer delivered before React has committed the pause.
export function scheduleActive(
  activity: Activity,
  schedule: (step: () => void, wait: number) => void | (() => void),
  step: () => void,
  wait = 0,
  now: () => number = Date.now,
): () => void {
  let remaining = wait;
  let began = 0;
  let ticket = 0;
  let queued = false;
  let finished = false;
  let cancelQueued: (() => void) | undefined;
  const arm = () => {
    if (finished || queued || !activity.isActive()) return;
    queued = true;
    began = now();
    const current = ++ticket;
    const cancel = schedule(() => {
      if (finished || current !== ticket) return;
      queued = false;
      cancelQueued = undefined;
      if (!activity.isActive()) return;
      finished = true;
      unsubscribe();
      step();
    }, remaining);
    cancelQueued = typeof cancel === 'function' ? cancel : undefined;
  };
  const unsubscribe = activity.subscribe(() => {
    if (activity.isActive()) arm();
    else if (queued) {
      remaining = Math.max(0, remaining - (now() - began));
      queued = false;
      ticket++;
      cancelQueued?.();
      cancelQueued = undefined;
    }
  });
  arm();
  return () => {
    finished = true;
    ticket++;
    cancelQueued?.();
    cancelQueued = undefined;
    unsubscribe();
  };
}

// The bot's search overlaps its presentation wait. Time spent behind a system
// overlay must not spend that wait, even if the search was still queued.
export function activeClock(activity: Activity, now: () => number) {
  let pausedAt: number | null = activity.isActive() ? null : now();
  let paused = 0;
  const dispose = activity.subscribe(() => {
    if (!activity.isActive()) pausedAt = now();
    else if (pausedAt !== null) {
      paused += now() - pausedAt;
      pausedAt = null;
    }
  });
  return { now: () => (pausedAt ?? now()) - paused, dispose };
}
