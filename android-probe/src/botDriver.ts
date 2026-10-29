import {
  afterDelay,
  scheduleActive,
  type Activity,
} from '../../native/src/activity';
import {
  botOwes,
  BOT_STEP_MS,
  type ScreenState,
} from '../../native/src/screen';
import type { BotWorker } from '../../native/src/botClient';
import type { BotReply } from '../../src/core/bot';
import type { GameAction } from './gameSession';

type Ports = {
  activity: Activity;
  worker: BotWorker;
  read(): ScreenState;
  send(action: GameAction): void;
  fail(error: unknown): void;
  report(event: string, detail: unknown): void;
  schedule?: typeof afterDelay;
};

// Own one worker for the screen. Menus pause presentation without starting a
// second search for the same position. A restored turn asks for its remainder.
export function createBotDriver(ports: Ports) {
  const { activity, worker, read, send, fail, report } = ports;
  const schedule = ports.schedule ?? afterDelay;
  let disposed = false;
  let cancel = () => {};
  let search:
    | {
        game: ScreenState['game'];
        result: Promise<{ reply?: BotReply; error?: unknown }>;
      }
    | undefined;

  return {
    update(state: ScreenState) {
      cancel();
      if (disposed || state.overlay.kind !== 'none' || !botOwes(state.game))
        return;
      const game = state.game;
      let canceled = false;
      let cancelTimer = () => {};
      let cancelDelivery = () => {};
      cancel = () => {
        canceled = true;
        cancelTimer();
        cancelDelivery();
      };
      // Check the synchronous session as well as effect cleanup: a remote key
      // can change it before React commits the new overlay or replacement.
      const current = () =>
        !disposed &&
        !canceled &&
        read().game === game &&
        read().overlay.kind === 'none';
      const deliver = (result: { reply?: BotReply; error?: unknown } = {}) => {
        if (!current()) return;
        cancelDelivery = scheduleActive(activity, schedule, () => {
          if (!current()) return;
          if (result.error !== undefined) fail(result.error);
          else {
            report('step', {
              id: game.id,
              revision: game.revision,
              phase: game.phase,
            });
            send({ kind: 'bot', reply: result.reply });
          }
        });
      };
      if (game.phase !== 'move' || state.pending.length) {
        cancelTimer = scheduleActive(activity, schedule, deliver, BOT_STEP_MS);
        return;
      }
      if (search?.game !== game) {
        report('request', { id: game.id, revision: game.revision });
        search = {
          game,
          // Capture even synchronous provider errors; never fall back to RN search.
          result: Promise.resolve()
            .then(() => worker.request(game))
            .then(
              (reply) => ({ reply }),
              (error) => ({ error }),
            ),
        };
      }
      const result = search.result;
      cancelTimer = scheduleActive(
        activity,
        schedule,
        () => {
          void result.then(deliver);
        },
        BOT_STEP_MS,
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      worker.dispose();
      search = undefined;
      report('disposed', null);
    },
  };
}
