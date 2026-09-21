<script lang="ts">
  import { onMount } from 'svelte';
  import BotWorker from './bot.worker?worker&inline';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { Key } from '@lichess-org/chessground/types';
  import {
    INITIAL,
    STORAGE_KEY,
    decode,
    derive,
    shiftSquare,
    type Snapshot,
  } from './model';
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
  function commit(next: Snapshot) {
    derive(next);
    // Do not advance the visible state if durable storage fails.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    snapshot = next;
    selected = null;
  }
  function runBot() {
    if (!ready || current.phase !== 'bot' || error || worker) return;
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
      worker.onmessage = (event) => {
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
          commit({ ...snapshot, botMove: data.moves[0] });
          workerStatus = 'Reply validated and saved';
          stopWorker();
        } catch (reason) {
          fail(String(reason));
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
  function restart() {
    stopWorker();
    try {
      commit({ schema: 1 });
      cursor = 'b1';
      menu = false;
      error = '';
      restored = false;
      workerStatus = 'Not requested';
    } catch (reason) {
      error = 'Unable to write local save: ' + String(reason);
    }
  }
  function onKey(event: KeyboardEvent) {
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
        else restart();
      }
      return;
    }
    if (key.startsWith('Arrow')) {
      cursor = shiftSquare(cursor, key);
      return;
    }
    if (current.phase === 'done' && !error) {
      restart();
      return;
    }
    if (current.phase !== 'human' || error) return;
    const move =
      selected && current.legal.find((m) => m.startsWith(selected! + cursor));
    if (move) {
      try {
        commit({ schema: 1, humanMove: move });
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        snapshot = decode(saved);
        restored = true;
        if (snapshot.botMove) workerStatus = 'Completed result restored';
      }
    } catch (reason) {
      error =
        'Save unavailable or invalid. Restart from the menu: ' + String(reason);
    }
    ready = true;
    runBot();
    const heartbeat = setInterval(() => ticks++, 250);
    window.addEventListener('keydown', onKey);
    return () => {
      ready = false;
      stopWorker();
      clearInterval(heartbeat);
      window.removeEventListener('keydown', onKey);
      board?.destroy();
    };
  });
</script>

<main>
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
      Diagnostic fixture. Full games and network-disabled cold start remain
      unverified.
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
