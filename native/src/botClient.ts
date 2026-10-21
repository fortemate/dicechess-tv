import { replyFits, type BotReply } from '../../src/core/bot';
import type { Game } from '../../src/core/game';
import { activeClock, scheduleActive, type Activity } from './activity';
import { BOT_REQUEST, BOT_RESPONSE, readBotResult } from './botJob';

type Store = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};
type Ports = {
  store: Store;
  activity: Activity;
  launch: () => Promise<unknown>;
  schedule: (step: () => void, wait: number) => () => void;
  now: () => number;
  newId: () => string;
  timeout?: number;
};

export type BotWorker = {
  request: (game: Game) => Promise<BotReply>;
  dispose: () => void;
};

// Serialize requests, including requests for a new game while the old search
// finishes. The worker has a separate event loop; polling never runs the engine.
export function createBotClient(ports: Ports) {
  const { store, activity, schedule, now } = ports;
  let tail = Promise.resolve();
  let stopped = false;
  let timedOut = false;
  let cancelCurrent: (() => void) | undefined;

  const execute = (game: Game): Promise<BotReply> =>
    new Promise<BotReply>((resolve, reject) => {
      const requestId = ports.newId();
      const raw = JSON.stringify({ requestId, game });
      let finished = false;
      let cancelPoll = () => undefined as void;
      let cancelLaunch = () => undefined as void;
      let stopClock = () => undefined as void;
      const finish = (reply?: BotReply, error?: unknown) => {
        if (finished) return;
        finished = true;
        cancelPoll();
        cancelLaunch();
        stopClock();
        cancelCurrent = undefined;
        try {
          if (store.getString(BOT_REQUEST) === raw) {
            store.delete(BOT_REQUEST);
            store.delete(BOT_RESPONSE);
          }
        } catch (cleanupError) {
          error ??= cleanupError;
        }
        if (error || !reply) {
          const failure = error ?? new Error('Missing opponent reply');
          const message =
            typeof failure === 'string' ? failure : 'Opponent worker failed';
          reject(
            failure instanceof Error
              ? failure
              : new Error(message, { cause: failure }),
          );
        } else resolve(reply);
      };
      cancelCurrent = () =>
        finish(undefined, new Error('Opponent worker closed'));
      cancelLaunch = scheduleActive(activity, schedule, () => {
        try {
          store.delete(BOT_RESPONSE);
          store.set(BOT_REQUEST, raw);
          const clock = activeClock(activity, now);
          stopClock = clock.dispose;
          const began = clock.now();
          const poll = () => {
            if (finished) return;
            try {
              const response = store.getString(BOT_RESPONSE);
              if (response) {
                const result = readBotResult(response, requestId);
                if (!result.reply || !replyFits(game, result.reply))
                  throw new Error(
                    'The opponent replied to a different position',
                  );
                finish(result.reply);
              } else if (clock.now() - began >= (ports.timeout ?? 120_000)) {
                // This bounds transport failure, never the engine's search
                // strength. A suspended app does not spend the deadline.
                // Do not overlap another job after a lost response.
                timedOut = true;
                finish(undefined, new Error('Opponent worker did not answer'));
              } else cancelPoll = schedule(poll, 100);
            } catch (error) {
              finish(undefined, error);
            }
          };
          void ports.launch().catch((error) => finish(undefined, error));
          poll();
        } catch (error) {
          finish(undefined, error);
        }
      });
    });

  const request = (game: Game): Promise<BotReply> => {
    const job = tail.then(() => {
      if (stopped || timedOut)
        throw new Error('Opponent worker is unavailable');
      return execute(game);
    });
    tail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };
  return {
    request,
    dispose() {
      stopped = true;
      cancelCurrent?.();
    },
  };
}
