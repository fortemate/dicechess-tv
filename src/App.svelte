<script lang="ts">
  import { onMount } from 'svelte';
  import { SaveStore } from './storage';
  import BotWorker from './bot.worker?worker&inline';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { Key } from '@lichess-org/chessground/types';
  import { INITIAL, derive, shiftSquare, type Snapshot } from './model';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.brown.css';

  let boardElement: HTMLDivElement;
  let board = $state.raw<Api | undefined>(undefined);
  let worker: Worker | undefined;
  let request = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let snapshot = $state<Snapshot>({ schema: 1 });
  let current = $derived(derive(snapshot));
  let cursor = $state('b1');
  let selected = $state<string | null>(null);
  let menu = $state(false);
  let menuIndex = $state(0);
  let error = $state('');
  let restored = $state(false);
  let workerStatus = $state('Not requested');
  let ticks = $state(0);
  let ready = false;
  let disposed = false;
  let busy = $state(true);
  let saveStatus = $state('Loading');
  let saves: SaveStore;
  const targets = $derived(
    selected
      ? current.legal
          .filter((m) => m.startsWith(selected!))
          .map((m) => m.slice(2, 4))
      : [],
  );

  function stopWorker() {
    request++;
    worker?.terminate();
    worker = undefined;
    clearTimeout(timer);
  }
  async function commit(next: Snapshot) {
    if (busy) throw new Error('Another save is pending');
    derive(next);
    busy = true;
    saveStatus = 'Saving';
    try {
      await saves.save(next);
      if (disposed) return;
      snapshot = next;
      selected = null;
      saveStatus = 'Committed';
    } catch (reason) {
      saveStatus = 'Failed';
      throw reason;
    } finally {
      busy = false;
    }
  }
  function runBot() {
    if (!ready || busy || current.phase !== 'bot' || error || worker) return;
    const dfen = current.dfen;
    const id = ++request;
    workerStatus = 'Computing in Worker';
    try {
      worker = new BotWorker();
      const fail = (message: string) => {
        if (id !== request) return;
        stopWorker();
        workerStatus = 'Failed';
        error = message;
      };
      worker.onerror = () =>
        fail(
          'Worker failed to load or execute. Open the menu to restart the probe.',
        );
      worker.onmessage = async (event) => {
        const data = event.data;
        if (
          id !== request ||
          data.id !== id ||
          data.dfen !== dfen ||
          current.dfen !== dfen
        )
          return;
        try {
          if (data.error) throw new Error(data.error);
          if (
            !Array.isArray(data.moves) ||
            data.moves.length !== 1 ||
            typeof data.moves[0] !== 'string'
          ) {
            throw new Error(
              'Expected one knight action in this diagnostic fixture',
            );
          }
          // A valid reply no longer needs the Worker or its computation timer.
          stopWorker();
          workerStatus = 'Saving reply';
          await commit({ ...snapshot, botMove: data.moves[0] });
          if (!disposed) workerStatus = 'Reply validated and saved';
        } catch (reason) {
          stopWorker();
          workerStatus = 'Failed';
          error = String(reason);
        }
      };
      timer = setTimeout(
        () => fail('Worker watchdog expired; no result was applied.'),
        10000,
      );
      worker.postMessage({ id, dfen });
    } catch (reason) {
      stopWorker();
      workerStatus = 'Failed';
      error = String(reason);
    }
  }
  async function restart() {
    stopWorker();
    try {
      await commit({ schema: 1 });
      cursor = 'b1';
      menu = false;
      error = '';
      restored = false;
      workerStatus = 'Not requested';
    } catch (reason) {
      error = 'Unable to write local save: ' + String(reason);
    }
  }
  async function onKey(event: KeyboardEvent) {
    const key = event.key === 'GoBack' ? 'Escape' : event.key;
    if (
      ![
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'Escape',
        'Backspace',
      ].includes(key)
    )
      return;
    event.preventDefault();
    if (busy || !ready) return;
    if (event.repeat && ['Enter', 'Escape', 'Backspace'].includes(key)) return;
    if (key === 'Escape' || key === 'Backspace') {
      if (selected) selected = null;
      else {
        menu = !menu;
        menuIndex = 0;
      }
      return;
    }
    if (menu) {
      if (key.startsWith('Arrow')) menuIndex = 1 - menuIndex;
      else if (key === 'Enter') {
        if (menuIndex === 0) menu = false;
        else await restart();
      }
      return;
    }
    if (key.startsWith('Arrow')) {
      cursor = shiftSquare(cursor, key);
      return;
    }
    if (current.phase === 'done' && !error) {
      await restart();
      return;
    }
    if (current.phase !== 'human' || error) return;
    const move =
      selected && current.legal.find((m) => m.startsWith(selected! + cursor));
    if (move) {
      try {
        await commit({ schema: 1, humanMove: move });
        runBot();
      } catch (reason) {
        error = String(reason);
      }
    } else if (current.legal.some((m) => m.startsWith(cursor)))
      selected = cursor;
  }
  $effect(() => {
    board?.set({
      fen: current.dfen.split(' ')[0],
      selected: selected as Key | undefined,
      lastMove: (snapshot.botMove || snapshot.humanMove)
        ?.match(/.{2}/g)
        ?.slice(0, 2) as Key[] | undefined,
    });
  });
  onMount(() => {
    board = Chessground(boardElement, {
      fen: INITIAL.split(' ')[0],
      viewOnly: true,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
    });
    saves = new SaveStore(indexedDB);
    void (async () => {
      try {
        const saved = await saves.restore(localStorage);
        if (disposed) return;
        if (saved) {
          snapshot = saved;
          restored = true;
          if (saved.botMove) workerStatus = 'Completed result restored';
        }
        saveStatus = saved ? 'Restored' : 'Ready';
      } catch (reason) {
        if (disposed) return;
        saveStatus = 'Failed';
        error =
          'Save unavailable or invalid. Restart from the menu: ' +
          String(reason);
      }
      if (disposed) return;
      busy = false;
      ready = true;
      runBot();
    })();
    const heartbeat = setInterval(() => ticks++, 250);
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      ready = false;
      void saves.close().catch(() => {});
      stopWorker();
      clearInterval(heartbeat);
      window.removeEventListener('keydown', onKey);
      board?.destroy();
    };
  });
</script>

<main data-dfen={current.dfen}>
  <section class="board-section" aria-label="Diagnostic chessboard">
    <div class="board-frame">
      <div class="cg-wrap" bind:this={boardElement}></div>
      {#each targets as square}<div
          class="target"
          style:left={`${(square.charCodeAt(0) - 97) * 12.5}%`}
          style:top={`${(8 - Number(square[1])) * 12.5}%`}
        ></div>{/each}
      <div
        class="cursor"
        style:left={`${(cursor.charCodeAt(0) - 97) * 12.5}%`}
        style:top={`${(8 - Number(cursor[1])) * 12.5}%`}
      ></div>
    </div>
  </section>
  <aside>
    <p class="eyebrow">DICE CHESS TV · TECHNICAL PROBE</p>
    <h1>One move. One local reply.</h1>
    <p>
      Fixed diagnostic: one remaining knight die per side. This is not a
      complete game.
    </p>
    <dl>
      <dt>Phase</dt>
      <dd data-testid="phase">{current.phase}</dd>
      <dt>Cursor / selection</dt>
      <dd>{cursor} / {selected ?? 'none'}</dd>
      <dt>Worker</dt>
      <dd>{workerStatus}</dd>
      <dt>Saved state</dt>
      <dd>{restored ? 'Restored' : 'Current session'}</dd>
      <dt>Save transaction</dt>
      <dd data-testid="save-status">{saveStatus}</dd>
      <dt>UI heartbeat</dt>
      <dd>{ticks}</dd>
    </dl>
    <p class="instructions">
      Arrows: move focus · OK / Enter: select<br />Back / Escape: cancel or open
      menu
    </p>
    {#if current.phase === 'done'}<p class="success">
        Engine + local Worker completed. Reload to check persistence. OK starts
        a new probe.
      </p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="status">
      Technical probe. Full games and statistics are not implemented.
    </p>
  </aside>
  {#if menu}<div class="veil">
      <div class="menu" role="dialog" aria-modal="true" aria-label="Probe menu">
        <h2>Probe menu</h2>
        <p class:active={menuIndex === 0}>Resume</p>
        <p class:active={menuIndex === 1}>Restart diagnostic</p>
        <small>Directions to choose · OK to confirm</small>
      </div>
    </div>{/if}
</main>
